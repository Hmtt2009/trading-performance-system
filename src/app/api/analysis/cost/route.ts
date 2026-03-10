import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Get sessions with P&L
    const { data: sessions } = await supabase
      .from('trading_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gte('session_date', dateFrom.toISOString().split('T')[0])
      .order('session_date', { ascending: true });

    // Get patterns
    const { data: patterns } = await supabase
      .from('pattern_detections')
      .select('*')
      .eq('user_id', user.id)
      .eq('user_dismissed', false)
      .gte('created_at', dateFrom.toISOString());

    const actualPnl = (sessions || []).reduce((s, sess) => s + Number(sess.net_pnl), 0);
    const totalBehaviorCost = (patterns || []).reduce(
      (s, p) => s + Math.abs(Number(p.dollar_impact || 0)),
      0
    );

    // Group by pattern type
    const byPattern: Record<string, { instances: number; totalImpact: number }> = {};
    for (const p of patterns || []) {
      if (!byPattern[p.pattern_type]) {
        byPattern[p.pattern_type] = { instances: 0, totalImpact: 0 };
      }
      byPattern[p.pattern_type].instances++;
      byPattern[p.pattern_type].totalImpact += Math.abs(Number(p.dollar_impact || 0));
    }

    // Equity curve: actual vs simulated (without pattern trades)
    let cumActual = 0;
    let cumSimulated = 0;
    const equityCurveComparison = (sessions || []).map((sess) => {
      const sessionCost = Number(sess.behavior_cost || 0);
      cumActual += Number(sess.net_pnl);
      cumSimulated += Number(sess.net_pnl) + sessionCost;
      return {
        date: sess.session_date,
        actual: Math.round(cumActual * 100) / 100,
        simulated: Math.round(cumSimulated * 100) / 100,
      };
    });

    return NextResponse.json({
      actualPnl: Math.round(actualPnl * 100) / 100,
      totalBehaviorCost: Math.round(totalBehaviorCost * 100) / 100,
      simulatedPnl: Math.round((actualPnl + totalBehaviorCost) * 100) / 100,
      byPattern: Object.entries(byPattern).map(([type, data]) => ({
        patternType: type,
        ...data,
        totalImpact: Math.round(data.totalImpact * 100) / 100,
      })),
      equityCurveComparison,
      period,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
