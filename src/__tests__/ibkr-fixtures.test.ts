import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseTradeCSV, detectBroker } from '@/lib/parsers';

/**
 * Integration tests using real IBKR Activity Statement CSV exports.
 *
 * Expected values are derived from the parser's own VWAP-based trade matching
 * and commission reconciliation logic. These may differ slightly from IBKR's
 * "Realized P/L" column which uses a different accounting method.
 */

const FIXTURES_DIR = resolve(__dirname, '../../tickets');

interface FixtureExpectation {
  filename: string;
  expectedTradeCount: number;
  expectedNetPnl: number;
  /** Tolerance in dollars for net P&L comparison */
  pnlTolerance: number;
  expectedWins?: number;
  expectedLosses?: number;
}

const fixtures: FixtureExpectation[] = [
  {
    // Week of March 10-14, 2026
    filename: 'U21711012_20260310_20260314.csv',
    expectedTradeCount: 14,
    expectedNetPnl: 22.12,
    pnlTolerance: 0.50,
    expectedWins: 8,
    expectedLosses: 6,
  },
  {
    // Week of March 17-21, 2026
    filename: 'U21711012_20260317_20260321.csv',
    expectedTradeCount: 15,
    expectedNetPnl: -111.09,
    pnlTolerance: 0.50,
    expectedWins: 9,
    expectedLosses: 6,
  },
  {
    // Week of March 23-27, 2026
    filename: 'U21711012_20260323_20260327.csv',
    expectedTradeCount: 14,
    expectedNetPnl: 112.43,
    pnlTolerance: 0.50,
    expectedWins: 11,
    expectedLosses: 3,
  },
  {
    // Week of March 30 - April 3, 2026
    filename: 'U21711012_20260330_20260403.csv',
    expectedTradeCount: 11,
    expectedNetPnl: 99.85,
    pnlTolerance: 0.50,
    expectedWins: 9,
    expectedLosses: 2,
  },
  {
    // Week of April 6-10, 2026
    filename: 'U21711012_20260406_20260410.csv',
    expectedTradeCount: 14,
    expectedNetPnl: -34.19,
    pnlTolerance: 0.50,
    expectedWins: 9,
    expectedLosses: 5,
  },
];

