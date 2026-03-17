import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';

export async function GET(request: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = await (await import('@/lib/supabase/server')).createClient();
    const { date } = await params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
    }
    const dateObj = new Date(date + 'T00:00:00Z');
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }
    const nextDate = new Date(date); nextDate.setDate(nextDate.getDate() + 1);
    const { data: trades } = await supabase.from('trades').select('*').eq('user_id', user.id).gte('entry_time', date).lt('entry_time', nextDate.toISOString().split('T')[0]).order('entry_time', { ascending: true });
    const tradeIds = (trades || []).map((t: { id: string }) => t.id);
    const { data: patterns } = tradeIds.length > 0 ? await supabase.from('pattern_detections').select('*').eq('user_id', user.id).in('trigger_trade_id', tradeIds) : { data: [] };
    const { data: session } = await supabase.from('trading_sessions').select('*').eq('user_id', user.id).eq('session_date', date).single();

    const patternsByTradeId = new Map<string, typeof patterns>();
    for (const pattern of patterns || []) {
      const linkedTradeIds = new Set<string>();
      if (pattern.trigger_trade_id) linkedTradeIds.add(pattern.trigger_trade_id);
      for (const tradeId of pattern.involved_trade_ids || []) {
        linkedTradeIds.add(tradeId);
      }

      for (const tradeId of linkedTradeIds) {
        const existing = patternsByTradeId.get(tradeId) || [];
        existing.push(pattern);
        patternsByTradeId.set(tradeId, existing);
      }
    }

    let cumulativePnl = 0;
    const timeline = (trades || []).map((trade) => {
      cumulativePnl += Number(trade.net_pnl || 0);
      const tradePatterns = patternsByTradeId.get(trade.id) || [];
      return {
        trade,
        cumPnl: Math.round(cumulativePnl * 100) / 100,
        patterns: tradePatterns,
        hasPattern: tradePatterns.length > 0,
      };
    });

    return NextResponse.json({
      date,
      session: session || null,
      timeline,
      totalTrades: timeline.length,
    });
  } catch (err) { console.error('Timeline error:', err); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
