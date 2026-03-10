import type { ParsedTrade, BaselineData } from '@/types';

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Compute trader baselines from their historical trades.
 * All pattern detection is relative to these personal baselines.
 */
export function computeBaseline(trades: ParsedTrade[]): BaselineData {
  const closedTrades = trades.filter((t) => !t.isOpen && t.netPnl !== null);

  if (closedTrades.length === 0) {
    return emptyBaseline();
  }

  // Group trades by date for per-day metrics
  const tradesByDate = groupByDate(closedTrades);
  const tradingDays = Object.keys(tradesByDate);
  const tradesPerDay = tradingDays.map((d) => tradesByDate[d].length);

  // Trades per day stats
  const avgTradesPerDay = mean(tradesPerDay);
  const stddevTradesPerDay = stddev(tradesPerDay);

  // Position sizes
  const positionSizes = closedTrades.map((t) => t.positionValue);
  const avgPositionSize = mean(positionSizes);
  const stddevPositionSize = stddev(positionSizes);

  // Hold times
  const holdTimes = closedTrades
    .filter((t) => t.holdTimeMinutes !== null)
    .map((t) => t.holdTimeMinutes!);
  const avgHoldTimeMinutes = holdTimes.length > 0 ? mean(holdTimes) : 0;

  // Time between trades (per session)
  const timeBetweenTrades = computeTimeBetweenTrades(closedTrades);
  const avgTimeBetweenTradesMinutes =
    timeBetweenTrades.length > 0 ? mean(timeBetweenTrades) : 0;

  // Hold times by win/loss
  const winners = closedTrades.filter((t) => t.netPnl! > 0);
  const losers = closedTrades.filter((t) => t.netPnl! <= 0);

  const winningHoldTimes = winners
    .filter((t) => t.holdTimeMinutes !== null)
    .map((t) => t.holdTimeMinutes!);
  const losingHoldTimes = losers
    .filter((t) => t.holdTimeMinutes !== null)
    .map((t) => t.holdTimeMinutes!);

  const avgWinningHoldTimeMinutes =
    winningHoldTimes.length > 0 ? mean(winningHoldTimes) : 0;
  const avgLosingHoldTimeMinutes =
    losingHoldTimes.length > 0 ? mean(losingHoldTimes) : 0;

  // Win rate
  const overallWinRate =
    closedTrades.length > 0 ? winners.length / closedTrades.length : 0;

  // Performance by hour
  const performanceByHour = computePerformanceByHour(closedTrades);

  // Performance by day of week
  const performanceByDow = computePerformanceByDow(closedTrades);

  return {
    avgTradesPerDay,
    stddevTradesPerDay,
    avgPositionSize,
    stddevPositionSize,
    avgHoldTimeMinutes,
    avgTimeBetweenTradesMinutes,
    avgWinningHoldTimeMinutes,
    avgLosingHoldTimeMinutes,
    overallWinRate,
    totalTradesAnalyzed: closedTrades.length,
    performanceByHour,
    performanceByDow,
  };
}

/**
 * Determine the confidence label based on total trade count.
 */
export function getDataConfidenceLabel(totalTrades: number): string {
  if (totalTrades < 15) return 'insufficient';
  if (totalTrades < 30) return 'early';
  if (totalTrades < 100) return 'emerging';
  return 'established';
}

function groupByDate(
  trades: ParsedTrade[]
): Record<string, ParsedTrade[]> {
  const groups: Record<string, ParsedTrade[]> = {};
  for (const trade of trades) {
    const date = trade.entryTime.toISOString().split('T')[0];
    if (!groups[date]) groups[date] = [];
    groups[date].push(trade);
  }
  return groups;
}

function computeTimeBetweenTrades(trades: ParsedTrade[]): number[] {
  const sorted = [...trades].sort(
    (a, b) => a.entryTime.getTime() - b.entryTime.getTime()
  );

  const gaps: number[] = [];
  const byDate = groupByDate(sorted);

  for (const dateTrades of Object.values(byDate)) {
    const dayTrades = [...dateTrades].sort(
      (a, b) => a.entryTime.getTime() - b.entryTime.getTime()
    );
    for (let i = 1; i < dayTrades.length; i++) {
      const prev = dayTrades[i - 1];
      const curr = dayTrades[i];
      const prevEnd = prev.exitTime || prev.entryTime;
      const gap = (curr.entryTime.getTime() - prevEnd.getTime()) / 60000;
      if (gap > 0) gaps.push(gap);
    }
  }

  return gaps;
}

function computePerformanceByHour(
  trades: ParsedTrade[]
): Record<string, { trades: number; winRate: number; avgPnl: number; totalPnl: number }> {
  const byHour: Record<string, ParsedTrade[]> = {};

  for (const trade of trades) {
    const hour = trade.entryTime.getHours().toString().padStart(2, '0');
    if (!byHour[hour]) byHour[hour] = [];
    byHour[hour].push(trade);
  }

  const result: Record<string, { trades: number; winRate: number; avgPnl: number; totalPnl: number }> = {};
  for (const [hour, hourTrades] of Object.entries(byHour)) {
    const wins = hourTrades.filter((t) => t.netPnl! > 0).length;
    const pnls = hourTrades.map((t) => t.netPnl!);
    result[hour] = {
      trades: hourTrades.length,
      winRate: hourTrades.length > 0 ? wins / hourTrades.length : 0,
      avgPnl: mean(pnls),
      totalPnl: sum(pnls),
    };
  }

  return result;
}

function computePerformanceByDow(
  trades: ParsedTrade[]
): Record<string, { trades: number; winRate: number; avgPnl: number; totalPnl: number }> {
  const byDow: Record<string, ParsedTrade[]> = {};

  for (const trade of trades) {
    const dow = DAY_NAMES[trade.entryTime.getDay()];
    if (!byDow[dow]) byDow[dow] = [];
    byDow[dow].push(trade);
  }

  const result: Record<string, { trades: number; winRate: number; avgPnl: number; totalPnl: number }> = {};
  for (const [dow, dowTrades] of Object.entries(byDow)) {
    const wins = dowTrades.filter((t) => t.netPnl! > 0).length;
    const pnls = dowTrades.map((t) => t.netPnl!);
    result[dow] = {
      trades: dowTrades.length,
      winRate: dowTrades.length > 0 ? wins / dowTrades.length : 0,
      avgPnl: mean(pnls),
      totalPnl: sum(pnls),
    };
  }

  return result;
}

function emptyBaseline(): BaselineData {
  return {
    avgTradesPerDay: 0,
    stddevTradesPerDay: 0,
    avgPositionSize: 0,
    stddevPositionSize: 0,
    avgHoldTimeMinutes: 0,
    avgTimeBetweenTradesMinutes: 0,
    avgWinningHoldTimeMinutes: 0,
    avgLosingHoldTimeMinutes: 0,
    overallWinRate: 0,
    totalTradesAnalyzed: 0,
    performanceByHour: {},
    performanceByDow: {},
  };
}

// --- Math utilities ---

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return sum(values) / values.length;
}

function sum(values: number[]): number {
  return values.reduce((s, v) => s + v, 0);
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map((v) => (v - avg) ** 2);
  return Math.sqrt(mean(squaredDiffs));
}
