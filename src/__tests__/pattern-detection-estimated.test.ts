import { describe, it, expect } from 'vitest';
import { detectPatterns } from '@/lib/analysis/patterns';
import type { ParsedTrade, BaselineData } from '@/types';

// Helper to create a trade with estimated timestamps
function makeTrade(overrides: Partial<ParsedTrade> = {}): ParsedTrade {
  return {
    symbol: 'AAPL',
    direction: 'long',
    entryTime: new Date('2026-03-30T09:30:00'),
    exitTime: new Date('2026-03-30T10:00:00'),
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

// Baseline with large avg time between trades and large avg winning hold time
// so that estimated 30min timestamps trigger rapid_reentry and premature_exit
const baselineForEstimated: BaselineData = {
  avgTradesPerDay: 3,
  stddevTradesPerDay: 1,
  avgPositionSize: 2000,
  stddevPositionSize: 500,
  avgHoldTimeMinutes: 120,
  avgTimeBetweenTradesMinutes: 120, // rapidThreshold = max(120*0.4, 5) = 48 min
  avgWinningHoldTimeMinutes: 120, // holdThreshold = 120*0.4 = 48 min
  avgLosingHoldTimeMinutes: 60,
  overallWinRate: 0.50,
  totalTradesAnalyzed: 100,
  performanceByHour: {},
  performanceByDow: {},
};

describe('Pattern Detection with Estimated Timestamps', () => {
  describe('Confidence reduction for time-dependent patterns', () => {
    it('should mark rapid_reentry as medium confidence with broker note for estimated timestamps', () => {
      const trades: ParsedTrade[] = [
        makeTrade({
          symbol: 'GOOG',
          entryTime: new Date('2026-04-02T09:30:00'),
          exitTime: new Date('2026-04-02T10:00:00'),
          entryPrice: 179.40,
          exitPrice: 178.10,
          quantity: 10,
          totalCommission: 0.02,
          grossPnl: -13,
          netPnl: -13.02,
          pnlPercent: -0.72,
          holdTimeMinutes: 30,
          positionValue: 1794,
          executionHash: 'hash-rr1',
          isEstimatedTime: true,
        }),
        makeTrade({
          symbol: 'GOOG',
          entryTime: new Date('2026-04-02T10:30:00'),
          exitTime: new Date('2026-04-02T11:00:00'),
          entryPrice: 177.80,
          exitPrice: 176.25,
          quantity: 20,
          totalCommission: 0.02,
          grossPnl: -31,
          netPnl: -31.02,
          pnlPercent: -0.87,
          holdTimeMinutes: 30,
          positionValue: 3556,
          executionHash: 'hash-rr2',
          isEstimatedTime: true,
        }),
      ];

      const patterns = detectPatterns(trades, baselineForEstimated);
      const rapidReentry = patterns.filter((p) => p.patternType === 'rapid_reentry');

      expect(rapidReentry.length).toBeGreaterThan(0);
      expect(rapidReentry[0].confidence).toBe('medium');
      expect(rapidReentry[0].description).toContain(
        'Confidence reduced'
      );
      expect(rapidReentry[0].description).toContain(
        'exact execution times unavailable'
      );
    });

    it('should mark premature_exit as medium confidence with broker note for estimated timestamps', () => {
      // A winning trade with 30min hold when avg winning hold is 120min
      // holdThreshold = 120*0.4 = 48 min, 30 < 48 → triggers
      const trades: ParsedTrade[] = [
        makeTrade({
          symbol: 'AAPL',
          entryTime: new Date('2026-03-30T09:30:00'),
          exitTime: new Date('2026-03-30T10:00:00'),
          entryPrice: 178.50,
          exitPrice: 181.20,
          quantity: 20,
          totalCommission: 0.02,
          grossPnl: 54,
          netPnl: 53.98,
          pnlPercent: 1.51,
          holdTimeMinutes: 30,
          positionValue: 3570,
          executionHash: 'hash-pe1',
          isEstimatedTime: true,
        }),
      ];

      const patterns = detectPatterns(trades, baselineForEstimated);
      const prematureExit = patterns.filter((p) => p.patternType === 'premature_exit');

      expect(prematureExit.length).toBeGreaterThan(0);
      expect(prematureExit[0].confidence).toBe('medium');
      expect(prematureExit[0].description).toContain(
        'Confidence reduced'
      );
      expect(prematureExit[0].description).toContain(
        'exact execution times unavailable'
      );
    });

    it('should keep overtrading at high confidence even with estimated timestamps', () => {
      // 10 trades in one day, threshold = max(3 + 2*1 = 5, 3+3 = 6) = 6
      const trades: ParsedTrade[] = [];
      for (let i = 0; i < 10; i++) {
        trades.push(
          makeTrade({
            entryTime: new Date(2026, 3, 2, 9 + Math.floor(i / 2), (i % 2) * 30, 0),
            exitTime: new Date(2026, 3, 2, 9 + Math.floor(i / 2), (i % 2) * 30 + 25, 0),
            holdTimeMinutes: 25,
            netPnl: i % 3 === 0 ? -50 : 30,
            grossPnl: i % 3 === 0 ? -48 : 32,
            executionHash: `hash-ot-${i}`,
            isEstimatedTime: true,
          })
        );
      }

      const patterns = detectPatterns(trades, baselineForEstimated);
      const overtrading = patterns.filter((p) => p.patternType === 'overtrading');

      expect(overtrading.length).toBeGreaterThan(0);
      expect(overtrading[0].confidence).toBe('high');
      // Should NOT contain estimated time note
      expect(overtrading[0].description).not.toContain('Confidence reduced');
    });

    it('should keep size_escalation at high confidence even with estimated timestamps', () => {
      const trades: ParsedTrade[] = [
        makeTrade({
          symbol: 'GOOG',
          entryTime: new Date('2026-04-02T09:30:00'),
          exitTime: new Date('2026-04-02T10:00:00'),
          entryPrice: 179.40,
          exitPrice: 178.10,
          quantity: 10,
          totalCommission: 0.02,
          grossPnl: -13,
          netPnl: -13.02,
          pnlPercent: -0.72,
          holdTimeMinutes: 30,
          positionValue: 1794,
          executionHash: 'hash-se1',
          isEstimatedTime: true,
        }),
        makeTrade({
          symbol: 'GOOG',
          entryTime: new Date('2026-04-02T10:30:00'),
          exitTime: new Date('2026-04-02T11:00:00'),
          entryPrice: 177.80,
          exitPrice: 176.25,
          quantity: 20,
          totalCommission: 0.02,
          grossPnl: -31,
          netPnl: -31.02,
          pnlPercent: -0.87,
          holdTimeMinutes: 30,
          positionValue: 3556,
          executionHash: 'hash-se2',
          isEstimatedTime: true,
        }),
      ];

      const patterns = detectPatterns(trades, baselineForEstimated);
      const sizeEscalation = patterns.filter((p) => p.patternType === 'size_escalation');

      expect(sizeEscalation.length).toBeGreaterThan(0);
      expect(sizeEscalation[0].confidence).toBe('high');
      // Should NOT contain estimated time note
      expect(sizeEscalation[0].description).not.toContain('Confidence reduced');
    });
  });

  describe('Size escalation detection with estimated timestamps', () => {
    it('should detect GOOG 10→20 shares after loss (Schwab scenario)', () => {
      const trades: ParsedTrade[] = [
        // Trade 1: AAPL win
        makeTrade({
          symbol: 'AAPL',
          entryTime: new Date('2026-03-30T09:30:00'),
          exitTime: new Date('2026-03-30T10:00:00'),
          entryPrice: 178.50,
          exitPrice: 181.20,
          quantity: 20,
          totalCommission: 0.02,
          grossPnl: 54,
          netPnl: 53.98,
          pnlPercent: 1.51,
          holdTimeMinutes: 30,
          positionValue: 3570,
          executionHash: 'hash-schwab-1',
          isEstimatedTime: true,
        }),
        // Trade 2: GOOG loss, 10 shares
        makeTrade({
          symbol: 'GOOG',
          entryTime: new Date('2026-04-02T09:30:00'),
          exitTime: new Date('2026-04-02T10:00:00'),
          entryPrice: 179.40,
          exitPrice: 178.10,
          quantity: 10,
          totalCommission: 0.02,
          grossPnl: -13,
          netPnl: -13.02,
          pnlPercent: -0.72,
          holdTimeMinutes: 30,
          positionValue: 1794,
          executionHash: 'hash-schwab-2',
          isEstimatedTime: true,
        }),
        // Trade 3: GOOG revenge, 20 shares (doubled after loss)
        makeTrade({
          symbol: 'GOOG',
          entryTime: new Date('2026-04-02T10:30:00'),
          exitTime: new Date('2026-04-02T11:00:00'),
          entryPrice: 177.80,
          exitPrice: 176.25,
          quantity: 20,
          totalCommission: 0.02,
          grossPnl: -31,
          netPnl: -31.02,
          pnlPercent: -0.87,
          holdTimeMinutes: 30,
          positionValue: 3556,
          executionHash: 'hash-schwab-3',
          isEstimatedTime: true,
        }),
      ];

      const patterns = detectPatterns(trades, baselineForEstimated);
      const sizeEscalation = patterns.filter((p) => p.patternType === 'size_escalation');

      expect(sizeEscalation.length).toBeGreaterThan(0);
      // Verify the trigger is the GOOG trade with doubled size
      const trigger = sizeEscalation[0];
      expect(trigger.description).toContain('Size escalation');
      expect(trigger.description).toContain('1 consecutive loss');
    });

    it('should detect NFLX 10→20 shares after loss (TDA scenario)', () => {
      const trades: ParsedTrade[] = [
        // NFLX loss, 10 shares
        makeTrade({
          symbol: 'NFLX',
          entryTime: new Date('2026-03-17T09:30:00'),
          exitTime: new Date('2026-03-17T10:00:00'),
          entryPrice: 950.00,
          exitPrice: 940.00,
          quantity: 10,
          totalCommission: 0,
          grossPnl: -100,
          netPnl: -100,
          pnlPercent: -1.05,
          holdTimeMinutes: 30,
          positionValue: 9500,
          executionHash: 'hash-tda-nflx1',
          isEstimatedTime: true,
        }),
        // NFLX revenge, 20 shares (doubled after loss)
        makeTrade({
          symbol: 'NFLX',
          entryTime: new Date('2026-03-17T10:30:00'),
          exitTime: new Date('2026-03-17T11:00:00'),
          entryPrice: 938.00,
          exitPrice: 935.00,
          quantity: 20,
          totalCommission: 0,
          grossPnl: -60,
          netPnl: -60,
          pnlPercent: -0.32,
          holdTimeMinutes: 30,
          positionValue: 18760,
          executionHash: 'hash-tda-nflx2',
          isEstimatedTime: true,
        }),
      ];

      const patterns = detectPatterns(trades, baselineForEstimated);
      const sizeEscalation = patterns.filter((p) => p.patternType === 'size_escalation');

      expect(sizeEscalation.length).toBeGreaterThan(0);
      expect(sizeEscalation[0].description).toContain('Size escalation');
      expect(sizeEscalation[0].confidence).toBe('high');
    });

    it('should detect SNAP 80→150 shares after loss (TDA scenario)', () => {
      const trades: ParsedTrade[] = [
        // SNAP loss, 80 shares
        makeTrade({
          symbol: 'SNAP',
          entryTime: new Date('2026-03-18T09:30:00'),
          exitTime: new Date('2026-03-18T10:00:00'),
          entryPrice: 12.50,
          exitPrice: 12.10,
          quantity: 80,
          totalCommission: 0,
          grossPnl: -32,
          netPnl: -32,
          pnlPercent: -3.20,
          holdTimeMinutes: 30,
          positionValue: 1000,
          executionHash: 'hash-tda-snap1',
          isEstimatedTime: true,
        }),
        // SNAP revenge, 150 shares (nearly doubled after loss)
        makeTrade({
          symbol: 'SNAP',
          entryTime: new Date('2026-03-18T10:30:00'),
          exitTime: new Date('2026-03-18T11:00:00'),
          entryPrice: 12.00,
          exitPrice: 11.70,
          quantity: 150,
          totalCommission: 0,
          grossPnl: -45,
          netPnl: -45,
          pnlPercent: -2.50,
          holdTimeMinutes: 30,
          positionValue: 1800,
          executionHash: 'hash-tda-snap2',
          isEstimatedTime: true,
        }),
      ];

      const patterns = detectPatterns(trades, baselineForEstimated);
      const sizeEscalation = patterns.filter((p) => p.patternType === 'size_escalation');

      expect(sizeEscalation.length).toBeGreaterThan(0);
      expect(sizeEscalation[0].description).toContain('Size escalation');
      expect(sizeEscalation[0].confidence).toBe('high');
    });
  });

  describe('No estimated timestamps should not add broker note', () => {
    it('should not add confidence note when isEstimatedTime is not set', () => {
      const trades: ParsedTrade[] = [
        makeTrade({
          symbol: 'TSLA',
          entryTime: new Date('2026-03-30T10:00:00'),
          exitTime: new Date('2026-03-30T10:15:00'),
          netPnl: -150,
          grossPnl: -148,
          holdTimeMinutes: 15,
          positionValue: 5000,
          executionHash: 'hash-noest1',
          // isEstimatedTime is not set (undefined)
        }),
        makeTrade({
          symbol: 'TSLA',
          entryTime: new Date('2026-03-30T10:45:00'),
          exitTime: new Date('2026-03-30T11:15:00'),
          netPnl: -200,
          grossPnl: -198,
          holdTimeMinutes: 30,
          positionValue: 5000,
          executionHash: 'hash-noest2',
        }),
      ];

      const patterns = detectPatterns(trades, baselineForEstimated);

      for (const pattern of patterns) {
        expect(pattern.description).not.toContain('Confidence reduced');
      }
    });
  });
});
