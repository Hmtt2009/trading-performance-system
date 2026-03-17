import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { parseTradeCSV } from '@/lib/parsers';
import { computeBaseline } from '@/lib/analysis/baseline';
import { analyzeSession } from '@/lib/analysis/session';
import { getPostExitPriceData, createYahooFinanceClient } from '@/lib/market/postExitPrice';
import { toNullableNumber } from '@/lib/nullableNumber';
import { getBrokerDetailsFromFormat } from '@/lib/brokers';
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

    // Rate limiting: max 10 uploads per hour per user
    const MAX_UPLOADS_PER_HOUR = 10;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const { count: recentUploadCount } = await supabase
      .from('file_uploads')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo.toISOString());

    if ((recentUploadCount ?? 0) >= MAX_UPLOADS_PER_HOUR) {
      return NextResponse.json(
        { error: 'Too many uploads. Please wait before uploading again (max 10 per hour).' },
        {
          status: 429,
          headers: { 'Retry-After': '3600' },
        }
      );
    }

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

    // Validate MIME type to prevent disguised files (e.g., malware.exe.csv)
    const allowedMimeTypes = new Set(['text/csv', 'text/plain', 'application/vnd.ms-excel', '']);
    if (!allowedMimeTypes.has(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a valid CSV file.' },
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
        file_path: `uploads/${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
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

    const brokerDetails = getBrokerDetailsFromFormat(parseResult.metadata.brokerFormat);

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

    if (!brokerDetails) {
      await supabase
        .from('file_uploads')
        .update({
          status: 'failed',
          broker_format: parseResult.metadata.brokerFormat,
          error_message: 'Unsupported broker format',
          errors_count: parseResult.errors.length || 1,
        })
        .eq('id', uploadRecord.id);

      return NextResponse.json(
        {
          error: 'Unsupported broker format',
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
      .eq('broker_name', brokerDetails.brokerName)
      .single();

    let brokerAccountId: string;
    if (brokerAccount) {
      brokerAccountId = brokerAccount.id;
    } else {
      const { data: newAccount } = await supabase
        .from('broker_accounts')
        .insert({
          user_id: user.id,
          broker_name: brokerDetails.brokerName,
          account_label: brokerDetails.accountLabel,
        })
        .select()
        .single();
      if (!newAccount) {
        await supabase.from('file_uploads').update({ status: 'failed', error_message: 'Failed to create broker account' }).eq('id', uploadRecordId);
        return NextResponse.json({ error: 'Failed to create broker account' }, { status: 500 });
      }
      brokerAccountId = newAccount.id;
    }

    // Batch insert trades (upsert with ignoreDuplicates for dedup)
    const tradeRows = parseResult.trades.map((trade) => ({
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
    }));

    let insertedTrades: { id: string; trade: ParsedTrade }[] = [];
    let duplicatesSkipped = 0;
    let failedInserts = 0;

    const { data: batchResult, error: batchError } = await supabase
      .from('trades')
      .upsert(tradeRows, { onConflict: 'execution_hash', ignoreDuplicates: true })
      .select();

    if (batchError) {
      console.error('Batch trade insert failed:', batchError);
      failedInserts = parseResult.trades.length;
    } else {
      // Map inserted rows back to parsed trades via execution_hash
      const insertedByHash = new Map((batchResult || []).map((r) => [r.execution_hash, r.id]));
      for (const trade of parseResult.trades) {
        const dbId = insertedByHash.get(trade.executionHash);
        if (dbId) {
          insertedTrades.push({ id: dbId, trade });
        } else {
          duplicatesSkipped++;
        }
      }
    }

    // Batch insert all executions in a single DB call
    const allExecutions = insertedTrades.flatMap(({ id: tradeId, trade }) =>
      trade.executions.map((exec) => ({
        trade_id: tradeId,
        file_upload_id: uploadRecord.id,
        side: exec.side,
        quantity: exec.quantity,
        price: exec.price,
        commission: exec.commission,
        executed_at: exec.dateTime.toISOString(),
        raw_data: exec.rawRow,
      }))
    );

    if (allExecutions.length > 0) {
      const { error: execError } = await supabase.from('trade_executions').insert(allExecutions);
      if (execError) {
        console.error('Failed to batch insert executions:', execError);
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
        error_message: uploadStatus === 'failed'
          ? `All ${failedInserts} trade inserts failed`
          : failedInserts > 0
            ? `${failedInserts} of ${insertedTrades.length + failedInserts} trade inserts failed`
            : null,
      })
      .eq('id', uploadRecord.id);

    uploadCompleted = true;
    let enrichmentErrors = 0;

    // Compute/update baseline and sessions
    const TRADE_LIMIT = 10000;
    const { data: allUserTrades, count: totalTradeCount } = await supabase
      .from('trades')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('entry_time', { ascending: true })
      .limit(TRADE_LIMIT);

    if ((totalTradeCount ?? 0) > TRADE_LIMIT) {
      console.error(`User ${user.id} has ${totalTradeCount} trades, exceeding ${TRADE_LIMIT} limit. Baseline may be inaccurate.`);
    }

    if (allUserTrades && allUserTrades.length > 0) {
      // Convert DB trades to ParsedTrade format for analysis
      const parsedTrades: ParsedTrade[] = allUserTrades.map((t) => ({
        symbol: t.symbol,
        direction: t.direction as 'long' | 'short',
        entryTime: new Date(t.entry_time),
        exitTime: t.exit_time ? new Date(t.exit_time) : null,
        entryPrice: Number(t.entry_price),
        exitPrice: t.exit_price ? Number(t.exit_price) : null,
        quantity: Number(t.quantity),
        totalCommission: Number(t.total_commission),
        grossPnl: toNullableNumber(t.gross_pnl),
        netPnl: toNullableNumber(t.net_pnl),
        pnlPercent: toNullableNumber(t.pnl_percent),
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

          // Batch insert all patterns for this session
          const patternRows = session.patterns.map((pattern) => {
            const triggerTrade = dayTrades[pattern.triggerTradeIndex];
            const triggerDbTrade = allUserTrades.find(
              (t) => t.execution_hash === triggerTrade?.executionHash
            );
            const involvedTradeIds = (pattern.involvedTradeIndices || [])
              .map((idx) => {
                const involved = dayTrades[idx];
                if (!involved) return null;
                return allUserTrades.find((t) => t.execution_hash === involved.executionHash)?.id || null;
              })
              .filter(Boolean) as string[];

            return {
              user_id: user.id,
              session_id: sessionRecord.id,
              pattern_type: pattern.patternType,
              confidence: pattern.confidence,
              severity: pattern.severity,
              trigger_trade_id: triggerDbTrade?.id || null,
              involved_trade_ids: involvedTradeIds,
              dollar_impact: pattern.dollarImpact,
              description: pattern.description,
              detection_data: pattern.detectionData,
            };
          });

          if (patternRows.length > 0) {
            const { error: patternError } = await supabase.from('pattern_detections').insert(patternRows);
            if (patternError) console.error('Failed to batch insert patterns:', patternError);
          }

          // Enrich premature_exit patterns with post-exit price data
          try {
            const prematureExitPatterns = session.patterns.filter(
              (p) => p.patternType === 'premature_exit'
            );
            // Create a single YahooFinance client for all patterns in this session
            const yfClient = prematureExitPatterns.length > 0
              ? await createYahooFinanceClient()
              : null;
            // Fetch all post-exit data in parallel
            const enrichmentJobs = prematureExitPatterns.map((pattern) => {
              const trade = dayTrades[pattern.triggerTradeIndex];
              if (!trade?.exitTime || !trade.exitPrice) return null;
              return getPostExitPriceData(trade.symbol, trade.exitTime, yfClient)
                .then((postExitData) => ({ pattern, trade, postExitData }));
            }).filter(Boolean);

            const results = await Promise.allSettled(enrichmentJobs as Promise<{
              pattern: typeof prematureExitPatterns[number];
              trade: typeof dayTrades[number];
              postExitData: Awaited<ReturnType<typeof getPostExitPriceData>>;
            }>[]);

            // Count rejected enrichment promises
            const rejectedCount = results.filter((r) => r.status === "rejected").length;
            enrichmentErrors += rejectedCount;

            // Apply enrichment results to DB, tracking cost delta
            let behaviorCostDelta = 0;
            for (const result of results) {
              if (result.status !== 'fulfilled' || !result.value.postExitData) continue;
              const { pattern, trade, postExitData } = result.value;

              // Skip enrichment for deduplication-zeroed patterns
              if (pattern.dollarImpact === 0) continue;

              const triggerDbTrade = allUserTrades.find(
                (t) => t.execution_hash === trade.executionHash
              );
              if (!triggerDbTrade) continue;

              let actualLeftOnTable: number | null = null;
              const futurePrice = postExitData.priceAt4h ?? postExitData.priceAt2h ?? postExitData.priceAt1h;
              const exitPrice = trade.exitPrice!; // guaranteed non-null by pre-filter
              if (futurePrice != null) {
                if (trade.direction === 'long') {
                  actualLeftOnTable = Math.max(0, (futurePrice - exitPrice) * trade.quantity);
                } else {
                  actualLeftOnTable = Math.max(0, (exitPrice - futurePrice) * trade.quantity);
                }
              }

              // Only mark as verified if we actually computed a dollar impact
              const verified = actualLeftOnTable != null;
              const updates: Record<string, unknown> = {
                detection_data: {
                  ...pattern.detectionData,
                  postExitData,
                  postExitEnriched: verified,
                },
              };

              if (actualLeftOnTable != null && pattern.dollarImpact !== 0) {
                const verifiedImpact = Math.round(actualLeftOnTable * 100) / 100;
                behaviorCostDelta += verifiedImpact - Math.abs(pattern.dollarImpact);
                updates.dollar_impact = verifiedImpact;
                const moveDesc = postExitData.direction === 'up' ? 'rose' : postExitData.direction === 'down' ? 'fell' : 'stayed flat';
                updates.description = `Early exit on ${trade.symbol}: took $${(trade.netPnl ?? 0).toFixed(0)} profit after ${trade.holdTimeMinutes} min. Price ${moveDesc} ${postExitData.maxMovePercent}% in the next 4 hours. Actual left on table: ~$${Math.round(actualLeftOnTable)}.`;
              }

              await supabase
                .from('pattern_detections')
                .update(updates)
                .eq('session_id', sessionRecord.id)
                .eq('trigger_trade_id', triggerDbTrade.id)
                .eq('pattern_type', 'premature_exit');
            }

            // Update session behavior_cost if enrichment changed any impacts
            if (behaviorCostDelta !== 0) {
              const updatedCost = Math.round((session.behaviorCost + behaviorCostDelta) * 100) / 100;
              await supabase
                .from('trading_sessions')
                .update({ behavior_cost: Math.max(0, updatedCost) })
                .eq('id', sessionRecord.id);
            }
          } catch (enrichError) {
            // Post-exit enrichment is best-effort — never fail the upload
            console.error('Post-exit enrichment error:', enrichError);
            enrichmentErrors++;
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
      enrichmentErrors,
      errors: parseResult.errors,
      metadata: parseResult.metadata,
      warning:
        errorRate > 0.1
          ? `${Math.round(errorRate * 100)}% of rows had errors. Some trades may be missing.`
          : undefined,
      enrichmentWarning:
        enrichmentErrors > 0
          ? `${enrichmentErrors} post-exit enrichment operation(s) failed. Pattern analysis may be incomplete.`
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
