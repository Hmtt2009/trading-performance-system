import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { getSubscription, getFeatureAccess } from '@/lib/auth/checkSubscription';

export async function GET(request: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const sub = await getSubscription(user.id);
    const access = getFeatureAccess(sub.tier);
    if (!access.aiDebrief) {
      return NextResponse.json({ error: 'AI debrief requires a paid subscription', upgrade: true }, { status: 403 });
    }
    const supabase = await (await import('@/lib/supabase/server')).createClient();
    const { date } = await params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
    }
    const dateObj = new Date(date + 'T00:00:00Z');
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }
    const { data: debrief } = await supabase.from('ai_debriefs').select('*').eq('user_id', user.id).eq('period_start', date).eq('debrief_type', 'daily').single();
    return NextResponse.json({ debrief: debrief || null });
  } catch (err) { console.error('Debrief GET error:', err); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const sub = await getSubscription(user.id);
    const access = getFeatureAccess(sub.tier);
    if (!access.aiDebrief) {
      return NextResponse.json({ error: 'AI debrief requires a paid subscription', upgrade: true }, { status: 403 });
    }
    const supabase = await (await import('@/lib/supabase/server')).createClient();
    const { date } = await params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
    }
    const dateObj = new Date(date + 'T00:00:00Z');
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }

    // Rate limiting: if a debrief was generated for this user+date within the last 10 minutes, return it
    const RATE_LIMIT_MINUTES = 10;
    const { data: existingDebrief } = await supabase
      .from('ai_debriefs')
      .select('*')
      .eq('user_id', user.id)
      .eq('period_start', date)
      .eq('debrief_type', 'daily')
      .single();

    if (existingDebrief?.updated_at) {
      const lastGenerated = new Date(existingDebrief.updated_at).getTime();
      const now = Date.now();
      const minutesSinceGeneration = (now - lastGenerated) / (1000 * 60);
      if (minutesSinceGeneration < RATE_LIMIT_MINUTES) {
        return NextResponse.json({
          debrief: existingDebrief,
          cached: true,
          retry_after_seconds: Math.ceil((RATE_LIMIT_MINUTES - minutesSinceGeneration) * 60),
        });
      }
    }

    const nextDate = new Date(date + 'T00:00:00Z'); nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const { data: trades } = await supabase.from('trades').select('*').eq('user_id', user.id).gte('entry_time', date).lt('entry_time', nextDate.toISOString().split('T')[0]).order('entry_time', { ascending: true });
    if (!trades || trades.length === 0) return NextResponse.json({ error: 'No trades found for this date' }, { status: 404 });
    const tradeIds = trades.map((t: { id: string }) => t.id);
    const { data: patterns } = await supabase.from('pattern_detections').select('*').eq('user_id', user.id).in('trigger_trade_id', tradeIds);
    const { data: baseline } = await supabase.from('trader_baselines').select('*').eq('user_id', user.id).maybeSingle();
    const { data: session } = await supabase.from('trading_sessions').select('*').eq('user_id', user.id).eq('session_date', date).maybeSingle();
    // Truncate trade data for AI input to control token costs
    const MAX_TRADES_FOR_AI = 30;
    const truncatedTrades = trades.length > MAX_TRADES_FOR_AI
      ? [
          ...trades.slice(0, MAX_TRADES_FOR_AI),
          { _summary: `...and ${trades.length - MAX_TRADES_FOR_AI} more trades (${trades.length} total)` },
        ]
      : trades;
    const structuredInput = { date, session, trades: truncatedTrades, patterns, baseline };
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, system: 'You are a professional trading performance coach. Analyze trading data and deliver honest, specific, actionable feedback. Reference specific trades by ticker and time. Never invent data.', messages: [{ role: 'user', content: `Session data:\n\n${JSON.stringify(structuredInput, null, 2)}\n\nGenerate coaching debrief:\n1. Session summary\n2. What went well\n3. What went wrong\n4. Cost of behavior\n5. One actionable recommendation\n\nUnder 400 words.` }] }),
    });
    if (!response.ok) {
      console.error('Claude API error:', response.status, await response.text());
      return NextResponse.json({ error: 'AI service temporarily unavailable' }, { status: 502 });
    }
    const aiData = await response.json();
    const debriefText = aiData.content?.[0]?.text || 'Unable to generate debrief.';
    const fullInput = { date, session, trades, patterns, baseline };
    const { data: saved } = await supabase.from('ai_debriefs').upsert({ user_id: user.id, session_id: session?.id || null, debrief_type: 'daily', period_start: date, period_end: date, structured_input: fullInput, debrief_text: debriefText, input_tokens: aiData.usage?.input_tokens || 0, output_tokens: aiData.usage?.output_tokens || 0 }, { onConflict: 'user_id,debrief_type,period_start' }).select().single();
    return NextResponse.json({ debrief: saved });
  } catch (err) { console.error('Debrief POST error:', err); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
