import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseSchwabCSV } from '@/lib/parsers/schwab';
import { parseTDAmeritradeCSV } from '@/lib/parsers/tdameritrade';
import { parseWebullCSV } from '@/lib/parsers/webull';
import { parseIBKRExecutions } from '@/lib/parsers/ibkr-parser';

// ---------------------------------------------------------------------------
// Load the test CSV from tickets/
// ---------------------------------------------------------------------------
const SCHWAB_WEEK1_CSV = readFileSync(
  resolve(__dirname, '../../tickets/test_schwab_week1.csv'),
  'utf-8'
);

// Inline TDA CSV with date-only format (same structure as Schwab test data)
const TDA_DATE_ONLY_CSV = [
  'DATE,TRANSACTION ID,DESCRIPTION,QUANTITY,SYMBOL,PRICE,COMMISSION,AMOUNT',
  '03/30/2026,200001,Bought 20 AAPL,20,AAPL,178.50,0.01,-3570.01',
  '03/30/2026,200002,Sold 20 AAPL,20,AAPL,181.20,0.01,3623.99',
  '03/30/2026,200003,Bought 15 MSFT,15,MSFT,410.00,0.01,-6150.01',
  '03/30/2026,200004,Sold 15 MSFT,15,MSFT,412.50,0.01,6187.49',
].join('\n');

// Inline Webull CSV (has real timestamps)
const WEBULL_WITH_TIMES_CSV = [
  'Symbol,Trade Time,Side,Filled Qty,Avg Price,Status,Fee',
  'AAPL,03/30/2026 09:30:15,Buy,20,178.50,Filled,0.01',
  'AAPL,03/30/2026 11:45:30,Sell,20,181.20,Filled,0.01',
].join('\n');

// Inline IBKR CSV (has real timestamps)
const IBKR_WITH_TIMES_CSV = [
  'Symbol,DateTime,Quantity,T. Price,Proceeds,Commission,Buy/Sell,AssetCategory,Currency,ClientAccountID',
  'AAPL,2026-03-30 09:35:00,20,178.50,-3570.00,-0.01,BOT,STK,USD,U1234567',
  'AAPL,2026-03-30 11:45:00,-20,181.20,3624.00,-0.01,SLD,STK,USD,U1234567',
].join('\n');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Estimated timestamps (Schwab date-only)', () => {
  it('should estimate buy at 09:30 and sell at 10:00 for first pair on same day', () => {
    const result = parseSchwabCSV(SCHWAB_WEEK1_CSV);

    expect(result.errors).toHaveLength(0);
    expect(result.executions.length).toBeGreaterThanOrEqual(2);

    // Find executions for 03/30/2026 (first day)
    const day1Execs = result.executions.filter((e) => {
      const dateStr = e.dateTime.toISOString().split('T')[0];
      return dateStr === '2026-03-30';
    });

    // Should have 4 executions on day 1 (AAPL buy/sell + MSFT buy/sell)
    expect(day1Execs).toHaveLength(4);

    // First execution at 09:30
    expect(day1Execs[0].dateTime.getHours()).toBe(9);
    expect(day1Execs[0].dateTime.getMinutes()).toBe(30);

    // Second execution at 10:00
    expect(day1Execs[1].dateTime.getHours()).toBe(10);
    expect(day1Execs[1].dateTime.getMinutes()).toBe(0);

    // Third execution at 10:30
    expect(day1Execs[2].dateTime.getHours()).toBe(10);
    expect(day1Execs[2].dateTime.getMinutes()).toBe(30);

    // Fourth execution at 11:00
    expect(day1Execs[3].dateTime.getHours()).toBe(11);
    expect(day1Execs[3].dateTime.getMinutes()).toBe(0);
  });

  it('should produce non-zero hold times for same-day trades', () => {
    const result = parseSchwabCSV(SCHWAB_WEEK1_CSV);

    // All closed trades should have non-zero hold times
    const closedTrades = result.trades.filter((t) => !t.isOpen);
    expect(closedTrades.length).toBeGreaterThan(0);

    for (const trade of closedTrades) {
      expect(trade.holdTimeMinutes).not.toBeNull();
      expect(trade.holdTimeMinutes).toBeGreaterThan(0);
    }
  });

  it('should set isEstimatedTime to true on all trades', () => {
    const result = parseSchwabCSV(SCHWAB_WEEK1_CSV);

    expect(result.trades.length).toBeGreaterThan(0);
    for (const trade of result.trades) {
      expect(trade.isEstimatedTime).toBe(true);
    }
  });

  it('should set metadata.hasEstimatedTimes to true', () => {
    const result = parseSchwabCSV(SCHWAB_WEEK1_CSV);

    expect(result.metadata.hasEstimatedTimes).toBe(true);
  });

  it('should not set estimated flags when Schwab CSV has real timestamps', () => {
    const csvWithTimes = [
      'Date,Action,Symbol,Description,Quantity,Price,Fees & Comm,Amount',
      '01/15/2024 09:30:15 AM,Buy,SPY,,100,$480.00,$1.00,-$48001.00',
      '01/15/2024 02:45:30 PM,Sell,SPY,,100,$482.00,$1.00,$48199.00',
    ].join('\n');

    const result = parseSchwabCSV(csvWithTimes);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].isEstimatedTime).toBeUndefined();
    expect(result.metadata.hasEstimatedTimes).toBeUndefined();
  });
});

