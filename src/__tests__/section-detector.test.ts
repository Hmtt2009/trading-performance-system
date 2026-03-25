import { describe, it, expect } from 'vitest';
import { analyzeFileSections } from '@/lib/parsers/section-detector';
import type { SectionAnalysis } from '@/lib/parsers/section-detector';

// ---------------------------------------------------------------------------
// Fixture: Simple single-section CSV (just headers + data)
// ---------------------------------------------------------------------------
const SINGLE_SECTION_CSV = `Date,Symbol,Side,Quantity,Price,Commission
2024-01-15,AAPL,BUY,100,185.50,1.00
2024-01-15,AAPL,SELL,100,186.20,1.00
2024-01-16,MSFT,BUY,50,410.00,1.00
2024-01-16,MSFT,SELL,50,412.30,1.00`;

// ---------------------------------------------------------------------------
// Fixture: IBKR Activity Statement with multiple sections
// ---------------------------------------------------------------------------
const IBKR_ACTIVITY_STATEMENT_CSV = `"Statement","Header","Field Name","Field Value"
"Statement","Data","BrokerName","Interactive Brokers"
"Statement","Data","Period","January 15, 2024"
"Account Information","Header","Name","Account"
"Account Information","Data","John Doe","U1234567"
"Cash Report","Header","Currency","Total"
"Cash Report","Data","USD","50000.00"
"Open Positions","Header","Symbol","Quantity","Price"
"Open Positions","Data","GOOGL","10","141.50"
"Trades","Header","Symbol","DateTime","Quantity","Price","Proceeds","Commission","Buy/Sell","AssetCategory","Currency","AccountId"
"Trades","Data","AAPL","2024-01-15 09:35:00","100","185.50","-18550.00","-1.00","BOT","STK","USD","U1234567"
"Trades","Data","AAPL","2024-01-15 10:15:00","-100","186.20","18620.00","-1.00","SLD","STK","USD","U1234567"
"Trades","SubTotal","","","","","","","","","",""
"Dividends","Header","Symbol","Amount"
"Dividends","Data","MSFT","5.60"`;

// ---------------------------------------------------------------------------
// Fixture: Multi-section file with separator lines (---) between sections
// ---------------------------------------------------------------------------
const SEPARATOR_SECTIONS_CSV = `Account Information
Name,John Doe
Account,U1234567

---

Trade History
Date,Symbol,Side,Quantity,Price,Commission
2024-01-15,AAPL,BUY,100,185.50,1.00
2024-01-15,AAPL,SELL,100,186.20,1.00

---

Dividends
Date,Symbol,Amount
2024-01-10,MSFT,5.60`;

// ---------------------------------------------------------------------------
// Fixture: File with metadata/account info before trade data
// ---------------------------------------------------------------------------
const METADATA_BEFORE_TRADES_CSV = `Account Summary
Account Number,U9876543
Account Type,Individual
Currency,USD
Balance,125000.00

Date,Symbol,Side,Quantity,Price,Commission
2024-01-15,AAPL,BUY,100,185.50,1.00
2024-01-15,AAPL,SELL,100,186.20,1.00
2024-01-16,TSLA,BUY,200,220.00,2.00
2024-01-16,TSLA,SELL,200,222.50,2.00`;

// ---------------------------------------------------------------------------
// Fixture: Trade data starts at row 15 (lots of header metadata)
// ---------------------------------------------------------------------------
const LATE_START_CSV = `Report Generated: 2024-01-20
Broker: Example Broker Inc.
Account: 12345678
Client: Jane Smith
Period: January 2024

Summary
Total Trades: 4
Total P&L: $350.00
Win Rate: 75%

Notes
All times are in EST.
Commission rates subject to change.

Date,Symbol,Side,Quantity,Price,Commission
2024-01-15,AAPL,BUY,100,185.50,1.00
2024-01-15,AAPL,SELL,100,186.20,1.00
2024-01-16,GOOG,BUY,25,142.00,1.00
2024-01-16,GOOG,SELL,25,143.50,1.00`;

// ---------------------------------------------------------------------------
// Fixture: Mixed section types — only trade section should be extracted
// ---------------------------------------------------------------------------
const MIXED_SECTIONS_CSV = `Account Information
Name,John Doe
Account,U1234567

---

Cash Balance
Currency,Amount
USD,50000.00

---

Executed Orders
Date,Symbol,Side,Quantity,Price,Commission
2024-01-15,AAPL,BUY,100,185.50,1.00
2024-01-15,AAPL,SELL,100,186.20,1.00

---

Open Positions
Symbol,Quantity,AvgPrice
GOOGL,10,141.50

---

Dividends
Date,Symbol,Amount
2024-01-10,MSFT,5.60

---

Fees
Description,Amount
Market Data,15.00`;

// ---------------------------------------------------------------------------
// Fixture: File with === separators
// ---------------------------------------------------------------------------
const EQUALS_SEPARATOR_CSV = `Account Summary
Account,U5555555

===

Trade History
Date,Symbol,Side,Quantity,Price,Commission
2024-02-01,NVDA,BUY,30,650.00,1.50
2024-02-01,NVDA,SELL,30,658.00,1.50

===

Interest
Date,Amount
2024-01-31,12.50`;

