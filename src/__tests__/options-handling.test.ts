import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseIBKRExecutions } from '@/lib/parsers/ibkr-parser';

// Load the 3-month test CSV with mixed stock and options trades
const csvPath = join(__dirname, '../../tickets/test_ibkr_3months_with_options.csv');
const csvContent = readFileSync(csvPath, 'utf-8');

describe('Options handling', () => {
  const result = parseIBKRExecutions(csvContent);

  it('should parse the CSV without fatal errors', () => {
    // There may be minor parse warnings, but no fatal errors that prevent trade extraction
    expect(result.trades.length).toBeGreaterThan(0);
  });

  it('should report optionsSkipped > 0', () => {
    expect(result.metadata.optionsSkipped).toBeGreaterThan(0);
    // The test file has 12 options rows (6 buy + 6 sell across 6 round trips)
    expect(result.metadata.optionsSkipped).toBe(12);
  });

  it('should have skippedOptionsData as an array with the correct length', () => {
    expect(result.metadata.skippedOptionsData).toBeDefined();
    expect(Array.isArray(result.metadata.skippedOptionsData)).toBe(true);
    expect(result.metadata.skippedOptionsData!.length).toBe(result.metadata.optionsSkipped);
  });

  it('should have correct fields on each skipped option', () => {
    for (const opt of result.metadata.skippedOptionsData!) {
      expect(opt.symbol).toBeDefined();
      expect(typeof opt.symbol).toBe('string');
      expect(opt.symbol.length).toBeGreaterThan(0);

      expect(opt.dateTime).toBeDefined();
      expect(opt.dateTime).toBeInstanceOf(Date);
      expect(opt.dateTime.getTime()).not.toBeNaN();

      expect(opt.side).toBeDefined();
      expect(['buy', 'sell']).toContain(opt.side);

      expect(typeof opt.quantity).toBe('number');
      expect(opt.quantity).toBeGreaterThan(0);

      expect(typeof opt.price).toBe('number');
      expect(opt.price).toBeGreaterThan(0);

      expect(typeof opt.commission).toBe('number');
      expect(opt.commission).toBeGreaterThanOrEqual(0);

      expect(opt.rawRow).toBeDefined();
      expect(typeof opt.rawRow).toBe('object');
    }
  });

  it('should not affect stock trade count', () => {
    // The test file has 8 stock round trips (AAPL, MSFT, NVDA, TSLA, AMD, META, GOOGL, AMZN)
    expect(result.trades.length).toBe(8);
  });

  it('should produce correct P&L for stock trades', () => {
    const aaplTrade = result.trades.find(t => t.symbol === 'AAPL');
    expect(aaplTrade).toBeDefined();
    // AAPL: buy 100 @ 185.50, sell 100 @ 187.20 => gross P&L = 170
    expect(aaplTrade!.grossPnl).toBe(170);
    expect(aaplTrade!.isOpen).toBe(false);

    const msftTrade = result.trades.find(t => t.symbol === 'MSFT');
    expect(msftTrade).toBeDefined();
    // MSFT: buy 50 @ 375.00, sell 50 @ 373.80 => gross P&L = -60
    expect(msftTrade!.grossPnl).toBe(-60);
  });

  it('should have options symbols containing expiration date patterns', () => {
    for (const opt of result.metadata.skippedOptionsData!) {
      // Options symbols like "AAPL 240119C190" contain a 6-digit expiration (YYMMDD)
      // and an option type indicator (C for call, P for put)
      expect(opt.symbol).toMatch(/\d{6}[CP]/);
    }
  });

  it('should correctly identify buy and sell sides for options', () => {
    const buys = result.metadata.skippedOptionsData!.filter(o => o.side === 'buy');
    const sells = result.metadata.skippedOptionsData!.filter(o => o.side === 'sell');
    // Each options round trip has 1 buy + 1 sell, and we have 6 round trips
    expect(buys.length).toBe(6);
    expect(sells.length).toBe(6);
  });
});