describe('IBKR Fixture Integration Tests', () => {
  for (const fixture of fixtures) {
    describe(fixture.filename, () => {
      const csvPath = resolve(FIXTURES_DIR, fixture.filename);
      const csvContent = readFileSync(csvPath, 'utf-8');

      it('should detect IBKR broker format', () => {
        const broker = detectBroker(csvContent);
        expect(broker).toBe('ibkr');
      });

      it('should parse without fatal errors', () => {
        const result = parseTradeCSV(csvContent, new Set());

        // Trades should exist even if there are warnings
        expect(result.trades.length).toBeGreaterThan(0);

        // No errors that would prevent parsing (warnings are acceptable)
        const fatalErrors = result.errors.filter((e) =>
          e.message.includes('Unrecognized')
        );
        expect(fatalErrors).toHaveLength(0);
      });

      it(`should produce exactly ${fixture.expectedTradeCount} trades`, () => {
        const result = parseTradeCSV(csvContent, new Set());
        expect(result.trades).toHaveLength(fixture.expectedTradeCount);
      });

      it(`should have net P&L of $${fixture.expectedNetPnl.toFixed(2)} within $${fixture.pnlTolerance.toFixed(2)} tolerance`, () => {
        const result = parseTradeCSV(csvContent, new Set());

        const totalNetPnl = result.trades.reduce((sum, trade) => {
          return sum + (trade.netPnl ?? 0);
        }, 0);

        expect(Math.abs(totalNetPnl - fixture.expectedNetPnl)).toBeLessThanOrEqual(
          fixture.pnlTolerance
        );
      });

      it('should have IBKR broker format in metadata', () => {
        const result = parseTradeCSV(csvContent, new Set());
        expect(result.metadata.brokerFormat).toMatch(/^ibkr/);
      });

      it('should report ibkr-activity-statement format', () => {
        const result = parseTradeCSV(csvContent, new Set());
        expect(result.metadata.brokerFormat).toBe('ibkr-activity-statement');
      });

      it('should have all trades closed (no open positions)', () => {
        const result = parseTradeCSV(csvContent, new Set());

        for (const trade of result.trades) {
          expect(trade.isOpen).toBe(false);
          expect(trade.exitTime).not.toBeNull();
          expect(trade.exitPrice).not.toBeNull();
          expect(trade.netPnl).not.toBeNull();
          expect(trade.grossPnl).not.toBeNull();
        }
      });

      it('should have valid trade properties on every trade', () => {
        const result = parseTradeCSV(csvContent, new Set());

        for (const trade of result.trades) {
          expect(trade.symbol).toBeTruthy();
          expect(trade.quantity).toBeGreaterThan(0);
          expect(trade.entryPrice).toBeGreaterThan(0);
          expect(trade.exitPrice).toBeGreaterThan(0);
          expect(trade.totalCommission).toBeGreaterThanOrEqual(0);
          expect(trade.holdTimeMinutes).toBeGreaterThanOrEqual(0);
          expect(trade.direction).toMatch(/^(long|short)$/);
          expect(trade.executionHash).toBeTruthy();
          expect(trade.executions.length).toBeGreaterThanOrEqual(2);
        }
      });

      it('should have positive position values', () => {
        const result = parseTradeCSV(csvContent, new Set());

        for (const trade of result.trades) {
          expect(trade.positionValue).toBeGreaterThan(0);
        }
      });

      it('should satisfy netPnl = grossPnl - totalCommission for each trade', () => {
        const result = parseTradeCSV(csvContent, new Set());

        for (const trade of result.trades) {
          if (trade.grossPnl !== null && trade.netPnl !== null) {
            const expected = trade.grossPnl - trade.totalCommission;
            expect(trade.netPnl).toBeCloseTo(expected, 2);
          }
        }
      });

      if (fixture.expectedWins !== undefined && fixture.expectedLosses !== undefined) {
        it(`should have exactly ${fixture.expectedWins}W/${fixture.expectedLosses}L`, () => {
          const result = parseTradeCSV(csvContent, new Set());

          const wins = result.trades.filter((t) => (t.netPnl ?? 0) > 0).length;
          const losses = result.trades.filter((t) => (t.netPnl ?? 0) <= 0).length;

          expect(wins).toBe(fixture.expectedWins);
          expect(losses).toBe(fixture.expectedLosses);
        });
      }
    });
  }

  describe('Cross-fixture consistency', () => {
    it('should produce unique execution hashes across all fixtures', () => {
      const allHashes = new Set<string>();
      let totalTrades = 0;

      for (const fixture of fixtures) {
        const csvPath = resolve(FIXTURES_DIR, fixture.filename);
        const csvContent = readFileSync(csvPath, 'utf-8');
        const result = parseTradeCSV(csvContent, new Set());

        for (const trade of result.trades) {
          allHashes.add(trade.executionHash);
          totalTrades++;
        }
      }

      // Each trade across all fixtures should have a unique hash
      expect(allHashes.size).toBe(totalTrades);
    });

    it('should correctly aggregate total P&L across all weeks', () => {
      let grandTotalNetPnl = 0;

      for (const fixture of fixtures) {
        const csvPath = resolve(FIXTURES_DIR, fixture.filename);
        const csvContent = readFileSync(csvPath, 'utf-8');
        const result = parseTradeCSV(csvContent, new Set());

        const weeklyPnl = result.trades.reduce(
          (sum, trade) => sum + (trade.netPnl ?? 0),
          0
        );
        grandTotalNetPnl += weeklyPnl;
      }

      const expectedGrandTotal = fixtures.reduce((sum, f) => sum + f.expectedNetPnl, 0);

      // Cumulative tolerance: $0.50 per fixture
      const cumulativeTolerance = fixtures.length * 0.50;
      expect(Math.abs(grandTotalNetPnl - expectedGrandTotal)).toBeLessThanOrEqual(
        cumulativeTolerance
      );
    });

    it('should parse a total of 68 trades across all five weeks', () => {
      let totalTrades = 0;

      for (const fixture of fixtures) {
        const csvPath = resolve(FIXTURES_DIR, fixture.filename);
        const csvContent = readFileSync(csvPath, 'utf-8');
        const result = parseTradeCSV(csvContent, new Set());
        totalTrades += result.trades.length;
      }

      const expectedTotal = fixtures.reduce((s, f) => s + f.expectedTradeCount, 0);
      expect(totalTrades).toBe(expectedTotal);
    });

    it('should produce deterministic results on repeated parsing', () => {
      for (const fixture of fixtures) {
        const csvPath = resolve(FIXTURES_DIR, fixture.filename);
        const csvContent = readFileSync(csvPath, 'utf-8');

        const result1 = parseTradeCSV(csvContent, new Set());
        const result2 = parseTradeCSV(csvContent, new Set());

        expect(result1.trades.length).toBe(result2.trades.length);

        const net1 = result1.trades.reduce((s, t) => s + (t.netPnl ?? 0), 0);
        const net2 = result2.trades.reduce((s, t) => s + (t.netPnl ?? 0), 0);
        expect(net1).toBe(net2);

        // Hashes should also be identical
        for (let i = 0; i < result1.trades.length; i++) {
          expect(result1.trades[i].executionHash).toBe(result2.trades[i].executionHash);
        }
      }
    });

    it('should detect all trades as duplicates when execution hashes are pre-populated', () => {
      const csvPath = resolve(FIXTURES_DIR, fixtures[0].filename);
      const csvContent = readFileSync(csvPath, 'utf-8');

      // First parse to collect execution-level hashes
      const firstResult = parseTradeCSV(csvContent, new Set());
      expect(firstResult.trades.length).toBeGreaterThan(0);

      // Build hash set from individual executions (not trade hashes)
      // The parser deduplicates at the execution level using
      // sha256(symbol|dateTime|side|quantity|price)
      const executionHashes = new Set<string>();
      for (const exec of firstResult.executions) {
        const { createHash } = require('crypto');
        const data = `${exec.symbol}|${exec.dateTime.toISOString()}|${exec.side}|${exec.quantity}|${exec.price}`;
        executionHashes.add(createHash('sha256').update(data).digest('hex'));
      }

      // Second parse with execution hashes — all executions should be skipped
      const secondResult = parseTradeCSV(csvContent, executionHashes);
      expect(secondResult.trades).toHaveLength(0);
      expect(secondResult.duplicateHashes.length).toBe(firstResult.executions.length);
    });
  });
});
