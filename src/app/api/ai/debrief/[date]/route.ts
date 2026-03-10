import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildDebriefInput, getDebriefSystemPrompt, getDebriefUserPrompt } from '@/lib/ai/debrief';
import { computeBaseline } from '@/lib/analysis/baseline';
import { analyzeSession } from '@/lib/analysis/session';
import type { ParsedTrade } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date } = await params;

    // Check for existing debrief
    const { data: existing } = await supabase
      .from('ai_debriefs')
      .select('*')
      .eq('user_id', user.id)
      .eq('period_start', date)
      .eq('debrief_type', 'daily')
      .single();

    if (existing) {
      return NextResponse.json({ debrief: existing });
    }

    return NextResponse.json({ debrief: null });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date } = await params;

    // Check for existing debrief (rate limit: 1 per session per day)
    const { data: existing } = await supabase
      .from('ai_debriefs')
      .select('*')
      .eq('user_id', user.id)
      .eq('period_start', date)
      .eq('debrief_type', 'daily')
      .single();

    if (existing) {
      return NextResponse.json({ debrief: existing });
    }

    // Fetch all user trades for baseline
    const { data: allTrades } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('entry_time', { ascending: true });

    if (!allTrades || allTrades.length === 0) {
      return NextResponse.json(
        { error: 'No trades found. Upload trades first.' },
        { status: 400 }
      );
    }

    const parsedTrades: ParsedTrade[] = allTrades.map((t) => ({
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

    const baseline = computeBaseline(parsedTrades);

    // Filter to session date
    const dayTrades = parsedTrades.filter(
      (t) => t.entryTime.toISOString().split('T')[0] === date
    );

    if (dayTrades.length === 0) {
      return NextResponse.json(
        { error: `No trades found for ${date}` },
        { status: 400 }
      );
    }

    const session = analyzeSession(dayTrades, baseline, date);
    const structuredInput = buildDebriefInput(session, baseline);

    // Call Claude API
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 }
      );
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: getDebriefSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: getDebriefUserPrompt(structuredInput),
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Claude API error:', errorBody);
      return NextResponse.json(
        { error: 'AI service error' },
        { status: 502 }
      );
    }

    const aiResponse = await response.json();
    const debriefText = aiResponse.content?.[0]?.text || '';
    const inputTokens = aiResponse.usage?.input_tokens || 0;
    const outputTokens = aiResponse.usage?.output_tokens || 0;
    // Rough cost estimate for claude-sonnet-4-20250514
    const estimatedCost = (inputTokens * 0.003 + outputTokens * 0.015) / 1000;

    // Get session record
    const { data: sessionRecord } = await supabase
      .from('trading_sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('session_date', date)
      .single();

    // Store debrief
    const { data: debrief, error: insertError } = await supabase
      .from('ai_debriefs')
      .insert({
        user_id: user.id,
        session_id: sessionRecord?.id || null,
        debrief_type: 'daily',
        period_start: date,
        period_end: date,
        structured_input: structuredInput,
        debrief_text: debriefText,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_cost_usd: estimatedCost,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to store debrief:', insertError);
    }

    return NextResponse.json({ debrief: debrief || { debrief_text: debriefText } });
  } catch (error) {
    console.error('Debrief error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
