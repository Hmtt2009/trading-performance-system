import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeScorecard } from '@/lib/analysis/scorecard';
import type { ParsedTrade } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';

    const now = new Date();
    let dateFrom: Date;
    switch (period) {
      case '7d': dateFrom = new Date(now.getTime() - 7 * 86400000); break;
      case '30d': dateFrom = new Date(now.getTime() - 30 * 86400000); break;
      case '90d': dateFrom = new Date(now.getTime() - 90 * 86400000); break;
      case 'all': dateFrom = new Date('2000-01-01'); break;
      default: dateFrom = new Date(now.getTime() - 30 * 86400000);
    }

    const { data: trades, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_open', false)
      .gte('entry_time', dateFrom.toISOString())
      .order('entry_time', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
    }

    const parsedTrades: ParsedTrade[] = (trades || []).map((t) => ({
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

    const scorecard = computeScorecard(parsedTrades);

    return NextResponse.json({ scorecard, period });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
