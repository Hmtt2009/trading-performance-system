import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { getDataConfidenceLabel } from '@/lib/analysis/baseline';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const supabase = await (await import('@/lib/supabase/server')).createClient();

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    const validPeriods = ['7d', '30d', '90d', 'all'];
    if (!validPeriods.includes(period)) {
      return NextResponse.json({ error: `Invalid period value. Must be one of: ${validPeriods.join(', ')}` }, { status: 400 });
    }

    const now = new Date();
    let dateFrom: Date;
    switch (period) {
      case '7d': dateFrom = new Date(now.getTime() - 7 * 86400000); break;
      case '30d': dateFrom = new Date(now.getTime() - 30 * 86400000); break;
      case '90d': dateFrom = new Date(now.getTime() - 90 * 86400000); break;
      case 'all': dateFrom = new Date('2000-01-01'); break;
      default: dateFrom = new Date(now.getTime() - 30 * 86400000);
    }

    const { data: sessions } = await supabase
      .from('trading_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gte('session_date', dateFrom.toISOString().split('T')[0])
      .order('session_date', { ascending: true });

    const { data: baseline } = await supabase
      .from('trader_baselines')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: patterns } = await supabase
      .from('pattern_detections')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', dateFrom.toISOString())
      .order('created_at', { ascending: false });

    const totalTrades = (sessions || []).reduce((s, sess) => s + sess.total_trades, 0);
    const totalNetPnl = (sessions || []).reduce((s, sess) => s + Number(sess.net_pnl), 0);
    const totalWins = (sessions || []).reduce((s, sess) => s + sess.winning_trades, 0);
    const totalLosses = (sessions || []).reduce((s, sess) => s + sess.losing_trades, 0);
    const winRate = totalTrades > 0 ? totalWins / totalTrades : 0;
    const totalBehaviorCost = (sessions || []).reduce((s, sess) => s + Number(sess.behavior_cost), 0);

    let cumPnl = 0;
    const equityCurve = (sessions || []).map((sess) => {
      cumPnl += Number(sess.net_pnl);
      return { date: sess.session_date, pnl: Number(sess.net_pnl), cumPnl: Math.round(cumPnl * 100) / 100 };
    });

    const patternSummary: Record<string, { count: number; totalImpact: number }> = {};
    for (const p of patterns || []) {
      if (!patternSummary[p.pattern_type]) patternSummary[p.pattern_type] = { count: 0, totalImpact: 0 };
      patternSummary[p.pattern_type].count++;
      patternSummary[p.pattern_type].totalImpact += Math.abs(Number(p.dollar_impact || 0));
    }

    const calendarData = (sessions || []).map((sess) => ({
      date: sess.session_date,
      pnl: Number(sess.net_pnl),
      trades: sess.total_trades,
    }));

    const confidenceLabel = getDataConfidenceLabel(baseline?.total_trades_analyzed || 0);

    return NextResponse.json({
      summary: {
        totalTrades,
        totalNetPnl: Math.round(totalNetPnl * 100) / 100,
        winRate: Math.round(winRate * 10000) / 10000,
        totalWins,
        totalLosses,
        tradingDays: (sessions || []).length,
        totalBehaviorCost: Math.round(totalBehaviorCost * 100) / 100,
        confidenceLabel,
      },
      equityCurve,
      patternSummary,
      calendarData,
      baseline: baseline || null,
      period,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}