import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseTradeCSV, detectBroker } from '@/lib/parsers';

const FIXTURES_DIR = resolve(__dirname, '../../tickets');

interface BrokerFixture {
  filename: string;
  expectedBroker: string;
  expectedTradeCount: number;
  expectedNetPnl: number;
  pnlTolerance: number;
  expectedWins: number;
  expectedLosses: number;
  expectedShortTrades: number;
}

const fixtures: BrokerFixture[] = [
  {
    filename: 'test_schwab_2weeks.csv',
    expectedBroker: 'schwab',
    expectedTradeCount: 14,
    expectedNetPnl: 690.3,
    pnlTolerance: 0.01,
    expectedWins: 9,
    expectedLosses: 5,
    expectedShortTrades: 1,
  },
  {
    filename: 'test_tdameritrade_2weeks.csv',
    expectedBroker: 'tdameritrade',
    expectedTradeCount: 14,
    expectedNetPnl: 708.5,
    pnlTolerance: 0.01,
    expectedWins: 9,
    expectedLosses: 5,
    expectedShortTrades: 1,
  },
  {
    filename: 'test_webull_2weeks.csv',
    expectedBroker: 'webull',
    expectedTradeCount: 14,
    expectedNetPnl: 707.94,
    pnlTolerance: 0.01,
    expectedWins: 9,
    expectedLosses: 5,
    expectedShortTrades: 1,
  },
];

describe('Multi-Broker Fixture Tests', () => {
  for (const fixture of fixtures) {
    describe(fixture.filename, () => {
      const csvPath = resolve(FIXTURES_DIR, fixture.filename);
      const csvContent = readFileSync(csvPath, 'utf-8');

      it(`should detect ${fixture.expectedBroker} format`, () => {
        expect(detectBroker(csvContent)).toBe(fixture.expectedBroker);
      });

      it('should parse without errors', () => {
        const result = parseTradeCSV(csvContent, new Set());
        expect(result.trades.length).toBeGreaterThan(0);
        expect(result.errors).toHaveLength(0);
      });

      it(`should produce ${fixture.expectedTradeCount} trades`, () => {
        const result = parseTradeCSV(csvContent, new Set());
        expect(result.trades).toHaveLength(fixture.expectedTradeCount);
      });

      it(`should have net P&L of $${fixture.expectedNetPnl.toFixed(2)}`, () => {
        const result = parseTradeCSV(csvContent, new Set());
        const totalNetPnl = result.trades.reduce(
          (sum, t) => sum + (t.netPnl ?? 0),
          0
        );
        expect(Math.abs(totalNetPnl - fixture.expectedNetPnl)).toBeLessThanOrEqual(
          fixture.pnlTolerance
        );
      });

      it(`should have ${fixture.expectedWins}W/${fixture.expectedLosses}L`, () => {
        const result = parseTradeCSV(csvContent, new Set());
        const wins = result.trades.filter((t) => (t.netPnl ?? 0) > 0).length;
        const losses = result.trades.filter((t) => (t.netPnl ?? 0) <= 0).length;
        expect(wins).toBe(fixture.expectedWins);
        expect(losses).toBe(fixture.expectedLosses);
      });

      it(`should have ${fixture.expectedShortTrades} short trade(s)`, () => {
        const result = parseTradeCSV(csvContent, new Set());
        const shorts = result.trades.filter((t) => t.direction === 'short');
        expect(shorts).toHaveLength(fixture.expectedShortTrades);
      });

      it('should have all trades closed', () => {
        const result = parseTradeCSV(csvContent, new Set());
        for (const trade of result.trades) {
          expect(trade.isOpen).toBe(false);
          expect(trade.exitTime).not.toBeNull();
          expect(trade.exitPrice).not.toBeNull();
          expect(trade.netPnl).not.toBeNull();
        }
      });

      it('should have correct broker format in metadata', () => {
        const result = parseTradeCSV(csvContent, new Set());
        expect(result.metadata.brokerFormat).toBe(fixture.expectedBroker);
      });

      it('should have valid entry and exit prices', () => {
        const result = parseTradeCSV(csvContent, new Set());
        for (const trade of result.trades) {
          expect(trade.entryPrice).toBeGreaterThan(0);
          expect(trade.exitPrice).toBeGreaterThan(0);
        }
      });

      it('should satisfy netPnl = grossPnl - commission', () => {
        const result = parseTradeCSV(csvContent, new Set());
        for (const trade of result.trades) {
          if (trade.grossPnl !== null && trade.netPnl !== null) {
            const expected = trade.grossPnl - trade.totalCommission;
            expect(trade.netPnl).toBeCloseTo(expected, 2);
          }
        }
      });

      it('should produce unique execution hashes', () => {
        const result = parseTradeCSV(csvContent, new Set());
        const hashes = new Set(result.trades.map((t) => t.executionHash));
        expect(hashes.size).toBe(result.trades.length);
      });
    });
  }

  describe('Cross-broker consistency', () => {
    it('should parse same number of trades from each broker', () => {
      const counts = fixtures.map((f) => {
        const csv = readFileSync(resolve(FIXTURES_DIR, f.filename), 'utf-8');
        return parseTradeCSV(csv, new Set()).trades.length;
      });
      expect(new Set(counts).size).toBe(1);
    });

    it('should parse the same symbols from each broker', () => {
      const symbolSets = fixtures.map((f) => {
        const csv = readFileSync(resolve(FIXTURES_DIR, f.filename), 'utf-8');
        const result = parseTradeCSV(csv, new Set());
        return new Set(result.trades.map((t) => t.symbol));
      });

      const first = [...symbolSets[0]].sort();
      for (let i = 1; i < symbolSets.length; i++) {
        expect([...symbolSets[i]].sort()).toEqual(first);
      }
    });
  });
});
