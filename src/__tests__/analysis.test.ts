import { describe, it, expect } from 'vitest';
import { computeBaseline, getDataConfidenceLabel } from '@/lib/analysis/baseline';
import { detectPatterns } from '@/lib/analysis/patterns';
import { analyzeSession } from '@/lib/analysis/session';
import { computeScorecard } from '@/lib/analysis/scorecard';
import type { ParsedTrade, BaselineData } from '@/types';

// Helper to create a trade
function makeTrade(overrides: Partial<ParsedTrade> = {}): ParsedTrade {
  return {
    symbol: 'AAPL',
    direction: 'long',
    entryTime: new Date('2024-03-15T10:00:00'),
    exitTime: new Date('2024-03-15T10:30:00'),
    entryPrice: 170,
    exitPrice: 171,
    quantity: 100,
    totalCommission: 2,
    grossPnl: 100,
    netPnl: 98,
    pnlPercent: 0.5882,
    holdTimeMinutes: 30,
    positionValue: 17000,
    isOpen: false,
    executionHash: `hash-${Math.random()}`,
    executions: [],
    ...overrides,
  };
}

// Build a reasonable set of trades for baseline
function makeTradeSet(): ParsedTrade[] {
  const trades: ParsedTrade[] = [];
  // 20 trades across 4 days (5 per day avg)
  for (let day = 0; day < 4; day++) {
    for (let i = 0; i < 5; i++) {
      const hour = 9 + i;
      const date = new Date(2024, 2, 11 + day, hour, 30, 0);
      const isWin = Math.random() > 0.45;
      const pnl = isWin ? 50 + Math.random() * 200 : -(30 + Math.random() * 150);
      trades.push(
        makeTrade({
          entryTime: date,
          exitTime: new Date(date.getTime() + 25 * 60000),
          grossPnl: pnl + 2,
          netPnl: pnl,
          pnlPercent: (pnl / 17000) * 100,
          holdTimeMinutes: 25,
          positionValue: 17000,
        })
      );
    }
  }
  return trades;
}

describe('Baseline Computation', () => {
  it('should compute baselines from trades', () => {
    const trades = makeTradeSet();
    const baseline = computeBaseline(trades);

    expect(baseline.totalTradesAnalyzed).toBe(20);
    expect(baseline.avgTradesPerDay).toBe(5);
    expect(baseline.avgPositionSize).toBe(17000);
    expect(baseline.avgHoldTimeMinutes).toBe(25);
    expect(baseline.overallWinRate).toBeGreaterThan(0);
    expect(baseline.overallWinRate).toBeLessThan(1);
  });

  it('should return empty baseline for no trades', () => {
    const baseline = computeBaseline([]);
    expect(baseline.totalTradesAnalyzed).toBe(0);
    expect(baseline.avgTradesPerDay).toBe(0);
  });

  it('should skip open trades', () => {
    const trades = [makeTrade({ isOpen: true, netPnl: null })];
    const baseline = computeBaseline(trades);
    expect(baseline.totalTradesAnalyzed).toBe(0);
  });
});

describe('Data Confidence Labels', () => {
  it('should return correct labels', () => {
    expect(getDataConfidenceLabel(10)).toBe('insufficient');
    expect(getDataConfidenceLabel(15)).toBe('early');
    expect(getDataConfidenceLabel(50)).toBe('emerging');
    expect(getDataConfidenceLabel(100)).toBe('established');
    expect(getDataConfidenceLabel(500)).toBe('established');
  });
});

