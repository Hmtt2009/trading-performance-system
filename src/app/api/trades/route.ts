import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const supabase = await (await import('@/lib/supabase/server')).createClient();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50') || 50), 100);
    const symbol = searchParams.get('symbol');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const validSortColumns = ['entry_time', 'symbol', 'net_pnl', 'position_value', 'hold_time_minutes'];
    const sortBy = searchParams.get('sortBy') || 'entry_time';
    if (!validSortColumns.includes(sortBy)) {
      return NextResponse.json(
        { error: `Invalid sortBy value. Must be one of: ${validSortColumns.join(', ')}` },
        { status: 400 }
      );
    }
    const rawSortDir = searchParams.get('sortDir');
    if (rawSortDir !== null && rawSortDir !== 'asc' && rawSortDir !== 'desc') {
      return NextResponse.json(
        { error: "Invalid sortDir value. Must be 'asc' or 'desc'" },
        { status: 400 }
      );
    }
    const sortDir = rawSortDir === 'asc';

    let query = supabase
      .from('trades')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id);

    if (symbol) query = query.eq('symbol', symbol.toUpperCase());
    if (dateFrom) query = query.gte('entry_time', dateFrom);
    if (dateTo) query = query.lte('entry_time', dateTo);

    const offset = (page - 1) * limit;

    query = query.order(sortBy, { ascending: sortDir }).range(offset, offset + limit - 1);

    const { data: trades, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
    }
    return NextResponse.json({
      trades,
      pagination: { page, limit, total: count || 0, totalPages: count ? Math.ceil(count / limit) : 0 },
    });
  } catch (err) {
    console.error('Trades error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}