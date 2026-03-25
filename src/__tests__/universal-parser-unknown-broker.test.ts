import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { detectColumns } from '@/lib/parsers/universal-column-detector';
import { parseTradeCSV } from '@/lib/parsers/index';

const CSV_PATH = resolve(__dirname, '../../tickets/test_unknown_broker_week4.csv');
const csvContent = readFileSync(CSV_PATH, 'utf-8');

describe('Universal Parser - Unknown Broker CSV', () => {
  // -----------------------------------------------------------------------
  // 1. Column detection tests
  // -----------------------------------------------------------------------
  describe('detectColumns()', () => {
    it('should map "Ticker" to symbol', () => {
      const result = detectColumns(csvContent);
      expect(result.mapping.symbol).toBe('Ticker');
    });

    it('should map "Shares" to quantity', () => {
      const result = detectColumns(csvContent);
      expect(result.mapping.quantity).toBe('Shares');
    });

    it('should map "Exec Price" to price', () => {
      const result = detectColumns(csvContent);
      expect(result.mapping.price).toBe('Exec Price');
    });

    it('should map "Fees" to commission', () => {
      const result = detectColumns(csvContent);
      expect(result.mapping.commission).toBe('Fees');
    });

    it('should map dateTime to "Trade Date" or "Execution Time"', () => {
      const result = detectColumns(csvContent);
      expect(['Trade Date', 'Execution Time']).toContain(result.mapping.dateTime);
    });

    it('should map "Transaction" to side', () => {
      const result = detectColumns(csvContent);
      expect(result.mapping.side).toBe('Transaction');
    });

    it('should have confidence >= 60', () => {
      const result = detectColumns(csvContent);
      expect(result.confidence).toBeGreaterThanOrEqual(60);
    });

    it('should map all 4 required fields', () => {
      const result = detectColumns(csvContent);
      expect(result.mapping.symbol).not.toBeNull();
      expect(result.mapping.dateTime).not.toBeNull();
      expect(result.mapping.quantity).not.toBeNull();
      expect(result.mapping.price).not.toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // 2. End-to-end parsing test
  // -----------------------------------------------------------------------
  describe('parseTradeCSV() end-to-end', () => {
    it('should parse 9 round-trip trades from the unknown broker CSV', () => {
      const result = parseTradeCSV(csvContent);

      expect(result.errors).toHaveLength(0);
      expect(result.trades).toHaveLength(9);
      expect(result.metadata.brokerFormat).toBe('universal');
    });

    it('should parse GOOG with 2 trades (both losses, 15 and 30 shares)', () => {
      const result = parseTradeCSV(csvContent);

      const googTrades = result.trades.filter((t) => t.symbol === 'GOOG');
      expect(googTrades).toHaveLength(2);

      // Both GOOG trades should be losses (bought high, sold low)
      for (const trade of googTrades) {
        expect(trade.netPnl).not.toBeNull();
        expect(trade.netPnl!).toBeLessThan(0);
      }

      // Check quantities: 15 shares and 30 shares
      const quantities = googTrades.map((t) => t.quantity).sort((a, b) => a - b);
      expect(quantities).toEqual([15, 30]);
    });

    it('should set brokerFormat to "universal"', () => {
      const result = parseTradeCSV(csvContent);
      expect(result.metadata.brokerFormat).toBe('universal');
    });

    it('should parse all 18 executions', () => {
      const result = parseTradeCSV(csvContent);
      expect(result.executions).toHaveLength(18);
    });

    it('should correctly identify buy/sell from Purchase/Sale', () => {
      const result = parseTradeCSV(csvContent);

      const buys = result.executions.filter((e) => e.side === 'buy');
      const sells = result.executions.filter((e) => e.side === 'sell');

      expect(buys).toHaveLength(9);
      expect(sells).toHaveLength(9);
    });

    it('should preserve correct timestamps from separate date and time columns', () => {
      const result = parseTradeCSV(csvContent);

      // First execution should be AAPL buy at 2026-04-20 09:42:15
      const aaplBuy = result.executions.find(
        (e) => e.symbol === 'AAPL' && e.side === 'buy'
      );
      expect(aaplBuy).toBeDefined();
      expect(aaplBuy!.dateTime.getFullYear()).toBe(2026);
      expect(aaplBuy!.dateTime.getMonth()).toBe(3); // April = month 3 (0-indexed)
      expect(aaplBuy!.dateTime.getDate()).toBe(20);
      expect(aaplBuy!.dateTime.getHours()).toBe(9);
      expect(aaplBuy!.dateTime.getMinutes()).toBe(42);
    });
  });
});
