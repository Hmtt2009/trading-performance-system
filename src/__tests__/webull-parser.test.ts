import { describe, it, expect } from 'vitest';
import { parseWebullCSV } from '@/lib/parsers/webull';
import { detectBroker } from '@/lib/parsers';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Helper — mirrors the parser's own hash function so we can test dedup.
// ---------------------------------------------------------------------------
function execHash(symbol: string, isoDate: string, side: string, qty: number, price: number): string {
  const data = `${symbol}|${isoDate}|${side}|${qty}|${price}`;
  return createHash('sha256').update(data).digest('hex');
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASIC_LONG_CSV = [
  'Symbol,Trade Time,Side,Filled Qty,Avg Price,Status,Fee',
  'AAPL,01/15/2024 09:30:15,Buy,100,150.00,Filled,0.01',
  'AAPL,01/15/2024 10:15:30,Sell,100,155.00,Filled,0.01',
].join('\n');

const SHORT_TRADE_CSV = [
  'Symbol,Trade Time,Side,Filled Qty,Avg Price,Status,Fee',
  'TSLA,02/20/2024 09:31:00,Sell,200,210.00,Filled,0.02',
  'TSLA,02/20/2024 10:45:00,Buy,200,205.00,Filled,0.02',
].join('\n');

const MULTI_SYMBOL_CSV = [
  'Symbol,Trade Time,Side,Filled Qty,Avg Price,Status,Fee',
  'AAPL,03/10/2024 09:30:00,Buy,50,170.00,Filled,0.01',
  'AAPL,03/10/2024 10:00:00,Sell,50,172.00,Filled,0.01',
  'MSFT,03/10/2024 11:00:00,Buy,100,420.00,Filled,0.01',
  'MSFT,03/10/2024 14:30:00,Sell,100,418.00,Filled,0.01',
].join('\n');

const OPEN_POSITION_CSV = [
  'Symbol,Trade Time,Side,Filled Qty,Avg Price,Status,Fee',
  'NVDA,04/05/2024 09:35:00,Buy,100,880.00,Filled,0.01',
].join('\n');

const STATUS_FILTERING_CSV = [
  'Symbol,Trade Time,Side,Filled Qty,Avg Price,Status,Fee',
  'AAPL,01/15/2024 09:30:15,Buy,100,150.00,Filled,0.01',
  'AAPL,01/15/2024 09:31:00,Buy,50,151.00,Cancelled,0.00',
  'AAPL,01/15/2024 09:32:00,Buy,25,149.50,Partially Filled,0.01',
  'AAPL,01/15/2024 10:15:30,Sell,125,155.00,Filled,0.01',
  'AAPL,01/15/2024 10:16:00,Sell,50,154.00,Rejected,0.00',
].join('\n');

const OPTIONS_CSV = [
  'Symbol,Trade Time,Side,Filled Qty,Avg Price,Status,Fee',
  'AAPL,01/15/2024 09:30:15,Buy,100,150.00,Filled,0.01',
  'AAPL,01/15/2024 10:15:30,Sell,100,155.00,Filled,0.01',
  'AAPL240119C00150000,01/15/2024 09:35:00,Buy,5,3.20,Filled,0.65',
  'AAPL240119C00150000,01/15/2024 10:00:00,Sell,5,4.10,Filled,0.65',
].join('\n');

const COMMISSION_CSV = [
  'Symbol,Trade Time,Side,Filled Qty,Avg Price,Status,Fee',
  'SPY,05/01/2024 09:30:00,Buy,100,510.00,Filled,1.50',
  'SPY,05/01/2024 10:00:00,Sell,100,512.00,Filled,1.50',
].join('\n');

// Note: Webull header detection requires BOTH "Trade Time" AND "Filled Qty"
// to appear literally in the header row. The findCol helper then resolves
// alternative column names like Ticker and Filled Price. So "Filled Qty"
// MUST be present, but Symbol can be replaced with Ticker, and "Avg Price"
// can be replaced with "Filled Price".
const ALT_COLUMNS_CSV = [
  'Ticker,Trade Time,Side,Filled Qty,Filled Price,Status,Fee',
  'AAPL,01/15/2024 09:30:15,Buy,100,150.00,Filled,0.01',
  'AAPL,01/15/2024 10:15:30,Sell,100,155.00,Filled,0.01',
].join('\n');

const SLD_SIDE_CSV = [
  'Symbol,Trade Time,Side,Filled Qty,Avg Price,Status,Fee',
  'AMD,06/10/2024 09:30:00,Buy,100,160.00,Filled,0.01',
  'AMD,06/10/2024 10:00:00,SLD,100,162.00,Filled,0.01',
].join('\n');

const S_SIDE_CSV = [
  'Symbol,Trade Time,Side,Filled Qty,Avg Price,Status,Fee',
  'QQQ,06/10/2024 09:30:00,Buy,50,440.00,Filled,0.01',
  'QQQ,06/10/2024 10:00:00,S,50,442.00,Filled,0.01',
].join('\n');

const EST_TIMEZONE_CSV = [
  'Symbol,Trade Time,Side,Filled Qty,Avg Price,Status,Fee',
  'AAPL,01/15/2024 09:30:15 EST,Buy,100,150.00,Filled,0.01',
  'AAPL,01/15/2024 10:15:30 EST,Sell,100,155.00,Filled,0.01',
].join('\n');

const ISO_DATE_CSV = [
  'Symbol,Trade Time,Side,Filled Qty,Avg Price,Status,Fee',
  'AAPL,2024-01-15T09:30:15,Buy,100,150.00,Filled,0.01',
  'AAPL,2024-01-15T10:15:30,Sell,100,155.00,Filled,0.01',
].join('\n');

const NO_STATUS_COLUMN_CSV = [
  'Symbol,Trade Time,Side,Filled Qty,Avg Price,Fee',
  'AAPL,01/15/2024 09:30:15,Buy,100,150.00,0.01',
  'AAPL,01/15/2024 10:15:30,Sell,100,155.00,0.01',
].join('\n');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Webull Parser', () => {
  describe('Basic long round-trip', () => {
    it('should parse a buy-then-sell into one closed long trade', () => {
      const result = parseWebullCSV(BASIC_LONG_CSV);

      expect(result.errors).toHaveLength(0);
      expect(result.executions).toHaveLength(2);
      expect(result.trades).toHaveLength(1);

      const trade = result.trades[0];
      expect(trade.symbol).toBe('AAPL');
      expect(trade.direction).toBe('long');
      expect(trade.entryPrice).toBe(150);
      expect(trade.exitPrice).toBe(155);
      expect(trade.quantity).toBe(100);
      expect(trade.isOpen).toBe(false);
    });

    it('should calculate P&L correctly for a winning long trade', () => {
      const result = parseWebullCSV(BASIC_LONG_CSV);
      const trade = result.trades[0];

      // Gross P&L: (155 - 150) * 100 = 500
      expect(trade.grossPnl).toBe(500);
      // Net P&L: 500 - (0.01 + 0.01) = 499.98
      expect(trade.netPnl).toBeCloseTo(499.98, 2);
      expect(trade.pnlPercent).toBeCloseTo(3.3333, 2);
    });
  });

  describe('Short trades', () => {
    it('should identify sell-first-then-buy as a short trade', () => {
      const result = parseWebullCSV(SHORT_TRADE_CSV);

      expect(result.errors).toHaveLength(0);
      expect(result.trades).toHaveLength(1);

      const trade = result.trades[0];
      expect(trade.direction).toBe('short');
      expect(trade.entryPrice).toBe(210);
      expect(trade.exitPrice).toBe(205);
      expect(trade.quantity).toBe(200);
      expect(trade.isOpen).toBe(false);
    });

    it('should calculate short P&L correctly', () => {
      const result = parseWebullCSV(SHORT_TRADE_CSV);
      const trade = result.trades[0];

      // Short P&L: (210 - 205) * 200 = 1000
      expect(trade.grossPnl).toBe(1000);
      // Net: 1000 - 0.04 = 999.96
      expect(trade.netPnl).toBeCloseTo(999.96, 2);
    });
  });

  describe('Multiple symbols same day', () => {
    it('should produce separate trades for each symbol', () => {
      const result = parseWebullCSV(MULTI_SYMBOL_CSV);

      expect(result.errors).toHaveLength(0);
      expect(result.trades).toHaveLength(2);

      const symbols = result.trades.map((t) => t.symbol).sort();
      expect(symbols).toEqual(['AAPL', 'MSFT']);
    });

    it('should calculate P&L independently per symbol', () => {
      const result = parseWebullCSV(MULTI_SYMBOL_CSV);

      const aapl = result.trades.find((t) => t.symbol === 'AAPL')!;
      const msft = result.trades.find((t) => t.symbol === 'MSFT')!;

      // AAPL: (172 - 170) * 50 = 100 gross
      expect(aapl.grossPnl).toBe(100);
      // MSFT: (418 - 420) * 100 = -200 gross
      expect(msft.grossPnl).toBe(-200);
    });
  });

  describe('Open position (no exit)', () => {
    it('should produce an open trade with null exit fields', () => {
      const result = parseWebullCSV(OPEN_POSITION_CSV);

      expect(result.errors).toHaveLength(0);
      expect(result.trades).toHaveLength(1);

      const trade = result.trades[0];
      expect(trade.symbol).toBe('NVDA');
      expect(trade.direction).toBe('long');
      expect(trade.isOpen).toBe(true);
      expect(trade.exitTime).toBeNull();
      expect(trade.exitPrice).toBeNull();
      expect(trade.grossPnl).toBeNull();
      expect(trade.netPnl).toBeNull();
      expect(trade.pnlPercent).toBeNull();
      expect(trade.holdTimeMinutes).toBeNull();
    });

    it('should set positionValue for open positions', () => {
      const result = parseWebullCSV(OPEN_POSITION_CSV);
      const trade = result.trades[0];

      // 880 * 100 = 88000
      expect(trade.positionValue).toBe(88000);
    });
  });

  describe('Broker detection', () => {
    it('should detect webull from CSV content', () => {
      expect(detectBroker(BASIC_LONG_CSV)).toBe('webull');
    });

    it('should not misdetect a non-Webull file as webull', () => {
      const csv = 'DATE,TRANSACTION ID,DESCRIPTION,QUANTITY,SYMBOL,PRICE\n01/15/2024,1,Bought,100,AAPL,150';
      expect(detectBroker(csv)).not.toBe('webull');
    });
  });

  describe('Empty file and missing headers', () => {
    it('should return an error for an empty file', () => {
      const result = parseWebullCSV('');

      expect(result.trades).toHaveLength(0);
      expect(result.executions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('no data');
    });

    it('should return an error when headers are missing required columns', () => {
      const csv = [
        'Symbol,Trade Time,Side,Filled Qty',
        'AAPL,01/15/2024 09:30:15,Buy,100',
      ].join('\n');

      // Missing "Avg Price" / "Filled Price" / "Price" => priceIdx === -1
      const result = parseWebullCSV(csv);

      expect(result.trades).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Missing required columns');
    });

    it('should return an error when the file has no Webull headers at all', () => {
      const csv = [
        'Name,Age,City',
        'John,30,NYC',
      ].join('\n');

      const result = parseWebullCSV(csv);

      expect(result.trades).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Could not find Webull CSV headers');
    });
  });

  describe('Status filtering', () => {
    it('should parse Filled and Partially Filled rows, skip Cancelled and Rejected', () => {
      const result = parseWebullCSV(STATUS_FILTERING_CSV);

      // Filled buy (100), Partially Filled buy (25), Filled sell (125) => 3 executions
      // Cancelled buy (50) and Rejected sell (50) should be skipped
      expect(result.executions).toHaveLength(3);
      expect(result.metadata.skippedRows).toBe(2);
    });

    it('should still parse all rows when there is no Status column', () => {
      const result = parseWebullCSV(NO_STATUS_COLUMN_CSV);

      expect(result.executions).toHaveLength(2);
      expect(result.trades).toHaveLength(1);
    });
  });

  describe('Options filtering', () => {
    it('should skip OCC-style option symbols (e.g. AAPL240119C00150000)', () => {
      const result = parseWebullCSV(OPTIONS_CSV);

      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].symbol).toBe('AAPL');
      expect(result.metadata.optionsSkipped).toBe(2);
    });

    it('should not skip short stock symbols that contain digits', () => {
      const csv = [
        'Symbol,Trade Time,Side,Filled Qty,Avg Price,Status,Fee',
        'A1BC,01/15/2024 09:30:15,Buy,100,10.00,Filled,0.01',
        'A1BC,01/15/2024 10:15:30,Sell,100,11.00,Filled,0.01',
      ].join('\n');

      const result = parseWebullCSV(csv);
      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].symbol).toBe('A1BC');
      expect(result.metadata.optionsSkipped).toBe(0);
    });
  });

  describe('Commission from Fee column', () => {
    it('should use Fee column values as commission', () => {
      const result = parseWebullCSV(COMMISSION_CSV);
      const trade = result.trades[0];

      // Gross P&L: (512 - 510) * 100 = 200
      expect(trade.grossPnl).toBe(200);
      // Net P&L: 200 - (1.50 + 1.50) = 197
      expect(trade.netPnl).toBe(197);
      expect(trade.totalCommission).toBe(3);
    });

    it('should treat missing Fee column as zero commission', () => {
      // Webull header detection requires Trade Time + Filled Qty, not Fee
      const csv = [
        'Symbol,Trade Time,Side,Filled Qty,Avg Price',
        'AAPL,01/15/2024 09:30:15,Buy,100,150.00',
        'AAPL,01/15/2024 10:15:30,Sell,100,155.00',
      ].join('\n');

      const result = parseWebullCSV(csv);
      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].totalCommission).toBe(0);
      expect(result.trades[0].grossPnl).toBe(result.trades[0].netPnl);
    });
  });

  describe('Duplicate hash detection', () => {
    it('should skip executions whose hash is already known', () => {
      const firstParse = parseWebullCSV(BASIC_LONG_CSV);
      expect(firstParse.executions).toHaveLength(2);

      // Build a set from each execution hash
      const hashes = new Set<string>();
      for (const exec of firstParse.executions) {
        const h = execHash(
          exec.symbol,
          exec.dateTime.toISOString(),
          exec.side,
          exec.quantity,
          exec.price
        );
        hashes.add(h);
      }

      const secondParse = parseWebullCSV(BASIC_LONG_CSV, hashes);
      expect(secondParse.executions).toHaveLength(0);
      expect(secondParse.duplicateHashes).toHaveLength(2);
      expect(secondParse.trades).toHaveLength(0);
    });

    it('should still parse non-duplicate rows when some are duplicates', () => {
      const firstParse = parseWebullCSV(BASIC_LONG_CSV);
      const buyExec = firstParse.executions.find((e) => e.side === 'buy')!;
      const hashes = new Set<string>([
        execHash(buyExec.symbol, buyExec.dateTime.toISOString(), buyExec.side, buyExec.quantity, buyExec.price),
      ]);

      const secondParse = parseWebullCSV(BASIC_LONG_CSV, hashes);
      expect(secondParse.executions).toHaveLength(1);
      expect(secondParse.executions[0].side).toBe('sell');
      expect(secondParse.duplicateHashes).toHaveLength(1);
    });
  });

  describe('Date parsing', () => {
    it('should parse MM/DD/YYYY HH:MM:SS format', () => {
      const result = parseWebullCSV(BASIC_LONG_CSV);
      const exec = result.executions[0];

      expect(exec.dateTime.getFullYear()).toBe(2024);
      expect(exec.dateTime.getMonth()).toBe(0); // January
      expect(exec.dateTime.getDate()).toBe(15);
      expect(exec.dateTime.getHours()).toBe(9);
      expect(exec.dateTime.getMinutes()).toBe(30);
      expect(exec.dateTime.getSeconds()).toBe(15);
    });

    it('should strip timezone abbreviation (EST) and still parse', () => {
      const result = parseWebullCSV(EST_TIMEZONE_CSV);

      expect(result.errors).toHaveLength(0);
      expect(result.executions).toHaveLength(2);

      const exec = result.executions[0];
      expect(exec.dateTime.getFullYear()).toBe(2024);
      expect(exec.dateTime.getHours()).toBe(9);
    });

    it('should parse ISO format (YYYY-MM-DDTHH:MM:SS)', () => {
      const result = parseWebullCSV(ISO_DATE_CSV);

      expect(result.errors).toHaveLength(0);
      expect(result.executions).toHaveLength(2);

      const exec = result.executions[0];
      expect(exec.dateTime.getFullYear()).toBe(2024);
      expect(exec.dateTime.getMonth()).toBe(0);
      expect(exec.dateTime.getDate()).toBe(15);
    });

    it('should report an error for invalid dates', () => {
      const csv = [
        'Symbol,Trade Time,Side,Filled Qty,Avg Price,Status,Fee',
        'AAPL,NOTADATE,Buy,100,150.00,Filled,0.01',
      ].join('\n');

      const result = parseWebullCSV(csv);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors[0].message).toContain('Invalid date');
    });
  });

  describe('Side detection', () => {
    it('should detect "Buy" as buy', () => {
      const result = parseWebullCSV(BASIC_LONG_CSV);
      expect(result.executions[0].side).toBe('buy');
    });

    it('should detect "Sell" as sell', () => {
      const result = parseWebullCSV(BASIC_LONG_CSV);
      expect(result.executions[1].side).toBe('sell');
    });

    it('should detect "SLD" as sell', () => {
      const result = parseWebullCSV(SLD_SIDE_CSV);

      expect(result.executions).toHaveLength(2);
      const sellExec = result.executions.find((e) => e.side === 'sell');
      expect(sellExec).toBeDefined();
      expect(sellExec!.symbol).toBe('AMD');
    });

    it('should detect "S" as sell', () => {
      const result = parseWebullCSV(S_SIDE_CSV);

      expect(result.executions).toHaveLength(2);
      const sellExec = result.executions.find((e) => e.side === 'sell');
      expect(sellExec).toBeDefined();
      expect(sellExec!.symbol).toBe('QQQ');
    });

    it('should default to buy for unknown side values', () => {
      const csv = [
        'Symbol,Trade Time,Side,Filled Qty,Avg Price,Status,Fee',
        'AAPL,01/15/2024 09:30:15,UNKNOWN,100,150.00,Filled,0.01',
      ].join('\n');

      const result = parseWebullCSV(csv);
      expect(result.executions).toHaveLength(1);
      expect(result.executions[0].side).toBe('buy');
    });
  });

  describe('Alternative column names', () => {
    it('should accept Ticker instead of Symbol and Filled Price instead of Avg Price', () => {
      const result = parseWebullCSV(ALT_COLUMNS_CSV);

      expect(result.errors).toHaveLength(0);
      expect(result.executions).toHaveLength(2);
      expect(result.trades).toHaveLength(1);

      const trade = result.trades[0];
      expect(trade.symbol).toBe('AAPL');
      expect(trade.entryPrice).toBe(150);
      expect(trade.exitPrice).toBe(155);
    });
  });

  describe('Metadata', () => {
    it('should report correct metadata for a standard parse', () => {
      const result = parseWebullCSV(MULTI_SYMBOL_CSV);

      expect(result.metadata.brokerFormat).toBe('webull');
      expect(result.metadata.parsedRows).toBe(4);
      expect(result.metadata.errorRows).toBe(0);
      expect(result.metadata.optionsSkipped).toBe(0);
      expect(result.metadata.totalRows).toBe(4);
    });

    it('should count skipped rows (cancelled orders) in metadata', () => {
      const result = parseWebullCSV(STATUS_FILTERING_CSV);

      expect(result.metadata.skippedRows).toBe(2);
      expect(result.metadata.parsedRows).toBe(3);
    });

    it('should count options skipped in metadata', () => {
      const result = parseWebullCSV(OPTIONS_CSV);

      expect(result.metadata.optionsSkipped).toBe(2);
    });
  });

  describe('Hold time calculation', () => {
    it('should compute holdTimeMinutes correctly', () => {
      const result = parseWebullCSV(BASIC_LONG_CSV);
      const trade = result.trades[0];

      // 09:30:15 to 10:15:30 = 45.25 minutes, rounded to 45
      expect(trade.holdTimeMinutes).toBe(45);
    });
  });
});