describe('Estimated timestamps (TD Ameritrade date-only)', () => {
  it('should estimate timestamps for TDA date-only CSV', () => {
    const result = parseTDAmeritradeCSV(TDA_DATE_ONLY_CSV);

    expect(result.errors).toHaveLength(0);

    // Find executions for 03/30/2026
    const day1Execs = result.executions.filter((e) => {
      const dateStr = e.dateTime.toISOString().split('T')[0];
      return dateStr === '2026-03-30';
    });

    expect(day1Execs).toHaveLength(4);

    // First execution at 09:30
    expect(day1Execs[0].dateTime.getHours()).toBe(9);
    expect(day1Execs[0].dateTime.getMinutes()).toBe(30);

    // Second at 10:00
    expect(day1Execs[1].dateTime.getHours()).toBe(10);
    expect(day1Execs[1].dateTime.getMinutes()).toBe(0);
  });

  it('should set isEstimatedTime on all TDA trades', () => {
    const result = parseTDAmeritradeCSV(TDA_DATE_ONLY_CSV);

    expect(result.trades.length).toBeGreaterThan(0);
    for (const trade of result.trades) {
      expect(trade.isEstimatedTime).toBe(true);
    }
  });

  it('should set metadata.hasEstimatedTimes on TDA result', () => {
    const result = parseTDAmeritradeCSV(TDA_DATE_ONLY_CSV);

    expect(result.metadata.hasEstimatedTimes).toBe(true);
  });

  it('should produce non-zero hold times for TDA same-day trades', () => {
    const result = parseTDAmeritradeCSV(TDA_DATE_ONLY_CSV);

    const closedTrades = result.trades.filter((t) => !t.isOpen);
    expect(closedTrades.length).toBeGreaterThan(0);

    for (const trade of closedTrades) {
      expect(trade.holdTimeMinutes).not.toBeNull();
      expect(trade.holdTimeMinutes).toBeGreaterThan(0);
    }
  });
});

describe('Non-estimated timestamps (Webull - has real times)', () => {
  it('should NOT set isEstimatedTime on Webull trades', () => {
    const result = parseWebullCSV(WEBULL_WITH_TIMES_CSV);

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].isEstimatedTime).toBeUndefined();
  });

  it('should NOT set hasEstimatedTimes in Webull metadata', () => {
    const result = parseWebullCSV(WEBULL_WITH_TIMES_CSV);

    expect(result.metadata.hasEstimatedTimes).toBeUndefined();
  });
});

describe('Non-estimated timestamps (IBKR - has real times)', () => {
  it('should NOT set isEstimatedTime on IBKR trades', () => {
    const result = parseIBKRExecutions(IBKR_WITH_TIMES_CSV);

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].isEstimatedTime).toBeUndefined();
  });

  it('should NOT set hasEstimatedTimes in IBKR metadata', () => {
    const result = parseIBKRExecutions(IBKR_WITH_TIMES_CSV);

    expect(result.metadata.hasEstimatedTimes).toBeUndefined();
  });
});
