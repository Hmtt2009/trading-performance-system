import { describe, it, expect } from 'vitest';
import { parseSchwabCSV } from '@/lib/parsers/schwab';
import { detectBroker, parseTradeCSV } from '@/lib/parsers';

// ---------------------------------------------------------------------------
// Helper: build a Schwab CSV string from header + data rows
// ---------------------------------------------------------------------------
function schwabCSV(rows: string[]): string {
  const header = 'Date,Action,Symbol,Description,Quantity,Price,Fees & Comm,Amount';
  return [header, ...rows].join('\n');
}

// ---------------------------------------------------------------------------
// Fixtures (inline CSV strings)
// ---------------------------------------------------------------------------

const BASIC_LONG_CSV = schwabCSV([
  '01/15/2024,Buy,AAPL,,100,$150.00,$1.00,-$15001.00',
  '01/15/2024,Sell,AAPL,,100,$155.00,$1.00,$15499.00',
]);

const SHORT_TRADE_CSV = schwabCSV([
  '01/15/2024,Sell,TSLA,,50,$200.00,$1.00,$9999.00',
  '01/15/2024,Buy,TSLA,,50,$195.00,$1.00,-$9751.00',
]);

const MULTIPLE_SYMBOLS_CSV = schwabCSV([
  '01/15/2024,Buy,AAPL,,100,$150.00,$1.00,-$15001.00',
  '01/15/2024,Sell,AAPL,,100,$155.00,$1.00,$15499.00',
  '01/15/2024,Buy,MSFT,,50,$400.00,$0.50,-$20000.50',
  '01/15/2024,Sell,MSFT,,50,$405.00,$0.50,$20249.50',
]);

const OPEN_POSITION_CSV = schwabCSV([
  '01/15/2024,Buy,GOOG,,25,$140.00,$1.00,-$3501.00',
]);

const SCALING_IN_CSV = schwabCSV([
  '01/15/2024,Buy,AMD,,50,$178.00,$0.50,-$8900.50',
  '01/15/2024,Buy,AMD,,50,$177.50,$0.50,-$8875.50',
  '01/15/2024,Sell,AMD,,100,$180.00,$1.00,$17999.00',
]);

const OPTIONS_CSV = schwabCSV([
  '01/15/2024,Buy,AAPL,,100,$150.00,$1.00,-$15001.00',
  '01/15/2024,Sell,AAPL,,100,$155.00,$1.00,$15499.00',
  '01/15/2024,Buy,AAPL 01/19/2024 175.00 C,,5,$3.20,$3.25,-$1603.25',
  '01/15/2024,Sell,AAPL 01/19/2024 175.00 C,,5,$4.10,$3.25,$2046.75',
]);

const DATE_WITH_TIME_CSV = schwabCSV([
  '01/15/2024 09:30:15 AM,Buy,SPY,,100,$480.00,$1.00,-$48001.00',
  '01/15/2024 02:45:30 PM,Sell,SPY,,100,$482.00,$1.00,$48199.00',
]);

const DATE_24H_CSV = schwabCSV([
  '01/15/2024 09:30:15,Buy,SPY,,100,$480.00,$1.00,-$48001.00',
  '01/15/2024 14:45:30,Sell,SPY,,100,$482.00,$1.00,$48199.00',
]);

