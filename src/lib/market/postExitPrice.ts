import type { PostExitData } from '@/types';

interface ChartQuote {
  date: Date | null;
  close: number | null;
  high: number | null;
  low: number | null;
}

/**
 * Fetch post-exit price data for a stock using yahoo-finance2.
 * Returns hourly price snapshots for 4 hours after exit, plus max move info.
 * Returns null silently if data is unavailable.
 */
export async function getPostExitPriceData(
  symbol: string,
  exitTime: Date
): Promise<PostExitData | null> {
  try {
    // yahoo-finance2 only has intraday data for ~730 days
    const daysSinceExit = (Date.now() - exitTime.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceExit > 730) return null;

    // Dynamic import — server-side only. v3 requires instantiation.
    const YahooFinance = (await import('yahoo-finance2')).default;
    const yf = new YahooFinance();

    const period1 = exitTime;
    const period2 = new Date(exitTime.getTime() + 4 * 60 * 60 * 1000); // +4 hours

    const result = await yf.chart(symbol, {
      period1,
      period2,
      interval: '1h',
    });

    const quotes = (result.quotes ?? []) as ChartQuote[];
    if (quotes.length === 0) return null;

    // Exit price is the close of the first bar (closest to exit time)
    const exitPrice = quotes[0].close;
    if (exitPrice == null) return null;

    // Find prices at ~1h, ~2h, ~4h after exit
    const priceAt1h = findPriceAtOffset(quotes, exitTime, 1);
    const priceAt2h = findPriceAtOffset(quotes, exitTime, 2);
    const priceAt4h = findPriceAtOffset(quotes, exitTime, 4);

    // Compute max move from exit price across all bars
    let maxHigh = exitPrice;
    let minLow = exitPrice;
    for (const q of quotes) {
      if (q.high != null && q.high > maxHigh) maxHigh = q.high;
      if (q.low != null && q.low < minLow) minLow = q.low;
    }

    const upMove = ((maxHigh - exitPrice) / exitPrice) * 100;
    const downMove = ((exitPrice - minLow) / exitPrice) * 100;
    const maxMovePercent = Math.round(Math.max(upMove, downMove) * 100) / 100;

    let direction: 'up' | 'down' | 'flat';
    if (upMove > downMove && upMove > 0.05) {
      direction = 'up';
    } else if (downMove > upMove && downMove > 0.05) {
      direction = 'down';
    } else {
      direction = 'flat';
    }

    return {
      exitPrice,
      priceAt1h,
      priceAt2h,
      priceAt4h,
      maxMovePercent,
      direction,
    };
  } catch {
    // Never crash — data unavailability is expected for many cases
    return null;
  }
}

function findPriceAtOffset(
  quotes: ChartQuote[],
  exitTime: Date,
  hoursAfter: number
): number | null {
  const targetTime = exitTime.getTime() + hoursAfter * 60 * 60 * 1000;

  let closest: ChartQuote | null = null;
  let closestDiff = Infinity;

  for (const q of quotes) {
    if (q.date == null || q.close == null) continue;
    const diff = Math.abs(q.date.getTime() - targetTime);
    // Only consider bars within 30 minutes of the target
    if (diff < closestDiff && diff <= 30 * 60 * 1000) {
      closest = q;
      closestDiff = diff;
    }
  }

  return closest?.close ?? null;
}
