import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid pattern ID format' }, { status: 400 });
    }

    const supabase = await (await import('@/lib/supabase/server')).createClient();

    // Fetch the pattern detection
    const { data: pattern, error: patternError } = await supabase
      .from('pattern_detections')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (patternError || !pattern) {
      return NextResponse.json({ error: 'Pattern not found' }, { status: 404 });
    }

    // Fetch involved trades
    let trades: Record<string, unknown>[] = [];
    if (pattern.involved_trade_ids && pattern.involved_trade_ids.length > 0) {
      const { data: tradeData, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .in('id', pattern.involved_trade_ids)
        .eq('user_id', user.id)
        .order('entry_time', { ascending: true });

      if (tradesError) {
        console.error('Failed to fetch involved trades:', tradesError);
      } else {
        trades = tradeData || [];
      }
    }

    // Fetch trigger trade
    let triggerTrade: Record<string, unknown> | null = null;
    if (pattern.trigger_trade_id) {
      const { data: triggerData, error: triggerError } = await supabase
        .from('trades')
        .select('*')
        .eq('id', pattern.trigger_trade_id)
        .eq('user_id', user.id)
        .single();

      if (triggerError) {
        console.error('Failed to fetch trigger trade:', triggerError);
      } else {
        triggerTrade = triggerData;
      }
    }

    return NextResponse.json({
      pattern,
      trades,
      triggerTrade,
    });
  } catch (err) {
    console.error('Pattern detail error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