const LOSING_TRADE_CSV = schwabCSV([
  '01/15/2024,Buy,META,,100,$500.00,$1.00,-$50001.00',
  '01/15/2024,Sell,META,,100,$495.00,$1.00,$49499.00',
]);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Schwab Parser', () => {
  describe('Basic round-trip trade', () => {
    it('should parse a buy-then-sell round trip into 1 long trade', () => {
      const result = parseSchwabCSV(BASIC_LONG_CSV);

      expect(result.errors).toHaveLength(0);
      expect(result.executions).toHaveLength(2);
      expect(result.trades).toHaveLength(1);

      const trade = result.trades[0];
      expect(trade.symbol).toBe('AAPL');
      expect(trade.direction).toBe('long');
      expect(trade.entryPrice).toBe(150);
      expect(trade.exitPrice).toBe(155);
      expect(trade.quantity).toBe(100);
      // Gross P&L: (155 - 150) * 100 = 500
      expect(trade.grossPnl).toBe(500);
      // Net P&L: 500 - 2 (commission) = 498
      expect(trade.netPnl).toBe(498);
      expect(trade.totalCommission).toBe(2);
      expect(trade.isOpen).toBe(false);
    });

    it('should set the broker format to schwab', () => {
      const result = parseSchwabCSV(BASIC_LONG_CSV);
      expect(result.metadata.brokerFormat).toBe('schwab');
    });

    it('should record correct metadata counts', () => {
      const result = parseSchwabCSV(BASIC_LONG_CSV);
      expect(result.metadata.parsedRows).toBe(2);
      expect(result.metadata.errorRows).toBe(0);
    });
  });

  describe('Short trade', () => {
    it('should parse a sell-first short trade correctly', () => {
      const result = parseSchwabCSV(SHORT_TRADE_CSV);

      expect(result.errors).toHaveLength(0);
      expect(result.trades).toHaveLength(1);

      const trade = result.trades[0];
      expect(trade.direction).toBe('short');
      expect(trade.symbol).toBe('TSLA');
      expect(trade.entryPrice).toBe(200);
      expect(trade.exitPrice).toBe(195);
      expect(trade.quantity).toBe(50);
      // Gross P&L: (200 - 195) * 50 = 250
      expect(trade.grossPnl).toBe(250);
      expect(trade.isOpen).toBe(false);
    });
  });

  describe('Multiple trades same day', () => {
    it('should produce 2 separate trades for different symbols', () => {
      const result = parseSchwabCSV(MULTIPLE_SYMBOLS_CSV);

      expect(result.errors).toHaveLength(0);
      expect(result.executions).toHaveLength(4);
      expect(result.trades).toHaveLength(2);

      const symbols = result.trades.map((t) => t.symbol).sort();
      expect(symbols).toEqual(['AAPL', 'MSFT']);
    });

    it('should calculate P&L independently for each symbol', () => {
      const result = parseSchwabCSV(MULTIPLE_SYMBOLS_CSV);

      const aapl = result.trades.find((t) => t.symbol === 'AAPL')!;
      const msft = result.trades.find((t) => t.symbol === 'MSFT')!;

      // AAPL: (155 - 150) * 100 = 500 gross
      expect(aapl.grossPnl).toBe(500);
      // MSFT: (405 - 400) * 50 = 250 gross
      expect(msft.grossPnl).toBe(250);
    });
  });

  describe('Open position (buy only, no sell)', () => {
    it('should mark a position with no exit as open', () => {
      const result = parseSchwabCSV(OPEN_POSITION_CSV);

      expect(result.errors).toHaveLength(0);
      expect(result.trades).toHaveLength(1);

      const trade = result.trades[0];
      expect(trade.isOpen).toBe(true);
      expect(trade.exitTime).toBeNull();
      expect(trade.exitPrice).toBeNull();
      expect(trade.grossPnl).toBeNull();
      expect(trade.netPnl).toBeNull();
      expect(trade.holdTimeMinutes).toBeNull();
    });

    it('should still record entry data for open positions', () => {
      const result = parseSchwabCSV(OPEN_POSITION_CSV);
      const trade = result.trades[0];

      expect(trade.symbol).toBe('GOOG');
      expect(trade.direction).toBe('long');
      expect(trade.entryPrice).toBe(140);
      expect(trade.quantity).toBe(25);
      expect(trade.positionValue).toBe(3500);
    });
  });

  describe('Scaling in', () => {
    it('should combine multiple buys + one sell into 1 trade with VWAP entry', () => {
      const result = parseSchwabCSV(SCALING_IN_CSV);

      expect(result.errors).toHaveLength(0);
      expect(result.trades).toHaveLength(1);

      const trade = result.trades[0];
      expect(trade.symbol).toBe('AMD');
      expect(trade.quantity).toBe(100);
      // VWAP entry: (50*178 + 50*177.50) / 100 = 177.75
      expect(trade.entryPrice).toBe(177.75);
      expect(trade.exitPrice).toBe(180);
      // Gross P&L: (180 - 177.75) * 100 = 225
      expect(trade.grossPnl).toBe(225);
      expect(trade.isOpen).toBe(false);
    });

    it('should sum commissions across all legs', () => {
      const result = parseSchwabCSV(SCALING_IN_CSV);
      const trade = result.trades[0];
      // 0.50 + 0.50 + 1.00 = 2.00
      expect(trade.totalCommission).toBe(2);
      // 225 - 2 = 223
      expect(trade.netPnl).toBe(223);
    });
  });

  describe('Options filtering', () => {
    it('should skip rows with option-style symbols containing dates', () => {
      const result = parseSchwabCSV(OPTIONS_CSV);

      // Only the stock trade should be present
      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].symbol).toBe('AAPL');
      expect(result.metadata.optionsSkipped).toBe(2);
    });
  });

  describe('Commission handling', () => {
    it('should parse dollar-prefixed fees from the Fees & Comm column', () => {
      const result = parseSchwabCSV(BASIC_LONG_CSV);

      // Each execution should have commission = 1.00
      expect(result.executions[0].commission).toBe(1);
      expect(result.executions[1].commission).toBe(1);
    });

    it('should handle zero commission', () => {
      const csv = schwabCSV([
        '01/15/2024,Buy,AAPL,,100,$150.00,$0.00,-$15000.00',
        '01/15/2024,Sell,AAPL,,100,$155.00,$0.00,$15500.00',
      ]);
      const result = parseSchwabCSV(csv);

      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].totalCommission).toBe(0);
      expect(result.trades[0].grossPnl).toBe(result.trades[0].netPnl);
    });
  });

  describe('Duplicate hash detection', () => {
    it('should populate duplicateHashes when existing hashes are passed', () => {
      // First parse to gather execution hashes
      const firstParse = parseSchwabCSV(BASIC_LONG_CSV);
      expect(firstParse.executions).toHaveLength(2);

      // Build a set of execution-level hashes by re-deriving them
      // The parser generates hashes internally; we simulate by passing
      // the same content twice and collecting which hashes are duplicated.
      // We'll create hashes from the executions and pass them in.
      const { createHash } = require('crypto');
      const existingHashes = new Set<string>();
      for (const exec of firstParse.executions) {
        const data = `${exec.symbol}|${exec.dateTime.toISOString()}|${exec.side}|${exec.quantity}|${exec.price}`;
        const hash = createHash('sha256').update(data).digest('hex');
        existingHashes.add(hash);
      }

      const secondParse = parseSchwabCSV(BASIC_LONG_CSV, existingHashes);

      // All executions should be detected as duplicates
      expect(secondParse.duplicateHashes).toHaveLength(2);
      expect(secondParse.executions).toHaveLength(0);
      expect(secondParse.trades).toHaveLength(0);
    });
  });

  describe('Date parsing', () => {
    it('should parse MM/DD/YYYY format', () => {
      const result = parseSchwabCSV(BASIC_LONG_CSV);
      const entry = result.trades[0].entryTime;

      expect(entry.getFullYear()).toBe(2024);
      expect(entry.getMonth()).toBe(0); // January = 0
      expect(entry.getDate()).toBe(15);
    });

    it('should parse MM/DD/YYYY HH:MM:SS AM/PM format', () => {
      const result = parseSchwabCSV(DATE_WITH_TIME_CSV);

      expect(result.errors).toHaveLength(0);
      expect(result.trades).toHaveLength(1);

      const trade = result.trades[0];
      // 09:30:15 AM -> 09:30
      expect(trade.entryTime.getHours()).toBe(9);
      expect(trade.entryTime.getMinutes()).toBe(30);
      // 02:45:30 PM -> 14:45
      expect(trade.exitTime!.getHours()).toBe(14);
      expect(trade.exitTime!.getMinutes()).toBe(45);
    });

    it('should parse MM/DD/YYYY HH:MM:SS (24h) format', () => {
      const result = parseSchwabCSV(DATE_24H_CSV);

      expect(result.errors).toHaveLength(0);
      expect(result.trades).toHaveLength(1);

      const trade = result.trades[0];
      expect(trade.entryTime.getHours()).toBe(9);
      expect(trade.exitTime!.getHours()).toBe(14);
    });

    it('should calculate holdTimeMinutes from entry to exit', () => {
      const result = parseSchwabCSV(DATE_WITH_TIME_CSV);
      const trade = result.trades[0];

      // 09:30:15 to 14:45:30 = 5h 15m 15s = 315 minutes (rounded)
      expect(trade.holdTimeMinutes).toBe(315);
    });
  });

  describe('Win/loss classification', () => {
    it('should classify netPnl > 0 as a win', () => {
      const result = parseSchwabCSV(BASIC_LONG_CSV);
      const trade = result.trades[0];
      expect(trade.netPnl).toBeGreaterThan(0);
    });

    it('should classify netPnl < 0 as a loss', () => {
      const result = parseSchwabCSV(LOSING_TRADE_CSV);
      const trade = result.trades[0];

      // Gross P&L: (495 - 500) * 100 = -500
      expect(trade.grossPnl).toBe(-500);
      // Net P&L: -500 - 2 = -502
      expect(trade.netPnl).toBe(-502);
      expect(trade.netPnl).toBeLessThan(0);
    });

    it('should mark a break-even trade as a loss when commissions apply', () => {
      const csv = schwabCSV([
        '01/15/2024,Buy,FLAT,,100,$100.00,$1.00,-$10001.00',
        '01/15/2024,Sell,FLAT,,100,$100.00,$1.00,$9999.00',
      ]);
      const result = parseSchwabCSV(csv);
      const trade = result.trades[0];

      expect(trade.grossPnl).toBe(0);
      // Net P&L: 0 - 2 = -2
      expect(trade.netPnl).toBe(-2);
      expect(trade.netPnl).toBeLessThanOrEqual(0);
    });
  });

  describe('Error handling', () => {
    it('should return error for empty file', () => {
      const result = parseSchwabCSV('');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.trades).toHaveLength(0);
      expect(result.executions).toHaveLength(0);
    });

    it('should return error for a single line with no data rows', () => {
      const result = parseSchwabCSV('Date,Action,Symbol,Description,Quantity,Price,Fees & Comm,Amount');
      // Parser sees < 2 lines, returns emptyResult with an error
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('no data');
      expect(result.trades).toHaveLength(0);
    });

    it('should return error when Schwab headers are missing', () => {
      const csv = 'Name,Age,City\nJohn,30,NYC\nJane,25,LA';
      const result = parseSchwabCSV(csv);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('headers');
      expect(result.trades).toHaveLength(0);
    });

    it('should return error when required columns are missing', () => {
      const csv = 'Date,Action,Fees & Comm\n01/15/2024,Buy,$1.00';
      const result = parseSchwabCSV(csv);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Missing required columns');
      expect(result.trades).toHaveLength(0);
    });

    it('should report errors for rows with invalid data and continue parsing', () => {
      const csv = schwabCSV([
        '01/15/2024,Buy,AAPL,,100,$150.00,$1.00,-$15001.00',
        'INVALID_DATE,Buy,BAD,,100,$150.00,$1.00,-$15001.00',
        '01/15/2024,Sell,AAPL,,100,$155.00,$1.00,$15499.00',
      ]);
      const result = parseSchwabCSV(csv);

      // Should still produce 1 complete AAPL trade
      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].symbol).toBe('AAPL');
      // Should have 1 error for the invalid date row
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Non buy/sell actions are skipped', () => {
    it('should skip dividend or other action types', () => {
      const csv = schwabCSV([
        '01/15/2024,Buy,AAPL,,100,$150.00,$1.00,-$15001.00',
        '01/15/2024,Dividend,AAPL,,,$0.96,$0.00,$96.00',
        '01/15/2024,Journal,,,,,,$500.00',
        '01/15/2024,Sell,AAPL,,100,$155.00,$1.00,$15499.00',
      ]);
      const result = parseSchwabCSV(csv);

      expect(result.trades).toHaveLength(1);
      expect(result.executions).toHaveLength(2);
      // Non-buy/sell rows should be counted as skipped
      expect(result.metadata.skippedRows).toBeGreaterThanOrEqual(1);
    });
  });

  describe('P&L percent', () => {
    it('should calculate pnlPercent as gross P&L / position value * 100', () => {
      const result = parseSchwabCSV(BASIC_LONG_CSV);
      const trade = result.trades[0];

      // pnlPercent = (500 / (150 * 100)) * 100 = 3.3333...
      expect(trade.pnlPercent).toBeCloseTo(3.3333, 2);
    });
  });

  describe('Execution data integrity', () => {
    it('should set assetCategory to STK and currency to USD', () => {
      const result = parseSchwabCSV(BASIC_LONG_CSV);

      for (const exec of result.executions) {
        expect(exec.assetCategory).toBe('STK');
        expect(exec.currency).toBe('USD');
      }
    });

    it('should populate rawRow with all column values', () => {
      const result = parseSchwabCSV(BASIC_LONG_CSV);
      const exec = result.executions[0];

      expect(exec.rawRow['Date']).toBe('01/15/2024');
      expect(exec.rawRow['Action']).toBe('Buy');
      expect(exec.rawRow['Symbol']).toBe('AAPL');
    });

    it('should generate unique executionHash for each trade', () => {
      const result = parseSchwabCSV(MULTIPLE_SYMBOLS_CSV);
      const hashes = result.trades.map((t) => t.executionHash);

      expect(new Set(hashes).size).toBe(hashes.length);
    });
  });
});

