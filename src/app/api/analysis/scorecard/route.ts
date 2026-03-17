import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { getSubscription } from '@/lib/auth/checkSubscription';

interface RawSegment {
  trades: number;
  wins: number;
  totalPnl: number;
  winPnl: number;
  lossPnl: number;
}

function emptySegment(): RawSegment {
  return { trades: 0, wins: 0, totalPnl: 0, winPnl: 0, lossPnl: 0 };
}

function addTrade(seg: RawSegment, pnl: number, isWin: boolean) {
  seg.trades++;
  if (isWin) { seg.wins++; seg.winPnl += pnl; }
  else { seg.lossPnl += pnl; }
  seg.totalPnl += pnl;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const sub = await getSubscription(user.id);
    if (sub.tier !== 'paid') {
      return NextResponse.json({ error: 'Scorecard requires a paid subscription', upgrade: true }, { status: 403 });
    }
    const supabase = await (await import('@/lib/supabase/server')).createClient();
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '90d';
    const validPeriods = ['7d', '30d', '90d', 'all'];
    if (!validPeriods.includes(period)) {
      return NextResponse.json({ error: `Invalid period value. Must be one of: ${validPeriods.join(', ')}` }, { status: 400 });
    }
    const now = new Date();
    let dateFrom: Date;
    switch (period) {
      case '7d': dateFrom = new Date(now.getTime() - 7 * 86400000); break;
      case '30d': dateFrom = new Date(now.getTime() - 30 * 86400000); break;
      case 'all': dateFrom = new Date('2000-01-01'); break;
      default: dateFrom = new Date(now.getTime() - 90 * 86400000);
    }
    const { data: trades } = await supabase.from('trades').select('*').eq('user_id', user.id).eq('is_open', false).gte('entry_time', dateFrom.toISOString()).order('entry_time', { ascending: true }).limit(10000);
    const allTrades = trades || [];

    const byHour: Record<number, RawSegment> = {};
    const byDow: Record<number, RawSegment> = {};
    const byHoldTime: Record<string, RawSegment> = {
      '0-5min': emptySegment(), '5-15min': emptySegment(),
      '15-60min': emptySegment(), '1-4hr': emptySegment(), '4hr+': emptySegment(),
    };
    const bySymbol: Record<string, RawSegment> = {};
    const byPriceTier: Record<string, RawSegment> = {
      'Penny': emptySegment(), 'Small': emptySegment(),
      'Mid': emptySegment(), 'Large': emptySegment(),
    };
    const byTimeOfDay: Record<string, RawSegment> = {
      'Pre-Market': emptySegment(), 'Open (9:30-10:00)': emptySegment(),
      'Morning (10:00-12:00)': emptySegment(), 'Afternoon (12:00+)': emptySegment(),
    };

    const etFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const dowMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };

    for (const t of allTrades) {
      const pnl = Number(t.net_pnl || 0);
      const isWin = pnl > 0;
      const entryDate = new Date(t.entry_time);

      // Eastern time hour/minute
      const parts = etFormatter.formatToParts(entryDate);
      const etHour = Number(parts.find(p => p.type === 'hour')?.value || 0);
      const etMinute = Number(parts.find(p => p.type === 'minute')?.value || 0);
      const etTotalMinutes = etHour * 60 + etMinute;

      // By Hour (Eastern time)
      if (!byHour[etHour]) byHour[etHour] = emptySegment();
      addTrade(byHour[etHour], pnl, isWin);

      // By Day of Week (Eastern time)
      const d = dowMap[parts.find(p => p.type === 'weekday')?.value || 'Sun'];
      if (!byDow[d]) byDow[d] = emptySegment();
      addTrade(byDow[d], pnl, isWin);

      // By Hold Time (skip trades with null/undefined hold time)
      if (t.hold_time_minutes != null) {
        const hold = t.hold_time_minutes;
        const bk = hold <= 5 ? '0-5min' : hold <= 15 ? '5-15min' : hold <= 60 ? '15-60min' : hold <= 240 ? '1-4hr' : '4hr+';
        addTrade(byHoldTime[bk], pnl, isWin);
      }

      // By Symbol
      if (!bySymbol[t.symbol]) bySymbol[t.symbol] = emptySegment();
      addTrade(bySymbol[t.symbol], pnl, isWin);

      // By Price Tier
      const price = Number(t.entry_price);
      const tier = price < 5 ? 'Penny' : price < 20 ? 'Small' : price < 100 ? 'Mid' : 'Large';
      addTrade(byPriceTier[tier], pnl, isWin);

      // By Time of Day (Eastern)
      const todBucket = etTotalMinutes < 570 ? 'Pre-Market'
        : etTotalMinutes < 600 ? 'Open (9:30-10:00)'
        : etTotalMinutes < 720 ? 'Morning (10:00-12:00)'
        : 'Afternoon (12:00+)';
      addTrade(byTimeOfDay[todBucket], pnl, isWin);
    }

    return NextResponse.json({
      byHour, byDow, byHoldTime, bySymbol, byPriceTier, byTimeOfDay,
      totalTrades: allTrades.length, period,
    });
  } catch (err) {
    console.error('Scorecard error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
