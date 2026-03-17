import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { getSubscription } from '@/lib/auth/checkSubscription';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const sub = await getSubscription(user.id);
    if (sub.tier !== 'paid') {
      return NextResponse.json({ error: 'Cost analysis requires a paid subscription', upgrade: true }, { status: 403 });
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
      case '90d': dateFrom = new Date(now.getTime() - 90 * 86400000); break;
      case 'all': dateFrom = new Date('2000-01-01'); break;
      default: dateFrom = new Date(now.getTime() - 30 * 86400000);
    }
    const { data: patterns } = await supabase.from('pattern_detections').select('*').eq('user_id', user.id).gte('created_at', dateFrom.toISOString());
    const { data: sessions } = await supabase.from('trading_sessions').select('*').eq('user_id', user.id).gte('session_date', dateFrom.toISOString().split('T')[0]).order('session_date', { ascending: true });
    const totalNetPnl = (sessions || []).reduce((s, sess) => s + Number(sess.net_pnl), 0);
    const totalBehaviorCost = (sessions || []).reduce((s, sess) => s + Number(sess.behavior_cost), 0);
    const byPattern: Record<string, { count: number; totalImpact: number }> = {};
    for (const p of patterns || []) {
      if (!byPattern[p.pattern_type]) byPattern[p.pattern_type] = { count: 0, totalImpact: 0 };
      byPattern[p.pattern_type].count++;
      byPattern[p.pattern_type].totalImpact += Math.abs(Number(p.dollar_impact || 0));
    }
    let cum = 0; let cumW = 0;
    const equityCurveComparison = (sessions || []).map(sess => {
      cum += Number(sess.net_pnl); cumW += Number(sess.net_pnl) + Number(sess.behavior_cost);
      return { date: sess.session_date, actual: Math.round(cum * 100) / 100, simulated: Math.round(cumW * 100) / 100 };
    });
    const byPatternArray = Object.entries(byPattern).map(([patternType, val]) => ({ patternType, instances: val.count, totalImpact: Math.round(val.totalImpact * 100) / 100 }));
    return NextResponse.json({ totalBehaviorCost: Math.round(totalBehaviorCost*100)/100, actualPnl: Math.round(totalNetPnl*100)/100, simulatedPnl: Math.round((totalNetPnl+totalBehaviorCost)*100)/100, byPattern: byPatternArray, equityCurveComparison, period });
  } catch (err) { console.error('Cost error:', err); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}