import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseSchwabCSV, parseTDAmeritradeCSV, parseWebullCSV, parseTradeCSV } from '@/lib/parsers';
import { detectPatterns } from '@/lib/analysis/patterns';
import { computeBaseline } from '@/lib/analysis/baseline';
import type { ParsedTrade } from '@/types';

const FIXTURES_DIR = resolve(__dirname, '../../tickets');

// ---------------------------------------------------------------------------
// Helper: group trades by ISO week (Mon-Fri boundaries)
// ---------------------------------------------------------------------------
function getWeekKey(date: Date): string {
  // Find the Monday of the week containing this date
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // Shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0]; // Return Monday's date as the key
}

function groupTradesByWeek(trades: ParsedTrade[]): Map<string, ParsedTrade[]> {
  const weeks = new Map<string, ParsedTrade[]>();
  for (const trade of trades) {
    const key = getWeekKey(trade.entryTime);
    const group = weeks.get(key) || [];
    group.push(trade);
    weeks.set(key, group);
  }
  return weeks;
}

// ---------------------------------------------------------------------------
// 1. Schwab Week (Mar 30 - Apr 3)
// ---------------------------------------------------------------------------
describe('Schwab Week (Mar 30 - Apr 3)', () => {
  const csv = readFileSync(resolve(FIXTURES_DIR, 'test_schwab_week1.csv'), 'utf-8');
  const result = parseSchwabCSV(csv);

  it('should parse without errors', () => {
    expect(result.errors).toHaveLength(0);
  });

  it('should produce 10 round-trip trades', () => {
    const closedTrades = result.trades.filter((t) => !t.isOpen);
    expect(closedTrades).toHaveLength(10);
  });

  it('should have correct win/loss counts (6W/4L)', () => {
    const closedTrades = result.trades.filter((t) => !t.isOpen);
    const wins = closedTrades.filter((t) => (t.netPnl ?? 0) > 0).length;
    const losses = closedTrades.filter((t) => (t.netPnl ?? 0) <= 0).length;
    expect(wins).toBe(6);
    expect(losses).toBe(4);
  });

  it('should have GOOG with size escalation pattern (10 -> 20 shares after loss)', () => {
    const googTrades = result.trades
      .filter((t) => t.symbol === 'GOOG' && !t.isOpen)
      .sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());

    expect(googTrades).toHaveLength(2);
    expect(googTrades[0].quantity).toBe(10);
    expect(googTrades[1].quantity).toBe(20);
    // First trade must be a loss (prerequisite for size escalation)
    expect(googTrades[0].netPnl).toBeLessThan(0);
    // Position size doubled (escalation)
    expect(googTrades[1].positionValue).toBeGreaterThan(googTrades[0].positionValue * 1.5);
  });

  it('should have hasEstimatedTimes set to true in metadata', () => {
    expect(result.metadata.hasEstimatedTimes).toBe(true);
  });

  it('should mark all trades with isEstimatedTime', () => {
    for (const trade of result.trades) {
      expect(trade.isEstimatedTime).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. TDA Week (Apr 6 - Apr 10)
// ---------------------------------------------------------------------------
describe('TDA Week (Apr 6 - Apr 10)', () => {
  const csv = readFileSync(resolve(FIXTURES_DIR, 'test_tda_week2.csv'), 'utf-8');
  const result = parseTDAmeritradeCSV(csv);

  it('should parse without errors', () => {
    expect(result.errors).toHaveLength(0);
  });

  it('should produce 10 round-trip trades', () => {
    const closedTrades = result.trades.filter((t) => !t.isOpen);
    expect(closedTrades).toHaveLength(10);
  });

  it('should have NFLX with 2 trades (10 -> 20 shares, both losses = size escalation)', () => {
    const nflxTrades = result.trades
      .filter((t) => t.symbol === 'NFLX' && !t.isOpen)
      .sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());

    expect(nflxTrades).toHaveLength(2);
    expect(nflxTrades[0].quantity).toBe(10);
    expect(nflxTrades[1].quantity).toBe(20);
    expect(nflxTrades[0].netPnl).toBeLessThan(0);
    expect(nflxTrades[1].netPnl).toBeLessThan(0);
  });

  it('should have SNAP with 2 trades (80 -> 150 shares, both losses = size escalation)', () => {
    const snapTrades = result.trades
      .filter((t) => t.symbol === 'SNAP' && !t.isOpen)
      .sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());

    expect(snapTrades).toHaveLength(2);
    expect(snapTrades[0].quantity).toBe(80);
    expect(snapTrades[1].quantity).toBe(150);
    expect(snapTrades[0].netPnl).toBeLessThan(0);
    expect(snapTrades[1].netPnl).toBeLessThan(0);
  });

  it('should have hasEstimatedTimes set to true', () => {
    expect(result.metadata.hasEstimatedTimes).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Webull Week (Apr 13 - Apr 17)
// ---------------------------------------------------------------------------
describe('Webull Week (Apr 13 - Apr 17)', () => {
  const csv = readFileSync(resolve(FIXTURES_DIR, 'test_webull_week3.csv'), 'utf-8');
  const result = parseWebullCSV(csv);

  it('should parse without errors', () => {
    expect(result.errors).toHaveLength(0);
  });

  it('should produce 10 round-trip trades', () => {
    const closedTrades = result.trades.filter((t) => !t.isOpen);
    expect(closedTrades).toHaveLength(10);
  });

  it('should have HOOD with 2 trades (70 -> 120 shares, size escalation)', () => {
    const hoodTrades = result.trades
      .filter((t) => t.symbol === 'HOOD' && !t.isOpen)
      .sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());

    expect(hoodTrades).toHaveLength(2);
    expect(hoodTrades[0].quantity).toBe(70);
    expect(hoodTrades[1].quantity).toBe(120);
    // First trade is a loss, followed by size increase
    expect(hoodTrades[0].netPnl).toBeLessThan(0);
    expect(hoodTrades[1].positionValue).toBeGreaterThan(hoodTrades[0].positionValue * 1.5);
  });

  it('should have BA with 2 trades (8 -> 15 shares, both losses = size escalation)', () => {
    const baTrades = result.trades
      .filter((t) => t.symbol === 'BA' && !t.isOpen)
      .sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());

    expect(baTrades).toHaveLength(2);
    expect(baTrades[0].quantity).toBe(8);
    expect(baTrades[1].quantity).toBe(15);
    expect(baTrades[0].netPnl).toBeLessThan(0);
    expect(baTrades[1].netPnl).toBeLessThan(0);
  });

  it('should preserve real timestamps (no isEstimatedTime)', () => {
    // Webull provides real timestamps, so isEstimatedTime should not be set
    for (const trade of result.trades) {
      expect(trade.isEstimatedTime).toBeUndefined();
    }
    expect(result.metadata.hasEstimatedTimes).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Unknown Broker Week (Apr 20 - Apr 24)
// ---------------------------------------------------------------------------
describe('Unknown Broker Week (Apr 20 - Apr 24)', () => {
  const csv = readFileSync(resolve(FIXTURES_DIR, 'test_unknown_broker_week4.csv'), 'utf-8');
  const result = parseTradeCSV(csv);

  it('should parse without errors', () => {
    expect(result.errors).toHaveLength(0);
  });

  it('should produce 9 round-trip trades', () => {
    const closedTrades = result.trades.filter((t) => !t.isOpen);
    expect(closedTrades).toHaveLength(9);
  });

  it('should have GOOG with 2 trades (15 -> 30 shares, both losses)', () => {
    const googTrades = result.trades
      .filter((t) => t.symbol === 'GOOG' && !t.isOpen)
      .sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());

    expect(googTrades).toHaveLength(2);
    expect(googTrades[0].quantity).toBe(15);
    expect(googTrades[1].quantity).toBe(30);
    expect(googTrades[0].netPnl).toBeLessThan(0);
    expect(googTrades[1].netPnl).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Cross-broker grouping by week
// ---------------------------------------------------------------------------
describe('Cross-broker weekly grouping', () => {
  const schwabCsv = readFileSync(resolve(FIXTURES_DIR, 'test_schwab_week1.csv'), 'utf-8');
  const tdaCsv = readFileSync(resolve(FIXTURES_DIR, 'test_tda_week2.csv'), 'utf-8');
  const webullCsv = readFileSync(resolve(FIXTURES_DIR, 'test_webull_week3.csv'), 'utf-8');
  const unknownCsv = readFileSync(resolve(FIXTURES_DIR, 'test_unknown_broker_week4.csv'), 'utf-8');

  const schwabResult = parseSchwabCSV(schwabCsv);
  const tdaResult = parseTDAmeritradeCSV(tdaCsv);
  const webullResult = parseWebullCSV(webullCsv);
  const unknownResult = parseTradeCSV(unknownCsv);

  const allTrades = [
    ...schwabResult.trades,
    ...tdaResult.trades,
    ...webullResult.trades,
    ...unknownResult.trades,
  ].filter((t) => !t.isOpen);

  const weeklyGroups = groupTradesByWeek(allTrades);

  it('should have 4 distinct weeks', () => {
    expect(weeklyGroups.size).toBe(4);
  });

  it('should have 10 trades in Schwab week (Mar 30)', () => {
    // Mar 30, 2026 is a Monday
    const weekTrades = weeklyGroups.get('2026-03-30');
    expect(weekTrades).toBeDefined();
    expect(weekTrades!.length).toBe(10);
  });

  it('should have 10 trades in TDA week (Apr 6)', () => {
    // Apr 6, 2026 is a Monday
    const weekTrades = weeklyGroups.get('2026-04-06');
    expect(weekTrades).toBeDefined();
    expect(weekTrades!.length).toBe(10);
  });

  it('should have 10 trades in Webull week (Apr 13)', () => {
    // Apr 13, 2026 is a Monday
    const weekTrades = weeklyGroups.get('2026-04-13');
    expect(weekTrades).toBeDefined();
    expect(weekTrades!.length).toBe(10);
  });

  it('should have 9 trades in Unknown broker week (Apr 20)', () => {
    // Apr 20, 2026 is a Monday
    const weekTrades = weeklyGroups.get('2026-04-20');
    expect(weekTrades).toBeDefined();
    expect(weekTrades!.length).toBe(9);
  });

  it('should have 39 total trades across all weeks', () => {
    expect(allTrades.length).toBe(39);
  });
});

// ---------------------------------------------------------------------------
// 6. Pattern detection across all combined trades
// ---------------------------------------------------------------------------
describe('Pattern detection across all brokers', () => {
  const schwabCsv = readFileSync(resolve(FIXTURES_DIR, 'test_schwab_week1.csv'), 'utf-8');
  const tdaCsv = readFileSync(resolve(FIXTURES_DIR, 'test_tda_week2.csv'), 'utf-8');
  const webullCsv = readFileSync(resolve(FIXTURES_DIR, 'test_webull_week3.csv'), 'utf-8');
  const unknownCsv = readFileSync(resolve(FIXTURES_DIR, 'test_unknown_broker_week4.csv'), 'utf-8');

  const schwabResult = parseSchwabCSV(schwabCsv);
  const tdaResult = parseTDAmeritradeCSV(tdaCsv);
  const webullResult = parseWebullCSV(webullCsv);
  const unknownResult = parseTradeCSV(unknownCsv);

  const allTrades = [
    ...schwabResult.trades,
    ...tdaResult.trades,
    ...webullResult.trades,
    ...unknownResult.trades,
  ].filter((t) => !t.isOpen);

  // Sort chronologically for pattern detection
  allTrades.sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());

  const baseline = computeBaseline(allTrades);
  const patterns = detectPatterns(allTrades, baseline);

  it('should have enough trades for baseline computation', () => {
    expect(baseline.totalTradesAnalyzed).toBeGreaterThanOrEqual(5);
    expect(baseline.totalTradesAnalyzed).toBe(39);
  });

  it('should detect size_escalation patterns', () => {
    const sizeEscalations = patterns.filter((p) => p.patternType === 'size_escalation');
    expect(sizeEscalations.length).toBeGreaterThanOrEqual(1);
  });

  it('should detect size_escalation for GOOG (Schwab week)', () => {
    const sizeEscalations = patterns.filter((p) => p.patternType === 'size_escalation');
    const googEscalation = sizeEscalations.find((p) => {
      const triggerTrade = allTrades[p.triggerTradeIndex];
      return triggerTrade?.symbol === 'GOOG' &&
        triggerTrade.entryTime.getMonth() === 3 && // April (0-indexed)
        triggerTrade.entryTime.getDate() === 2;     // Apr 2 (Schwab week)
    });
    expect(googEscalation).toBeDefined();
  });

  it('should detect size_escalation for NFLX (TDA week)', () => {
    const sizeEscalations = patterns.filter((p) => p.patternType === 'size_escalation');
    const nflxEscalation = sizeEscalations.find((p) => {
      const triggerTrade = allTrades[p.triggerTradeIndex];
      return triggerTrade?.symbol === 'NFLX';
    });
    expect(nflxEscalation).toBeDefined();
  });

  it('should detect size_escalation for SNAP (TDA week)', () => {
    const sizeEscalations = patterns.filter((p) => p.patternType === 'size_escalation');
    const snapEscalation = sizeEscalations.find((p) => {
      const triggerTrade = allTrades[p.triggerTradeIndex];
      return triggerTrade?.symbol === 'SNAP';
    });
    expect(snapEscalation).toBeDefined();
  });

  it('should detect size_escalation for HOOD (Webull week)', () => {
    const sizeEscalations = patterns.filter((p) => p.patternType === 'size_escalation');
    const hoodEscalation = sizeEscalations.find((p) => {
      const triggerTrade = allTrades[p.triggerTradeIndex];
      return triggerTrade?.symbol === 'HOOD';
    });
    expect(hoodEscalation).toBeDefined();
  });

  it('should detect size_escalation for BA (Webull week)', () => {
    const sizeEscalations = patterns.filter((p) => p.patternType === 'size_escalation');
    const baEscalation = sizeEscalations.find((p) => {
      const triggerTrade = allTrades[p.triggerTradeIndex];
      return triggerTrade?.symbol === 'BA';
    });
    expect(baEscalation).toBeDefined();
  });

  it('should have reduced confidence for time-based patterns on estimated-time trades', () => {
    // Some trades have estimated times (Schwab, TDA), so time-dependent patterns
    // (rapid_reentry, premature_exit) should have confidence reduced to 'medium'
    const timePatterns = patterns.filter(
      (p) => p.patternType === 'rapid_reentry' || p.patternType === 'premature_exit'
    );
    for (const p of timePatterns) {
      expect(p.confidence).toBe('medium');
    }
  });
});
