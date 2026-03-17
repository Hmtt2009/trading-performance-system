import { describe, it, expect } from 'vitest';
import { parseTDAmeritradeCSV } from '@/lib/parsers/tdameritrade';
import { detectBroker } from '@/lib/parsers';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Helper to build a hash the same way the parser does, so we can test
// duplicate-detection by feeding known hashes into existingHashes.
// ---------------------------------------------------------------------------
function execHash(symbol: string, isoDate: string, side: string, qty: number, price: number): string {
  const data = `${symbol}|${isoDate}|${side}|${qty}|${price}`;
  return createHash('sha256').update(data).digest('hex');
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASIC_LONG_CSV = [
  'DATE,TRANSACTION ID,DESCRIPTION,QUANTITY,SYMBOL,PRICE,COMMISSION,AMOUNT',
  '01/15/2024,12345,Bought 100 AAPL,100,AAPL,150.00,0.00,-15000.00',
  '01/15/2024,12346,Sold 100 AAPL,100,AAPL,155.00,0.00,15500.00',
].join('\n');

const SHORT_TRADE_CSV = [
  'DATE,TRANSACTION ID,DESCRIPTION,QUANTITY,SYMBOL,PRICE,COMMISSION,AMOUNT',
  '02/20/2024,22001,Sold 200 TSLA,-200,TSLA,210.00,0.00,42000.00',
  '02/20/2024,22002,Bought 200 TSLA,200,TSLA,205.00,0.00,-41000.00',
].join('\n');

const MULTI_SYMBOL_CSV = [
  'DATE,TRANSACTION ID,DESCRIPTION,QUANTITY,SYMBOL,PRICE,COMMISSION,AMOUNT',
  '03/10/2024,30001,Bought 50 AAPL,50,AAPL,170.00,1.00,-8501.00',
  '03/10/2024,30002,Sold 50 AAPL,50,AAPL,172.00,1.00,8599.00',
  '03/10/2024,30003,Bought 100 MSFT,100,MSFT,420.00,1.00,-42001.00',
  '03/10/2024,30004,Sold 100 MSFT,100,MSFT,418.00,1.00,41799.00',
].join('\n');

const OPEN_POSITION_CSV = [
  'DATE,TRANSACTION ID,DESCRIPTION,QUANTITY,SYMBOL,PRICE,COMMISSION,AMOUNT',
  '04/05/2024,40001,Bought 100 NVDA,100,NVDA,880.00,0.50,-88000.50',
].join('\n');

const WITH_COMMISSION_CSV = [
  'DATE,TRANSACTION ID,DESCRIPTION,QUANTITY,SYMBOL,PRICE,COMMISSION,AMOUNT',
  '05/01/2024,50001,Bought 100 SPY,100,SPY,510.00,1.50,-51001.50',
  '05/01/2024,50002,Sold 100 SPY,100,SPY,512.00,1.50,51198.50',
].join('\n');

const OPTIONS_CSV = [
  'DATE,TRANSACTION ID,DESCRIPTION,QUANTITY,SYMBOL,PRICE,COMMISSION,AMOUNT',
  '06/01/2024,60001,Bought 100 AAPL,100,AAPL,175.00,0.00,-17500.00',
  '06/01/2024,60002,Sold 100 AAPL,100,AAPL,177.00,0.00,17700.00',
  '06/01/2024,60003,Bought 5 AAPL 240621C175,5,AAPL 240621C175,3.20,0.65,-16.65',
  '06/01/2024,60004,Sold 5 AAPL 240621C175,5,AAPL 240621C175,4.10,0.65,19.85',
].join('\n');

const SUMMARY_LINES_CSV = [
  'DATE,TRANSACTION ID,DESCRIPTION,QUANTITY,SYMBOL,PRICE,COMMISSION,AMOUNT',
  '07/01/2024,70001,Bought 50 AMD,50,AMD,160.00,0.00,-8000.00',
  '07/01/2024,70002,Sold 50 AMD,50,AMD,162.00,0.00,8100.00',
  '***Total for selected period',
  'Total,,,,,,,-100.00',
].join('\n');

const HEADER_OFFSET_CSV = [
  'Account: 123456789',
  'Generated: 2024-01-20',
  'DATE,TRANSACTION ID,DESCRIPTION,QUANTITY,SYMBOL,PRICE,COMMISSION,AMOUNT',
  '01/15/2024,12345,Bought 100 AAPL,100,AAPL,150.00,0.00,-15000.00',
  '01/15/2024,12346,Sold 100 AAPL,100,AAPL,155.00,0.00,15500.00',
].join('\n');

const NON_TRADE_ROWS_CSV = [
  'DATE,TRANSACTION ID,DESCRIPTION,QUANTITY,SYMBOL,PRICE,COMMISSION,AMOUNT',
  '01/15/2024,90001,Bought 100 AAPL,100,AAPL,150.00,0.00,-15000.00',
  '01/15/2024,90002,DIVIDEND,0,AAPL,0.00,0.00,96.00',
  '01/15/2024,90003,INTEREST,0,,0.00,0.00,1.25',
  '01/15/2024,90004,Sold 100 AAPL,100,AAPL,155.00,0.00,15500.00',
].join('\n');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TD Ameritrade Parser', () => {
  describe('Basic long round-trip', () => {
    it('should parse a buy-then-sell into one closed long trade', () => {
      const result = parseTDAmeritradeCSV(BASIC_LONG_CSV);

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
      const result = parseTDAmeritradeCSV(BASIC_LONG_CSV);
      const trade = result.trades[0];

      // Gross P&L: (155 - 150) * 100 = 500
      expect(trade.grossPnl).toBe(500);
      // No commission, so net = gross
      expect(trade.netPnl).toBe(500);
      // P&L %: (500 / (150 * 100)) * 100 = 3.3333...
      expect(trade.pnlPercent).toBeCloseTo(3.3333, 2);
    });
  });

  describe('Short trades', () => {
    it('should identify a sell-first-then-buy as a short trade', () => {
      const result = parseTDAmeritradeCSV(SHORT_TRADE_CSV);

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
      const result = parseTDAmeritradeCSV(SHORT_TRADE_CSV);
      const trade = result.trades[0];

      // Short P&L: (210 - 205) * 200 = 1000
      expect(trade.grossPnl).toBe(1000);
      expect(trade.netPnl).toBe(1000);
    });
  });

  describe('Multiple symbols same day', () => {
    it('should produce separate trades for each symbol', () => {
      const result = parseTDAmeritradeCSV(MULTI_SYMBOL_CSV);

      expect(result.errors).toHaveLength(0);
      expect(result.trades).toHaveLength(2);

      const symbols = result.trades.map((t) => t.symbol).sort();
      expect(symbols).toEqual(['AAPL', 'MSFT']);
    });

    it('should calculate P&L independently per symbol', () => {
      const result = parseTDAmeritradeCSV(MULTI_SYMBOL_CSV);

      const aapl = result.trades.find((t) => t.symbol === 'AAPL')!;
      const msft = result.trades.find((t) => t.symbol === 'MSFT')!;

      // AAPL: (172 - 170) * 50 = 100 gross
      expect(aapl.grossPnl).toBe(100);
      // AAPL: 100 - 2 (commissions) = 98 net
      expect(aapl.netPnl).toBe(98);

      // MSFT: (418 - 420) * 100 = -200 gross
      expect(msft.grossPnl).toBe(-200);
      // MSFT: -200 - 2 = -202 net
      expect(msft.netPnl).toBe(-202);
    });
  });

  describe('Open position (no exit)', () => {
    it('should produce an open trade with null exit fields', () => {
      const result = parseTDAmeritradeCSV(OPEN_POSITION_CSV);

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
      const result = parseTDAmeritradeCSV(OPEN_POSITION_CSV);
      const trade = result.trades[0];

      // 880 * 100 = 88000
      expect(trade.positionValue).toBe(88000);
    });
  });

  describe('Broker detection', () => {
    it('should detect tdameritrade from CSV content', () => {
      expect(detectBroker(BASIC_LONG_CSV)).toBe('tdameritrade');
    });

    it('should detect tdameritrade even with preamble lines before the header', () => {
      expect(detectBroker(HEADER_OFFSET_CSV)).toBe('tdameritrade');
    });
  });

  describe('Empty file and missing headers', () => {
    it('should return an error for an empty file', () => {
      const result = parseTDAmeritradeCSV('');

      expect(result.trades).toHaveLength(0);
      expect(result.executions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('no data');
    });

    it('should return an error for a single header-only row', () => {
      const result = parseTDAmeritradeCSV(
        'DATE,TRANSACTION ID,DESCRIPTION,QUANTITY,SYMBOL,PRICE,COMMISSION,AMOUNT'
      );

      // One header line, zero data lines. The filter removes empty lines so
      // lines.length === 1 which is < 2 => emptyResult.
      expect(result.trades).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
    });

    it('should return an error when required headers are missing', () => {
      const csv = [
        'DATE,TRANSACTION ID,DESCRIPTION,FOO,BAR',
        '01/15/2024,12345,Bought 100 AAPL,100,AAPL',
      ].join('\n');

      const result = parseTDAmeritradeCSV(csv);

      expect(result.trades).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Missing required columns');
    });

    it('should return an error when headers do not contain TRANSACTION ID', () => {
      const csv = [
        'DATE,ID,DESCRIPTION,QUANTITY,SYMBOL,PRICE,COMMISSION,AMOUNT',
        '01/15/2024,12345,Bought 100 AAPL,100,AAPL,150.00,0.00,-15000.00',
      ].join('\n');

      const result = parseTDAmeritradeCSV(csv);

      expect(result.trades).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Could not find TD Ameritrade CSV headers');
    });
  });

  describe('Options filtering', () => {
    it('should skip options (symbol with digits and spaces, length > 6)', () => {
      const result = parseTDAmeritradeCSV(OPTIONS_CSV);

      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].symbol).toBe('AAPL');
      expect(result.metadata.optionsSkipped).toBe(2);
    });

    it('should not skip short stock symbols that happen to have digits', () => {
      // A symbol <= 6 chars should NOT be filtered even if it has a digit
      const csv = [
        'DATE,TRANSACTION ID,DESCRIPTION,QUANTITY,SYMBOL,PRICE,COMMISSION,AMOUNT',
        '01/15/2024,80001,Bought 100 A1BC,100,A1BC,10.00,0.00,-1000.00',
        '01/15/2024,80002,Sold 100 A1BC,100,A1BC,11.00,0.00,1100.00',
      ].join('\n');

      const result = parseTDAmeritradeCSV(csv);
      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].symbol).toBe('A1BC');
      expect(result.metadata.optionsSkipped).toBe(0);
    });
  });

  describe('Summary / total line handling', () => {
    it('should stop parsing at lines starting with "***"', () => {
      const result = parseTDAmeritradeCSV(SUMMARY_LINES_CSV);

      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].symbol).toBe('AMD');
      // The two summary lines should NOT be parsed as data rows
      expect(result.executions).toHaveLength(2);
    });

    it('should stop parsing at lines starting with "Total"', () => {
      const csv = [
        'DATE,TRANSACTION ID,DESCRIPTION,QUANTITY,SYMBOL,PRICE,COMMISSION,AMOUNT',
        '07/01/2024,70001,Bought 50 AMD,50,AMD,160.00,0.00,-8000.00',
        '07/01/2024,70002,Sold 50 AMD,50,AMD,162.00,0.00,8100.00',
        'Total,,,,,,,-100.00',
      ].join('\n');

      const result = parseTDAmeritradeCSV(csv);
      expect(result.trades).toHaveLength(1);
      expect(result.executions).toHaveLength(2);
    });
  });

  describe('Commission handling', () => {
    it('should include commissions in netPnl calculation', () => {
      const result = parseTDAmeritradeCSV(WITH_COMMISSION_CSV);
      const trade = result.trades[0];

      // Gross P&L: (512 - 510) * 100 = 200
      expect(trade.grossPnl).toBe(200);
      // Net P&L: 200 - (1.50 + 1.50) = 197
      expect(trade.netPnl).toBe(197);
      expect(trade.totalCommission).toBe(3);
    });

    it('should handle zero commissions', () => {
      const result = parseTDAmeritradeCSV(BASIC_LONG_CSV);
      const trade = result.trades[0];

      expect(trade.totalCommission).toBe(0);
      expect(trade.grossPnl).toBe(trade.netPnl);
    });
  });

  describe('Duplicate hash detection', () => {
    it('should skip executions whose hash is already known', () => {
      // First parse — get the execution hashes
      const firstParse = parseTDAmeritradeCSV(BASIC_LONG_CSV);
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

      // Second parse with the same content — all should be duplicates
      const secondParse = parseTDAmeritradeCSV(BASIC_LONG_CSV, hashes);
      expect(secondParse.executions).toHaveLength(0);
      expect(secondParse.duplicateHashes).toHaveLength(2);
      expect(secondParse.trades).toHaveLength(0);
    });

    it('should still parse non-duplicate rows when some are duplicates', () => {
      const firstParse = parseTDAmeritradeCSV(BASIC_LONG_CSV);
      // Only mark the buy as a duplicate
      const buyExec = firstParse.executions.find((e) => e.side === 'buy')!;
      const hashes = new Set<string>([
        execHash(buyExec.symbol, buyExec.dateTime.toISOString(), buyExec.side, buyExec.quantity, buyExec.price),
      ]);

      const secondParse = parseTDAmeritradeCSV(BASIC_LONG_CSV, hashes);
      // Only the sell should remain
      expect(secondParse.executions).toHaveLength(1);
      expect(secondParse.executions[0].side).toBe('sell');
      expect(secondParse.duplicateHashes).toHaveLength(1);
    });
  });

  describe('Date parsing (MM/DD/YYYY format)', () => {
    it('should parse standard MM/DD/YYYY dates', () => {
      const result = parseTDAmeritradeCSV(BASIC_LONG_CSV);

      const exec = result.executions[0];
      expect(exec.dateTime.getFullYear()).toBe(2024);
      expect(exec.dateTime.getMonth()).toBe(0); // January is 0
      expect(exec.dateTime.getDate()).toBe(15);
    });

    it('should handle single-digit month/day like 1/5/2024', () => {
      const csv = [
        'DATE,TRANSACTION ID,DESCRIPTION,QUANTITY,SYMBOL,PRICE,COMMISSION,AMOUNT',
        '1/5/2024,10001,Bought 100 SPY,100,SPY,470.00,0.00,-47000.00',
        '1/5/2024,10002,Sold 100 SPY,100,SPY,472.00,0.00,47200.00',
      ].join('\n');

      const result = parseTDAmeritradeCSV(csv);
      expect(result.errors).toHaveLength(0);
      expect(result.executions).toHaveLength(2);

      const exec = result.executions[0];
      expect(exec.dateTime.getMonth()).toBe(0); // January
      expect(exec.dateTime.getDate()).toBe(5);
    });

    it('should report an error for invalid dates', () => {
      const csv = [
        'DATE,TRANSACTION ID,DESCRIPTION,QUANTITY,SYMBOL,PRICE,COMMISSION,AMOUNT',
        'NOTADATE,10001,Bought 100 SPY,100,SPY,470.00,0.00,-47000.00',
      ].join('\n');

      const result = parseTDAmeritradeCSV(csv);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors[0].message).toContain('Invalid date');
    });
  });

  describe('Description-based buy/sell detection', () => {
    it('should detect "Bought" as a buy', () => {
      const result = parseTDAmeritradeCSV(BASIC_LONG_CSV);
      const buyExec = result.executions.find((e) => e.side === 'buy');
      expect(buyExec).toBeDefined();
    });

    it('should detect "Sold" as a sell', () => {
      const result = parseTDAmeritradeCSV(BASIC_LONG_CSV);
      const sellExec = result.executions.find((e) => e.side === 'sell');
      expect(sellExec).toBeDefined();
    });

    it('should skip rows whose description is not a buy or sell (e.g., dividends)', () => {
      const result = parseTDAmeritradeCSV(NON_TRADE_ROWS_CSV);

      // The DIVIDEND and INTEREST rows should be skipped
      expect(result.executions).toHaveLength(2);
      expect(result.metadata.skippedRows).toBe(2);
      expect(result.trades).toHaveLength(1);
    });

    it('should detect "BUY" at the start of description', () => {
      const csv = [
        'DATE,TRANSACTION ID,DESCRIPTION,QUANTITY,SYMBOL,PRICE,COMMISSION,AMOUNT',
        '01/15/2024,99001,BUY MARKET 100 QQQ,100,QQQ,440.00,0.00,-44000.00',
        '01/15/2024,99002,SELL MARKET 100 QQQ,100,QQQ,442.00,0.00,44200.00',
      ].join('\n');

      const result = parseTDAmeritradeCSV(csv);
      expect(result.executions).toHaveLength(2);
      expect(result.executions[0].side).toBe('buy');
      expect(result.executions[1].side).toBe('sell');
    });
  });

  describe('Metadata', () => {
    it('should report correct metadata for a standard parse', () => {
      const result = parseTDAmeritradeCSV(MULTI_SYMBOL_CSV);

      expect(result.metadata.brokerFormat).toBe('tdameritrade');
      expect(result.metadata.parsedRows).toBe(4);
      expect(result.metadata.errorRows).toBe(0);
      expect(result.metadata.optionsSkipped).toBe(0);
      expect(result.metadata.totalRows).toBe(4);
    });

    it('should count skipped rows in metadata', () => {
      const result = parseTDAmeritradeCSV(NON_TRADE_ROWS_CSV);

      expect(result.metadata.parsedRows).toBe(2);
      expect(result.metadata.skippedRows).toBe(2);
    });

    it('should count options skipped in metadata', () => {
      const result = parseTDAmeritradeCSV(OPTIONS_CSV);

      expect(result.metadata.optionsSkipped).toBe(2);
    });
  });

  describe('Header row discovery', () => {
    it('should find the header even when preceded by account info lines', () => {
      const result = parseTDAmeritradeCSV(HEADER_OFFSET_CSV);

      expect(result.errors).toHaveLength(0);
      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].symbol).toBe('AAPL');
    });
  });

  describe('Hold time calculation', () => {
    it('should compute holdTimeMinutes as 0 for same-timestamp entry/exit', () => {
      // Both rows share the same date (no time component, so both get T12:00:00)
      const result = parseTDAmeritradeCSV(BASIC_LONG_CSV);
      const trade = result.trades[0];

      // Both executions have same date, time defaults to 12:00:00 => 0 minutes
      expect(trade.holdTimeMinutes).toBe(0);
    });
  });
});
