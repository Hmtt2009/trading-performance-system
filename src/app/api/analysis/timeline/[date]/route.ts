import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';

export async function GET(request: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = await (await import('@/lib/supabase/server')).createClient();
    const { date } = await params;
    const nextDate = new Date(date); nextDate.setDate(nextDate.getDate() + 1);
    const { data: trades } = await supabase.from('trades').select('*').eq('user_id', user.id).gte('entry_time', date).lt('entry_time', nextDate.toISOString().split('T')[0]).order('entry_time', { ascending: true });
    const tradeIds = (trades || []).map((t: { id: string }) => t.id);
    const { data: patterns } = tradeIds.length > 0 ? await supabase.from('pattern_detections').select('*').eq('user_id', user.id).in('trigger_trade_id', tradeIds) : { data: [] };
    const { data: session } = await supabase.from('trading_sessions').select('*').eq('user_id', user.id).eq('session_date', date).single();
    return NextResponse.json({ trades: trades || [], patterns: patterns || [], session: session || null, date });
  } catch (err) { console.error('Timeline error:', err); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