describe('Pattern Detection', () => {
  const baseBaseline: BaselineData = {
    avgTradesPerDay: 5,
    stddevTradesPerDay: 1.5,
    avgPositionSize: 10000,
    stddevPositionSize: 2000,
    avgHoldTimeMinutes: 30,
    avgTimeBetweenTradesMinutes: 20,
    avgWinningHoldTimeMinutes: 35,
    avgLosingHoldTimeMinutes: 15,
    overallWinRate: 0.48,
    totalTradesAnalyzed: 100,
    performanceByHour: {},
    performanceByDow: {},
  };

  describe('Overtrading', () => {
    it('should detect overtrading when trade count exceeds threshold', () => {
      // Threshold = 5 + 2*1.5 = 8, effective = max(8, 8) = 8
      const trades: ParsedTrade[] = [];
      for (let i = 0; i < 12; i++) {
        trades.push(
          makeTrade({
            entryTime: new Date(2024, 2, 15, 9 + Math.floor(i / 2), (i % 2) * 30, 0),
            exitTime: new Date(2024, 2, 15, 9 + Math.floor(i / 2), (i % 2) * 30 + 15, 0),
            holdTimeMinutes: 15,
            netPnl: i % 3 === 0 ? -50 : 30,
            grossPnl: i % 3 === 0 ? -48 : 32,
          })
        );
      }

      const patterns = detectPatterns(trades, baseBaseline);
      const overtrading = patterns.filter((p) => p.patternType === 'overtrading');
      expect(overtrading.length).toBeGreaterThan(0);
      expect(overtrading[0].confidence).toBe('high');
    });

    it('should not flag normal trade counts', () => {
      const trades: ParsedTrade[] = [];
      for (let i = 0; i < 5; i++) {
        trades.push(
          makeTrade({
            entryTime: new Date(2024, 2, 15, 9 + i, 0, 0),
            exitTime: new Date(2024, 2, 15, 9 + i, 30, 0),
          })
        );
      }

      const patterns = detectPatterns(trades, baseBaseline);
      const overtrading = patterns.filter((p) => p.patternType === 'overtrading');
      expect(overtrading).toHaveLength(0);
    });
  });

  describe('Size Escalation (Tilt)', () => {
    it('should detect size escalation after consecutive losses', () => {
      const trades = [
        makeTrade({
          entryTime: new Date(2024, 2, 15, 9, 30, 0),
          exitTime: new Date(2024, 2, 15, 9, 45, 0),
          netPnl: -100,
          grossPnl: -98,
          positionValue: 10000,
        }),
        makeTrade({
          entryTime: new Date(2024, 2, 15, 10, 0, 0),
          exitTime: new Date(2024, 2, 15, 10, 15, 0),
          netPnl: -80,
          grossPnl: -78,
          positionValue: 10000,
        }),
        makeTrade({
          entryTime: new Date(2024, 2, 15, 10, 20, 0),
          exitTime: new Date(2024, 2, 15, 10, 45, 0),
          netPnl: -200,
          grossPnl: -198,
          pnlPercent: -1.0,
          positionValue: 20000, // 2x normal size
        }),
      ];

      const patterns = detectPatterns(trades, baseBaseline);
      const tilt = patterns.filter((p) => p.patternType === 'size_escalation');
      expect(tilt.length).toBeGreaterThan(0);
      expect(tilt[0].confidence).toBe('high');
    });
  });

  describe('Rapid Re-entry (Revenge)', () => {
    it('should detect rapid re-entry after a loss', () => {
      const trades = [
        makeTrade({
          entryTime: new Date(2024, 2, 15, 10, 0, 0),
          exitTime: new Date(2024, 2, 15, 10, 15, 0),
          netPnl: -150,
          grossPnl: -148,
        }),
        makeTrade({
          entryTime: new Date(2024, 2, 15, 10, 18, 0), // 3 min after exit (< 20*0.4 = 8 min threshold)
          exitTime: new Date(2024, 2, 15, 10, 30, 0),
          netPnl: -200,
          grossPnl: -198,
        }),
      ];

      const patterns = detectPatterns(trades, baseBaseline);
      const revenge = patterns.filter((p) => p.patternType === 'rapid_reentry');
      expect(revenge.length).toBeGreaterThan(0);
      expect(revenge[0].confidence).toBe('medium');
    });

    it('should not flag after a win', () => {
      const trades = [
        makeTrade({
          entryTime: new Date(2024, 2, 15, 10, 0, 0),
          exitTime: new Date(2024, 2, 15, 10, 15, 0),
          netPnl: 150, // Win
          grossPnl: 152,
        }),
        makeTrade({
          entryTime: new Date(2024, 2, 15, 10, 18, 0),
          exitTime: new Date(2024, 2, 15, 10, 30, 0),
        }),
      ];

      const patterns = detectPatterns(trades, baseBaseline);
      const revenge = patterns.filter((p) => p.patternType === 'rapid_reentry');
      expect(revenge).toHaveLength(0);
    });
  });

  describe('Premature Profit Taking', () => {
    it('should detect early exits on winning trades', () => {
      const trades = [
        makeTrade({
          entryTime: new Date(2024, 2, 15, 10, 0, 0),
          exitTime: new Date(2024, 2, 15, 10, 5, 0),
          holdTimeMinutes: 5, // Far below 35 min average (< 35*0.4 = 14)
          netPnl: 50,
          grossPnl: 52,
        }),
      ];

      const patterns = detectPatterns(trades, baseBaseline);
      const premature = patterns.filter((p) => p.patternType === 'premature_exit');
      expect(premature.length).toBeGreaterThan(0);
      expect(premature[0].confidence).toBe('medium');
    });

    it('should not flag trades held to normal duration', () => {
      const trades = [
        makeTrade({
          holdTimeMinutes: 35,
          netPnl: 100,
          grossPnl: 102,
        }),
      ];

      const patterns = detectPatterns(trades, baseBaseline);
      const premature = patterns.filter((p) => p.patternType === 'premature_exit');
      expect(premature).toHaveLength(0);
    });
  });

  it('should return empty patterns when insufficient data', () => {
    const lowDataBaseline = { ...baseBaseline, totalTradesAnalyzed: 10 };
    const trades = [makeTrade()];
    const patterns = detectPatterns(trades, lowDataBaseline);
    expect(patterns).toHaveLength(0);
  });
});

