import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseTradeCSV } from '@/lib/parsers';
import { parseIBKRExecutions } from '@/lib/parsers/ibkr-parser';

const BIG_FIXTURE = resolve(
  __dirname,
  '../../tickets/U21711012_20250929_20260309.csv'
);

describe('IBKR Open/Cancelled Order Handling', () => {
  const csvContent = readFileSync(BIG_FIXTURE, 'utf-8');

  it('should parse the big IBKR file without errors', () => {
    const result = parseTradeCSV(csvContent, new Set());
    expect(result.trades.length).toBeGreaterThan(0);
    const fatal = result.errors.filter((e) =>
      e.message.includes('Unrecognized')
    );
    expect(fatal).toHaveLength(0);
  });

  it('should parse all 188 executions', () => {
    const result = parseTradeCSV(csvContent, new Set());
    expect(result.executions).toHaveLength(188);
  });

  it('should have very few open trades (genuinely open positions only)', () => {
    const result = parseTradeCSV(csvContent, new Set());
    const openTrades = result.trades.filter((t) => t.isOpen);
    // Only BULL, UOKA, and FGL are genuinely open
    expect(openTrades.length).toBeLessThanOrEqual(6);
  });

  it('should have majority of trades closed via cross-day matching', () => {
    const result = parseTradeCSV(csvContent, new Set());
    const closedTrades = result.trades.filter((t) => !t.isOpen);
    // With cross-day matching, most trades should be closed
    expect(closedTrades.length).toBeGreaterThan(70);
  });

  it('should match cross-day round trips (buy day 1, sell day 2)', () => {
    const result = parseTradeCSV(csvContent, new Set());
    // AIMD has buy 09/30 and sell 10/02 — should be matched as a closed trade
    const aimdClosed = result.trades.filter(
      (t) => t.symbol === 'AIMD' && !t.isOpen
    );
    expect(aimdClosed.length).toBeGreaterThan(0);
  });

  it('should not have phantom open trades from cross-day splits', () => {
    const result = parseTradeCSV(csvContent, new Set());
    const openTrades = result.trades.filter((t) => t.isOpen);
    // None of the open trades should be single-execution sells
    // (those would be unmatched exits from cross-day splitting)
    const singleExecSells = openTrades.filter(
      (t) => t.direction === 'short' && t.executions.length === 1
    );
    // With proper matching, most single-exec sells should be gone
    expect(singleExecSells.length).toBeLessThanOrEqual(2);
  });

  it('should have BULL as an open position matching broker statement', () => {
    const result = parseTradeCSV(csvContent, new Set());
    const bullOpen = result.trades.filter(
      (t) => t.symbol === 'BULL' && t.isOpen
    );
    const totalOpenQty = bullOpen.reduce((s, t) => s + t.quantity, 0);
    // Broker statement shows 93 BULL shares open
    expect(totalOpenQty).toBe(93);
  });

  it('should have UOKA as an open position', () => {
    const result = parseTradeCSV(csvContent, new Set());
    const uokaOpen = result.trades.filter(
      (t) => t.symbol === 'UOKA' && t.isOpen
    );
    const totalOpenQty = uokaOpen.reduce((s, t) => s + t.quantity, 0);
    // Broker statement shows 140 UOKA shares open
    expect(totalOpenQty).toBe(140);
  });

  describe('Inline CSV: cross-day matching', () => {
    it('should match buy Monday + sell Tuesday as one closed trade', () => {
      const csv = [
        '"Trades","Header","DataDiscriminator","Asset Category","Currency","Symbol","Date/Time","Quantity","T. Price","C. Price","Proceeds","Comm/Fee","Basis","Realized P/L","MTM P/L","Code"',
        '"Trades","Data","Order","Stocks","USD","AAPL","2026-03-10, 09:30:00",100,150,152,-15000,-1,15001,0,200,O',
        '"Trades","Data","Order","Stocks","USD","AAPL","2026-03-11, 10:00:00",-100,155,152,15500,-1,-15001,499,-300,C',
      ].join('\n');

      const result = parseIBKRExecutions(csv, new Set());
      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].isOpen).toBe(false);
      expect(result.trades[0].symbol).toBe('AAPL');
      expect(result.trades[0].entryPrice).toBe(150);
      expect(result.trades[0].exitPrice).toBe(155);
    });

    it('should handle buy + sell same day still working', () => {
      const csv = [
        '"Trades","Header","DataDiscriminator","Asset Category","Currency","Symbol","Date/Time","Quantity","T. Price","C. Price","Proceeds","Comm/Fee","Basis","Realized P/L","MTM P/L","Code"',
        '"Trades","Data","Order","Stocks","USD","MSFT","2026-03-10, 09:30:00",50,400,405,-20000,-0.5,20000.5,0,250,O',
        '"Trades","Data","Order","Stocks","USD","MSFT","2026-03-10, 11:00:00",-50,405,405,20250,-0.5,-20000.5,249,0,C',
      ].join('\n');

      const result = parseIBKRExecutions(csv, new Set());
      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].isOpen).toBe(false);
    });
  });
});
