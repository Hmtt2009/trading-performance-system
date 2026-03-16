import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';

interface WeekData {
  weekStart: string;
  weekEnd: string;
  netPnl: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  behaviorCost: number;
  topPattern: { type: string; count: number } | null;
  tradingDays: number;
}

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

function getFriday(mondayStr: string): string {
  const d = new Date(mondayStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 4);
  return d.toISOString().split('T')[0];
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = await (await import('@/lib/supabase/server')).createClient();

    // Fetch all sessions
    const { data: sessions } = await supabase
      .from('trading_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('session_date', { ascending: true })
      .limit(10000);

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ weeks: [] });
    }

    // Fetch pattern detections grouped by session
    const sessionIds = sessions.map(s => s.id);
    const { data: patterns } = await supabase
      .from('pattern_detections')
      .select('session_id, pattern_type')
      .eq('user_id', user.id)
      .in('session_id', sessionIds);

    // Group patterns by session
    const patternsBySession = new Map<string, string[]>();
    for (const p of (patterns || [])) {
      const arr = patternsBySession.get(p.session_id) || [];
      arr.push(p.pattern_type);
      patternsBySession.set(p.session_id, arr);
    }

    // Group sessions by week (Monday start)
    const weekMap = new Map<string, typeof sessions>();
    for (const session of sessions) {
      const monday = getMonday(session.session_date);
      const arr = weekMap.get(monday) || [];
      arr.push(session);
      weekMap.set(monday, arr);
    }

    // Build week summaries
    const weeks: WeekData[] = [];
    for (const [monday, weekSessions] of weekMap) {
      let totalTrades = 0, winningTrades = 0, losingTrades = 0;
      let netPnl = 0, behaviorCost = 0;
      const patternCounts = new Map<string, number>();

      for (const s of weekSessions) {
        totalTrades += s.total_trades || 0;
        winningTrades += s.winning_trades || 0;
        losingTrades += s.losing_trades || 0;
        netPnl += Number(s.net_pnl || 0);
        behaviorCost += Number(s.behavior_cost || 0);

        const sessionPatterns = patternsBySession.get(s.id) || [];
        for (const pt of sessionPatterns) {
          patternCounts.set(pt, (patternCounts.get(pt) || 0) + 1);
        }
      }

      let topPattern: { type: string; count: number } | null = null;
      let maxCount = 0;
      for (const [type, count] of patternCounts) {
        if (count > maxCount) {
          topPattern = { type, count };
          maxCount = count;
        }
      }

      weeks.push({
        weekStart: monday,
        weekEnd: getFriday(monday),
        netPnl: Math.round(netPnl * 100) / 100,
        winRate: totalTrades > 0 ? winningTrades / totalTrades : 0,
        totalTrades,
        winningTrades,
        losingTrades,
        behaviorCost: Math.round(behaviorCost * 100) / 100,
        topPattern,
        tradingDays: weekSessions.length,
      });
    }

    return NextResponse.json({ weeks });
  } catch (err) {
    console.error('Weekly analysis error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
