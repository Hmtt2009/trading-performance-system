import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
    }

    // Fetch trades for this date
    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    const { data: trades, error: tradesError } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .gte('entry_time', startOfDay)
      .lte('entry_time', endOfDay)
      .order('entry_time', { ascending: true });

    if (tradesError) {
      return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
    }

    // Fetch session
    const { data: session } = await supabase
      .from('trading_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('session_date', date)
      .single();

    // Fetch patterns for this session
    let patterns = null;
    if (session) {
      const { data } = await supabase
        .from('pattern_detections')
        .select('*')
        .eq('session_id', session.id)
        .eq('user_dismissed', false);
      patterns = data;
    }

    // Build timeline events
    let cumPnl = 0;
    const timeline = (trades || []).map((trade) => {
      cumPnl += Number(trade.net_pnl || 0);
      const tradePatterns = (patterns || []).filter(
        (p) => p.trigger_trade_id === trade.id
      );

      return {
        trade,
        cumPnl: Math.round(cumPnl * 100) / 100,
        patterns: tradePatterns,
        hasPattern: tradePatterns.length > 0,
      };
    });

    return NextResponse.json({
      date,
      session,
      timeline,
      totalTrades: trades?.length || 0,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
