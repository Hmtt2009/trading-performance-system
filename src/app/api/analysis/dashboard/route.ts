import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDataConfidenceLabel } from '@/lib/analysis/baseline';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';

    // Calculate date range
    const now = new Date();
    let dateFrom: Date;
    switch (period) {
      case '7d':
        dateFrom = new Date(now.getTime() - 7 * 86400000);
        break;
      case '30d':
        dateFrom = new Date(now.getTime() - 30 * 86400000);
        break;
      case '90d':
        dateFrom = new Date(now.getTime() - 90 * 86400000);
        break;
      case 'all':
        dateFrom = new Date('2000-01-01');
        break;
      default:
        dateFrom = new Date(now.getTime() - 30 * 86400000);
    }

    // Fetch sessions in range
    const { data: sessions } = await supabase
      .from('trading_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gte('session_date', dateFrom.toISOString().split('T')[0])
      .order('session_date', { ascending: true });

    // Fetch baseline
    const { data: baseline } = await supabase
      .from('trader_baselines')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Fetch recent patterns
    const { data: patterns } = await supabase
      .from('pattern_detections')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', dateFrom.toISOString())
      .order('created_at', { ascending: false });

    // Compute summary
    const totalTrades = (sessions || []).reduce((s, sess) => s + sess.total_trades, 0);
    const totalNetPnl = (sessions || []).reduce((s, sess) => s + Number(sess.net_pnl), 0);
    const totalWins = (sessions || []).reduce((s, sess) => s + sess.winning_trades, 0);
    const totalLosses = (sessions || []).reduce((s, sess) => s + sess.losing_trades, 0);
    const winRate = totalTrades > 0 ? totalWins / totalTrades : 0;
    const totalBehaviorCost = (sessions || []).reduce((s, sess) => s + Number(sess.behavior_cost), 0);

    // Equity curve data
    let cumPnl = 0;
    const equityCurve = (sessions || []).map((sess) => {
      cumPnl += Number(sess.net_pnl);
      return {
        date: sess.session_date,
        pnl: Number(sess.net_pnl),
        cumPnl: Math.round(cumPnl * 100) / 100,
      };
    });

    // Pattern summary
    const patternSummary: Record<string, { count: number; totalImpact: number }> = {};
    for (const p of patterns || []) {
      if (!patternSummary[p.pattern_type]) {
        patternSummary[p.pattern_type] = { count: 0, totalImpact: 0 };
      }
      patternSummary[p.pattern_type].count++;
      patternSummary[p.pattern_type].totalImpact += Math.abs(Number(p.dollar_impact || 0));
    }

    // Calendar heat map data
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
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