describe('Session Analysis', () => {
  it('should compute session summary with patterns', () => {
    const baseline: BaselineData = {
      avgTradesPerDay: 5,
      stddevTradesPerDay: 1.5,
      avgPositionSize: 10000,
      stddevPositionSize: 2000,
      avgHoldTimeMinutes: 30,
      avgTimeBetweenTradesMinutes: 20,
      avgWinningHoldTimeMinutes: 35,
      avgLosingHoldTimeMinutes: 15,
      overallWinRate: 0.48,
      totalTradesAnalyzed: 100,
      performanceByHour: {},
      performanceByDow: {},
    };

    const trades = [
      makeTrade({ netPnl: 200, grossPnl: 202 }),
      makeTrade({ netPnl: -50, grossPnl: -48 }),
      makeTrade({ netPnl: 100, grossPnl: 102 }),
    ];

    const session = analyzeSession(trades, baseline, '2024-03-15');

    expect(session.totalTrades).toBe(3);
    expect(session.winningTrades).toBe(2);
    expect(session.losingTrades).toBe(1);
    expect(session.netPnl).toBe(250);
    expect(session.winRate).toBeCloseTo(0.6667, 3);
  });
});

describe('Edge Scorecard', () => {
  it('should compute scorecard entries', () => {
    const trades = makeTradeSet();
    const scorecard = computeScorecard(trades);

    expect(Object.keys(scorecard.byHour).length).toBeGreaterThan(0);
    expect(Object.keys(scorecard.byDow).length).toBeGreaterThan(0);
    expect(Object.keys(scorecard.byHoldTime).length).toBeGreaterThan(0);
    expect(Object.keys(scorecard.byTicker).length).toBeGreaterThan(0);
  });

  it('should handle empty trades', () => {
    const scorecard = computeScorecard([]);
    expect(Object.keys(scorecard.byHour)).toHaveLength(0);
    expect(scorecard.strengths).toHaveLength(0);
    expect(scorecard.leaks).toHaveLength(0);
  });
});