// ===========================================================================
// Tests
// ===========================================================================

describe('Section Detector', () => {
  describe('Single-section CSV', () => {
    it('should treat a simple CSV as a single trade section', () => {
      const result = analyzeFileSections(SINGLE_SECTION_CSV);

      expect(result.format).toBe('single-section');
      expect(result.sections.length).toBeGreaterThanOrEqual(1);
      expect(result.tradeSections).toHaveLength(1);
      expect(result.tradeSections[0].isTradeSection).toBe(true);
      expect(result.headerRowIndex).toBe(0);
    });

    it('should return the full CSV as csvContent for single-section files', () => {
      const result = analyzeFileSections(SINGLE_SECTION_CSV);

      // The extracted content should contain the header and all data rows
      expect(result.csvContent).toContain('Date,Symbol,Side,Quantity,Price,Commission');
      expect(result.csvContent).toContain('AAPL');
      expect(result.csvContent).toContain('MSFT');
    });

    it('should identify the header row correctly', () => {
      const result = analyzeFileSections(SINGLE_SECTION_CSV);

      expect(result.tradeSections[0].headerRow).toBe(0);
    });
  });

  describe('IBKR Activity Statement format', () => {
    it('should detect IBKR Activity Statement format', () => {
      const result = analyzeFileSections(IBKR_ACTIVITY_STATEMENT_CSV);

      expect(result.format).toBe('ibkr-activity-statement');
    });

    it('should find multiple sections including Trades', () => {
      const result = analyzeFileSections(IBKR_ACTIVITY_STATEMENT_CSV);

      // Should detect Statement, Account Information, Cash Report,
      // Open Positions, Trades, Dividends
      expect(result.sections.length).toBeGreaterThanOrEqual(4);

      const sectionNames = result.sections.map((s) => s.name);
      expect(sectionNames).toContain('Trades');
    });

    it('should mark only Trades as a trade section', () => {
      const result = analyzeFileSections(IBKR_ACTIVITY_STATEMENT_CSV);

      expect(result.tradeSections).toHaveLength(1);
      expect(result.tradeSections[0].name).toBe('Trades');
      expect(result.tradeSections[0].isTradeSection).toBe(true);
    });

    it('should strip IBKR prefix columns from extracted content', () => {
      const result = analyzeFileSections(IBKR_ACTIVITY_STATEMENT_CSV);

      // The extracted CSV should NOT contain "Trades","Data" prefix
      expect(result.csvContent).not.toContain('"Trades"');

      // Should contain the actual trade column headers
      expect(result.csvContent).toContain('Symbol');
      expect(result.csvContent).toContain('DateTime');
      expect(result.csvContent).toContain('Price');

      // Should contain trade data
      expect(result.csvContent).toContain('AAPL');
    });

    it('should not include non-trade section data in csvContent', () => {
      const result = analyzeFileSections(IBKR_ACTIVITY_STATEMENT_CSV);

      // Dividends section data should not appear
      expect(result.csvContent).not.toContain('MSFT');
      expect(result.csvContent).not.toContain('5.60');
      // Account info should not appear
      expect(result.csvContent).not.toContain('John Doe');
    });
  });

  describe('Separator-based multi-section files', () => {
    it('should detect multi-section format with --- separators', () => {
      const result = analyzeFileSections(SEPARATOR_SECTIONS_CSV);

      expect(result.format).toBe('multi-section');
    });

    it('should find multiple sections', () => {
      const result = analyzeFileSections(SEPARATOR_SECTIONS_CSV);

      expect(result.sections.length).toBeGreaterThanOrEqual(3);
    });

    it('should identify Trade History as the trade section', () => {
      const result = analyzeFileSections(SEPARATOR_SECTIONS_CSV);

      expect(result.tradeSections).toHaveLength(1);
      expect(result.tradeSections[0].name).toBe('Trade History');
      expect(result.tradeSections[0].isTradeSection).toBe(true);
    });

    it('should extract only trade data in csvContent', () => {
      const result = analyzeFileSections(SEPARATOR_SECTIONS_CSV);

      // Should contain trade header and data
      expect(result.csvContent).toContain('Date,Symbol,Side,Quantity,Price,Commission');
      expect(result.csvContent).toContain('AAPL');

      // Should NOT contain other sections
      expect(result.csvContent).not.toContain('John Doe');
      expect(result.csvContent).not.toContain('U1234567');
      expect(result.csvContent).not.toContain('5.60');
    });

    it('should handle === separators the same way', () => {
      const result = analyzeFileSections(EQUALS_SEPARATOR_CSV);

      expect(result.format).toBe('multi-section');
      expect(result.tradeSections).toHaveLength(1);
      expect(result.tradeSections[0].name).toBe('Trade History');
      expect(result.csvContent).toContain('NVDA');
      expect(result.csvContent).not.toContain('12.50');
    });
  });

  describe('Metadata before trade data', () => {
    it('should find trade data even after account metadata', () => {
      const result = analyzeFileSections(METADATA_BEFORE_TRADES_CSV);

      expect(result.tradeSections).toHaveLength(1);
    });

    it('should identify the correct header row (not the metadata)', () => {
      const result = analyzeFileSections(METADATA_BEFORE_TRADES_CSV);

      // The header row should point to the Date,Symbol,Side,... row
      const headerIdx = result.tradeSections[0].headerRow;
      expect(headerIdx).not.toBeNull();

      const lines = METADATA_BEFORE_TRADES_CSV.split('\n');
      expect(lines[headerIdx!]).toContain('Date');
      expect(lines[headerIdx!]).toContain('Symbol');
      expect(lines[headerIdx!]).toContain('Price');
    });

    it('should extract trade content starting from the header row', () => {
      const result = analyzeFileSections(METADATA_BEFORE_TRADES_CSV);

      expect(result.csvContent).toContain('Date,Symbol,Side,Quantity,Price,Commission');
      expect(result.csvContent).toContain('AAPL');
      expect(result.csvContent).toContain('TSLA');
    });
  });

  describe('Late-start trade data (row 15+)', () => {
    it('should find trade data even when it starts late in the file', () => {
      const result = analyzeFileSections(LATE_START_CSV);

      expect(result.tradeSections).toHaveLength(1);
    });

    it('should identify the correct header row index', () => {
      const result = analyzeFileSections(LATE_START_CSV);

      const lines = LATE_START_CSV.split('\n');
      const headerIdx = result.headerRowIndex;

      // The header row should be the one with Date,Symbol,Side,...
      expect(lines[headerIdx]).toContain('Date');
      expect(lines[headerIdx]).toContain('Symbol');
      expect(lines[headerIdx]).toContain('Price');
    });

    it('should extract only trade data, not report metadata', () => {
      const result = analyzeFileSections(LATE_START_CSV);

      expect(result.csvContent).toContain('AAPL');
      expect(result.csvContent).toContain('GOOG');
      expect(result.csvContent).toContain('Date,Symbol,Side,Quantity,Price,Commission');

      // Should not contain the preamble metadata
      expect(result.csvContent).not.toContain('Report Generated');
      expect(result.csvContent).not.toContain('Win Rate');
    });
  });

  describe('Mixed section types — only trade section extracted', () => {
    it('should identify the correct trade section among many', () => {
      const result = analyzeFileSections(MIXED_SECTIONS_CSV);

      expect(result.tradeSections).toHaveLength(1);
      expect(result.tradeSections[0].name).toBe('Executed Orders');
    });

    it('should mark non-trade sections correctly', () => {
      const result = analyzeFileSections(MIXED_SECTIONS_CSV);

      const nonTradeSections = result.sections.filter((s) => !s.isTradeSection);
      const nonTradeNames = nonTradeSections.map((s) => s.name);

      expect(nonTradeNames).toContain('Account Information');
      expect(nonTradeNames).toContain('Cash Balance');
      expect(nonTradeNames).toContain('Open Positions');
      expect(nonTradeNames).toContain('Dividends');
      expect(nonTradeNames).toContain('Fees');
    });

    it('should extract only trade data from Executed Orders section', () => {
      const result = analyzeFileSections(MIXED_SECTIONS_CSV);

      expect(result.csvContent).toContain('Date,Symbol,Side,Quantity,Price,Commission');
      expect(result.csvContent).toContain('AAPL');

      // No other section data
      expect(result.csvContent).not.toContain('50000.00');  // Cash Balance
      expect(result.csvContent).not.toContain('GOOGL');     // Open Positions
      expect(result.csvContent).not.toContain('5.60');       // Dividends
      expect(result.csvContent).not.toContain('Market Data'); // Fees
    });

    it('should detect multi-section format', () => {
      const result = analyzeFileSections(MIXED_SECTIONS_CSV);

      expect(result.format).toBe('multi-section');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty input', () => {
      const result = analyzeFileSections('');

      expect(result.sections).toHaveLength(0);
      expect(result.tradeSections).toHaveLength(0);
      expect(result.csvContent).toBe('');
    });

    it('should handle a file with only separators', () => {
      const result = analyzeFileSections('---\n---\n---');

      expect(result.tradeSections).toHaveLength(0);
      expect(result.csvContent).toBe('');
    });

    it('should handle quoted CSV values in headers', () => {
      const csv = `"Date","Symbol","Side","Quantity","Price","Commission"
"2024-01-15","AAPL","BUY","100","185.50","1.00"`;
      const result = analyzeFileSections(csv);

      expect(result.tradeSections).toHaveLength(1);
      expect(result.csvContent).toContain('AAPL');
    });

    it('should handle Windows-style line endings (CRLF)', () => {
      const csv = 'Date,Symbol,Side,Quantity,Price,Commission\r\n2024-01-15,AAPL,BUY,100,185.50,1.00\r\n';
      const result = analyzeFileSections(csv);

      expect(result.tradeSections).toHaveLength(1);
      expect(result.csvContent).toContain('AAPL');
    });
  });
});
