import type { ParsedTrade, EdgeScorecard, ScoreEntry } from '@/types';

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const HOLD_TIME_BUCKETS: Record<string, [number, number]> = {
  'scalp (<5m)': [0, 5],
  'quick (5-15m)': [5, 15],
  'short (15-60m)': [15, 60],
  'medium (1-4h)': [60, 240],
  'swing (4h+)': [240, Infinity],
};

/**
 * Generate the Edge Scorecard — breakdown of performance by various dimensions.
 */
export function computeScorecard(trades: ParsedTrade[]): EdgeScorecard {
  const closed = trades.filter((t) => !t.isOpen && t.netPnl !== null);

  const byHour = computeByHour(closed);
  const byDow = computeByDow(closed);
  const byHoldTime = computeByHoldTime(closed);
  const byTicker = computeByTicker(closed);

  const strengths = findStrengths(byHour, byDow, byHoldTime, byTicker);
  const leaks = findLeaks(byHour, byDow, byHoldTime, byTicker);
  const doMore = generateDoMore(strengths);
  const doLess = generateDoLess(leaks);

  return { byHour, byDow, byHoldTime, byTicker, strengths, leaks, doMore, doLess };
}

function computeScoreEntry(trades: ParsedTrade[]): ScoreEntry {
  if (trades.length === 0) {
    return { trades: 0, winRate: 0, avgPnl: 0, totalPnl: 0, profitFactor: 0 };
  }

  const wins = trades.filter((t) => t.netPnl! > 0);
  const losses = trades.filter((t) => t.netPnl! <= 0);
  const totalPnl = trades.reduce((s, t) => s + t.netPnl!, 0);
  const grossWins = wins.reduce((s, t) => s + t.netPnl!, 0);
  const grossLosses = Math.abs(losses.reduce((s, t) => s + t.netPnl!, 0));

  return {
    trades: trades.length,
    winRate: Math.round((wins.length / trades.length) * 10000) / 10000,
    avgPnl: Math.round((totalPnl / trades.length) * 100) / 100,
    totalPnl: Math.round(totalPnl * 100) / 100,
    profitFactor: grossLosses > 0 ? Math.round((grossWins / grossLosses) * 100) / 100 : grossWins > 0 ? Infinity : 0,
  };
}

function computeByHour(trades: ParsedTrade[]): Record<string, ScoreEntry> {
  const groups: Record<string, ParsedTrade[]> = {};
  for (const t of trades) {
    const hour = t.entryTime.getHours().toString().padStart(2, '0');
    if (!groups[hour]) groups[hour] = [];
    groups[hour].push(t);
  }
  const result: Record<string, ScoreEntry> = {};
  for (const [key, group] of Object.entries(groups)) {
    result[key] = computeScoreEntry(group);
  }
  return result;
}

function computeByDow(trades: ParsedTrade[]): Record<string, ScoreEntry> {
  const groups: Record<string, ParsedTrade[]> = {};
  for (const t of trades) {
    const dow = DAY_NAMES[t.entryTime.getDay()];
    if (!groups[dow]) groups[dow] = [];
    groups[dow].push(t);
  }
  const result: Record<string, ScoreEntry> = {};
  for (const [key, group] of Object.entries(groups)) {
    result[key] = computeScoreEntry(group);
  }
  return result;
}

function computeByHoldTime(trades: ParsedTrade[]): Record<string, ScoreEntry> {
  const groups: Record<string, ParsedTrade[]> = {};
  for (const t of trades) {
    const mins = t.holdTimeMinutes || 0;
    for (const [bucket, [min, max]] of Object.entries(HOLD_TIME_BUCKETS)) {
      if (mins >= min && mins < max) {
        if (!groups[bucket]) groups[bucket] = [];
        groups[bucket].push(t);
        break;
      }
    }
  }
  const result: Record<string, ScoreEntry> = {};
  for (const [key, group] of Object.entries(groups)) {
    result[key] = computeScoreEntry(group);
  }
  return result;
}

function computeByTicker(trades: ParsedTrade[]): Record<string, ScoreEntry> {
  const groups: Record<string, ParsedTrade[]> = {};
  for (const t of trades) {
    if (!groups[t.symbol]) groups[t.symbol] = [];
    groups[t.symbol].push(t);
  }
  const result: Record<string, ScoreEntry> = {};
  for (const [key, group] of Object.entries(groups)) {
    result[key] = computeScoreEntry(group);
  }
  return result;
}

interface RankedEntry {
  label: string;
  dimension: string;
  entry: ScoreEntry;
}

function findStrengths(
  byHour: Record<string, ScoreEntry>,
  byDow: Record<string, ScoreEntry>,
  byHoldTime: Record<string, ScoreEntry>,
  byTicker: Record<string, ScoreEntry>
): string[] {
  const all: RankedEntry[] = [];

  for (const [k, v] of Object.entries(byHour)) {
    if (v.trades >= 3) all.push({ label: `${k}:00 hour`, dimension: 'hour', entry: v });
  }
  for (const [k, v] of Object.entries(byDow)) {
    if (v.trades >= 3) all.push({ label: `${k.charAt(0).toUpperCase() + k.slice(1)}s`, dimension: 'dow', entry: v });
  }
  for (const [k, v] of Object.entries(byHoldTime)) {
    if (v.trades >= 3) all.push({ label: `${k} hold time`, dimension: 'holdTime', entry: v });
  }
  for (const [k, v] of Object.entries(byTicker)) {
    if (v.trades >= 3) all.push({ label: k, dimension: 'ticker', entry: v });
  }

  return all
    .filter((a) => a.entry.totalPnl > 0 && a.entry.winRate > 0.5)
    .sort((a, b) => b.entry.totalPnl - a.entry.totalPnl)
    .slice(0, 3)
    .map(
      (a) =>
        `${a.label}: ${a.entry.trades} trades, ${Math.round(a.entry.winRate * 100)}% win rate, +$${a.entry.totalPnl.toFixed(0)} total`
    );
}

function findLeaks(
  byHour: Record<string, ScoreEntry>,
  byDow: Record<string, ScoreEntry>,
  byHoldTime: Record<string, ScoreEntry>,
  byTicker: Record<string, ScoreEntry>
): string[] {
  const all: RankedEntry[] = [];

  for (const [k, v] of Object.entries(byHour)) {
    if (v.trades >= 3) all.push({ label: `${k}:00 hour`, dimension: 'hour', entry: v });
  }
  for (const [k, v] of Object.entries(byDow)) {
    if (v.trades >= 3) all.push({ label: `${k.charAt(0).toUpperCase() + k.slice(1)}s`, dimension: 'dow', entry: v });
  }
  for (const [k, v] of Object.entries(byHoldTime)) {
    if (v.trades >= 3) all.push({ label: `${k} hold time`, dimension: 'holdTime', entry: v });
  }
  for (const [k, v] of Object.entries(byTicker)) {
    if (v.trades >= 3) all.push({ label: k, dimension: 'ticker', entry: v });
  }

  return all
    .filter((a) => a.entry.totalPnl < 0)
    .sort((a, b) => a.entry.totalPnl - b.entry.totalPnl) // Most negative first
    .slice(0, 3)
    .map(
      (a) =>
        `${a.label}: ${a.entry.trades} trades, ${Math.round(a.entry.winRate * 100)}% win rate, -$${Math.abs(a.entry.totalPnl).toFixed(0)} total`
    );
}

function generateDoMore(strengths: string[]): string[] {
  return strengths.map((s) => `Do more: ${s}`);
}

function generateDoLess(leaks: string[]): string[] {
  return leaks.map((l) => `Do less: ${l}`);
}