describe('Broker Detection (Schwab)', () => {
  it('should detect schwab from Fees & Comm header', () => {
    expect(detectBroker(BASIC_LONG_CSV)).toBe('schwab');
  });

  it('should detect schwab from Fees &amp; Comm header (HTML-encoded)', () => {
    const csv = 'Date,Action,Symbol,Description,Quantity,Price,Fees &amp; Comm,Amount\n01/15/2024,Buy,AAPL,,100,$150.00,$1.00,-$15001.00';
    expect(detectBroker(csv)).toBe('schwab');
  });

  it('should not detect schwab for IBKR content', () => {
    const ibkr = 'Symbol,DateTime,Quantity,T. Price,Proceeds,Commission,Buy/Sell,AssetCategory,Currency,ClientAccountID\nAAPL,2024-03-15,100,172.50,-17250,1,BOT,STK,USD,U1234';
    expect(detectBroker(ibkr)).toBe('ibkr');
  });
});

describe('parseTradeCSV routing (Schwab)', () => {
  it('should route Schwab content to Schwab parser', () => {
    const result = parseTradeCSV(BASIC_LONG_CSV);

    expect(result.metadata.brokerFormat).toBe('schwab');
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].symbol).toBe('AAPL');
  });

  it('should pass existingHashes through to the Schwab parser', () => {
    const firstParse = parseTradeCSV(BASIC_LONG_CSV);
    const { createHash } = require('crypto');
    const existingHashes = new Set<string>();
    for (const exec of firstParse.executions) {
      const data = `${exec.symbol}|${exec.dateTime.toISOString()}|${exec.side}|${exec.quantity}|${exec.price}`;
      existingHashes.add(createHash('sha256').update(data).digest('hex'));
    }

    const secondParse = parseTradeCSV(BASIC_LONG_CSV, existingHashes);
    expect(secondParse.duplicateHashes).toHaveLength(2);
    expect(secondParse.executions).toHaveLength(0);
  });
});
