import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { parseTradeCSV } from '@/lib/parsers';
import { computeBaseline } from '@/lib/analysis/baseline';
import { analyzeSession } from '@/lib/analysis/session';
import type { ParsedTrade } from '@/types';

export async function POST(request: NextRequest) {
  let uploadRecordId: string | null = null;
  let uploadCompleted = false;
  let supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>> | null = null;

  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    supabase = await (await import('@/lib/supabase/server')).createClient();

    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Please upload a CSV file' },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 413 }
      );
    }

    // Read file content
    const csvContent = await file.text();

    if (!csvContent.trim()) {
      return NextResponse.json(
        { error: 'File is empty' },
        { status: 400 }
      );
    }

    // Create file upload record
    const { data: uploadRecord, error: uploadError } = await supabase
      .from('file_uploads')
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_path: `uploads/${user.id}/${Date.now()}-${file.name}`,
        file_size_bytes: file.size,
        status: 'processing',
      })
      .select()
      .single();

    if (uploadError) {
      return NextResponse.json(
        { error: 'Failed to create upload record' },
        { status: 500 }
      );
    }

    uploadRecordId = uploadRecord.id;

    // Get existing execution hashes for deduplication
    const { data: existingTrades } = await supabase
      .from('trades')
      .select('execution_hash')
      .eq('user_id', user.id)
      .not('execution_hash', 'is', null);

    const existingHashes = new Set(
      (existingTrades || []).map((t) => t.execution_hash).filter(Boolean) as string[]
    );

    // Parse the CSV
    const parseResult = parseTradeCSV(csvContent, existingHashes);

    // Check for fatal errors
    if (parseResult.errors.length > 0 && parseResult.trades.length === 0) {
      await supabase
        .from('file_uploads')
        .update({
          status: 'failed',
          error_message: parseResult.errors[0].message,
          errors_count: parseResult.errors.length,
        })
        .eq('id', uploadRecord.id);

      return NextResponse.json(
        {
          error: parseResult.errors[0].message,
          errors: parseResult.errors,
          uploadId: uploadRecord.id,
        },
        { status: 422 }
      );
    }

    // Get or create broker account
    const { data: brokerAccount } = await supabase
      .from('broker_accounts')
      .select()
      .eq('user_id', user.id)
      .eq('broker_name', 'ibkr')
      .single();

    let brokerAccountId: string;
    if (brokerAccount) {
      brokerAccountId = brokerAccount.id;
    } else {
      const { data: newAccount } = await supabase
        .from('broker_accounts')
        .insert({
          user_id: user.id,
          broker_name: 'ibkr',
          account_label: 'IBKR Account',
        })
        .select()
        .single();
      if (!newAccount) {
        await supabase.from('file_uploads').update({ status: 'failed', error_message: 'Failed to create broker account' }).eq('id', uploadRecordId);
        return NextResponse.json({ error: 'Failed to create broker account' }, { status: 500 });
      }
      brokerAccountId = newAccount.id;
    }

    // Insert trades
    const insertedTrades: { id: string; trade: ParsedTrade }[] = [];
    let duplicatesSkipped = 0;
    let failedInserts = 0;

    for (const trade of parseResult.trades) {
      // Check for duplicate trade hash
      const { data: existing } = await supabase
        .from('trades')
        .select('id')
        .eq('execution_hash', trade.executionHash)
        .single();

      if (existing) {
        duplicatesSkipped++;
        continue;
      }

      const { data: insertedTrade, error: tradeError } = await supabase
        .from('trades')
        .insert({
          user_id: user.id,
          broker_account_id: brokerAccountId,
          file_upload_id: uploadRecord.id,
          symbol: trade.symbol,
          asset_type: 'stock',
          direction: trade.direction,
          entry_time: trade.entryTime.toISOString(),
          exit_time: trade.exitTime?.toISOString() || null,
          entry_price: trade.entryPrice,
          exit_price: trade.exitPrice,
          quantity: trade.quantity,
          total_commission: trade.totalCommission,
          gross_pnl: trade.grossPnl,
          net_pnl: trade.netPnl,
          pnl_percent: trade.pnlPercent,
          hold_time_minutes: trade.holdTimeMinutes,
          position_value: trade.positionValue,
          is_open: trade.isOpen,
          execution_hash: trade.executionHash,
        })
        .select()
        .single();

      if (tradeError) {
        // Likely duplicate hash conflict — skip
        if (tradeError.code === '23505') {
          duplicatesSkipped++;
          continue;
        }
        console.error('Failed to insert trade:', tradeError);
        failedInserts++;
        continue;
      }

      insertedTrades.push({ id: insertedTrade.id, trade });

      // Insert executions
      for (const exec of trade.executions) {
        const { error: execError } = await supabase.from('trade_executions').insert({
          trade_id: insertedTrade.id,
          file_upload_id: uploadRecord.id,
          side: exec.side,
          quantity: exec.quantity,
          price: exec.price,
          commission: exec.commission,
          executed_at: exec.dateTime.toISOString(),
          raw_data: exec.rawRow,
        });
        if (execError) {
          console.error('Failed to insert execution:', execError);
        }
      }
    }

    // Update upload record
    const totalErrors = parseResult.errors.length + failedInserts;
    const uploadStatus = insertedTrades.length === 0 && failedInserts > 0 ? 'failed' : 'completed';
    await supabase
      .from('file_uploads')
      .update({
        status: uploadStatus,
        broker_format: parseResult.metadata.brokerFormat,
        trades_parsed: insertedTrades.length,
        duplicates_skipped: duplicatesSkipped + parseResult.duplicateHashes.length,
        errors_count: totalErrors,
        error_message: uploadStatus === 'failed' ? `All ${failedInserts} trade inserts failed` : null,
      })
      .eq('id', uploadRecord.id);

    uploadCompleted = true;

    // Compute/update baseline and sessions
    const { data: allUserTrades } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('entry_time', { ascending: true });

    if (allUserTrades && allUserTrades.length > 0) {
      // Convert DB trades to ParsedTrade format for analysis
      const parsedTrades: ParsedTrade[] = allUserTrades.map((t) => ({
        symbol: t.symbol,
        direction: t.direction as 'long' | 'short',
        entryTime: new Date(t.entry_time),
        exitTime: t.exit_time ? new Date(t.exit_time) : null,
        entryPrice: Number(t.entry_price),
        exitPrice: t.exit_price ? Number(t.exit_price) : null,
        quantity: t.quantity,
        totalCommission: Number(t.total_commission),
        grossPnl: t.gross_pnl ? Number(t.gross_pnl) : null,
        netPnl: t.net_pnl ? Number(t.net_pnl) : null,
        pnlPercent: t.pnl_percent ? Number(t.pnl_percent) : null,
        holdTimeMinutes: t.hold_time_minutes,
        positionValue: Number(t.position_value),
        isOpen: t.is_open,
        executionHash: t.execution_hash || '',
        executions: [],
      }));

      // Update baseline
      const baseline = computeBaseline(parsedTrades);
      const { error: baselineError } = await supabase
        .from('trader_baselines')
        .upsert({
          user_id: user.id,
          avg_trades_per_day: baseline.avgTradesPerDay,
          stddev_trades_per_day: baseline.stddevTradesPerDay,
          avg_position_size: baseline.avgPositionSize,
          stddev_position_size: baseline.stddevPositionSize,
          avg_hold_time_minutes: baseline.avgHoldTimeMinutes,
          avg_time_between_trades_minutes: baseline.avgTimeBetweenTradesMinutes,
          avg_winning_hold_time_minutes: baseline.avgWinningHoldTimeMinutes,
          avg_losing_hold_time_minutes: baseline.avgLosingHoldTimeMinutes,
          overall_win_rate: baseline.overallWinRate,
          total_trades_analyzed: baseline.totalTradesAnalyzed,
          performance_by_hour: baseline.performanceByHour,
          performance_by_dow: baseline.performanceByDow,
          computed_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      if (baselineError) console.error('Failed to update baseline:', baselineError);

      // Create/update session records for newly imported dates
      const newDates = new Set(
        insertedTrades.map((t) =>
          t.trade.entryTime.toISOString().split('T')[0]
        )
      );

      for (const date of newDates) {
        const dayTrades = parsedTrades.filter(
          (t) => t.entryTime.toISOString().split('T')[0] === date
        );
        const session = analyzeSession(dayTrades, baseline, date);

        const { error: sessionError } = await supabase.from('trading_sessions').upsert(
          {
            user_id: user.id,
            session_date: date,
            total_trades: session.totalTrades,
            winning_trades: session.winningTrades,
            losing_trades: session.losingTrades,
            gross_pnl: session.grossPnl,
            net_pnl: session.netPnl,
            win_rate: session.winRate,
            patterns_detected: session.patterns.length,
            behavior_cost: session.behaviorCost,
          },
          { onConflict: 'user_id,session_date' }
        );
        if (sessionError) console.error('Failed to update session:', sessionError);

        // Store pattern detections
        const { data: sessionRecord } = await supabase
          .from('trading_sessions')
          .select('id')
          .eq('user_id', user.id)
          .eq('session_date', date)
          .single();

        if (sessionRecord) {
          // Delete old patterns for this session
          await supabase
            .from('pattern_detections')
            .delete()
            .eq('session_id', sessionRecord.id);

          // Insert new patterns
          for (const pattern of session.patterns) {
            const triggerTrade = dayTrades[pattern.triggerTradeIndex];
            const triggerDbTrade = allUserTrades.find(
              (t) => t.execution_hash === triggerTrade?.executionHash
            );

            const { error: patternError } = await supabase.from('pattern_detections').insert({
              user_id: user.id,
              session_id: sessionRecord.id,
              pattern_type: pattern.patternType,
              confidence: pattern.confidence,
              severity: pattern.severity,
              trigger_trade_id: triggerDbTrade?.id || null,
              involved_trade_ids: [],
              dollar_impact: pattern.dollarImpact,
              description: pattern.description,
              detection_data: pattern.detectionData,
            });
            if (patternError) console.error('Failed to insert pattern:', patternError);
          }
        }
      }
    }

    // Warning for high error rate
    const errorRate =
      parseResult.metadata.totalRows > 0
        ? parseResult.metadata.errorRows / parseResult.metadata.totalRows
        : 0;

    return NextResponse.json({
      uploadId: uploadRecord.id,
      tradesImported: insertedTrades.length,
      duplicatesSkipped: duplicatesSkipped + parseResult.duplicateHashes.length,
      failedInserts,
      errors: parseResult.errors,
      metadata: parseResult.metadata,
      warning:
        errorRate > 0.1
          ? `${Math.round(errorRate * 100)}% of rows had errors. Some trades may be missing.`
          : undefined,
      optionsMessage:
        parseResult.metadata.optionsSkipped > 0
          ? `${parseResult.metadata.optionsSkipped} options trades were skipped. Options analysis is coming in a future update.`
          : undefined,
    });
  } catch (error) {
    console.error('Upload error:', error);
    if (supabase && uploadRecordId && !uploadCompleted) {
      try {
        await supabase.from('file_uploads').update({ status: 'failed', error_message: 'Internal server error' }).eq('id', uploadRecordId);
      } catch { /* best-effort cleanup */ }
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
