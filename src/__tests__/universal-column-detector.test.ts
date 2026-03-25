import { describe, it, expect } from 'vitest';
import { detectColumns, type DetectionResult } from '@/lib/parsers/universal-column-detector';

describe('Universal Column Detector', () => {
  // -----------------------------------------------------------------------
  // 1. Standard IBKR Flex Query headers
  // -----------------------------------------------------------------------
  it('should detect IBKR Flex Query columns', () => {
    const csv = [
      'Symbol,DateTime,Buy/Sell,Quantity,T. Price,Commission,Proceeds,Currency,AccountId,AssetCategory',
      'AAPL,2024-03-15 10:30:00,BUY,100,172.50,1.00,17250.00,USD,U12345,STK',
      'MSFT,2024-03-15 11:00:00,SELL,50,415.20,1.00,20760.00,USD,U12345,STK',
      'GOOG,2024-03-15 11:30:00,BUY,25,140.80,1.00,3520.00,USD,U12345,STK',
      'TSLA,2024-03-15 12:00:00,SELL,30,175.30,1.00,5259.00,USD,U12345,STK',
      'META,2024-03-15 12:30:00,BUY,40,500.10,1.00,20004.00,USD,U12345,STK',
    ].join('\n');

    const result = detectColumns(csv);

    expect(result.mapping.symbol).toBe('Symbol');
    expect(result.mapping.dateTime).toBe('DateTime');
    expect(result.mapping.side).toBe('Buy/Sell');
    expect(result.mapping.quantity).toBe('Quantity');
    expect(result.mapping.price).toBe('T. Price');
    expect(result.mapping.commission).toBe('Commission');
    expect(result.mapping.proceeds).toBe('Proceeds');
    expect(result.mapping.currency).toBe('Currency');
    expect(result.mapping.accountId).toBe('AccountId');
    expect(result.mapping.assetCategory).toBe('AssetCategory');
    expect(result.confidence).toBeGreaterThanOrEqual(80);
    expect(result.headerRow).toBe(0);
    expect(result.dataStartRow).toBe(1);
  });

  // -----------------------------------------------------------------------
  // 2. Schwab headers
  // -----------------------------------------------------------------------
  it('should detect Schwab columns', () => {
    const csv = [
      'Date,Action,Symbol,Description,Quantity,Price,Fees & Comm,Amount',
      '03/15/2024,Buy,AAPL,APPLE INC,100,172.50,4.95,17254.95',
      '03/15/2024,Sell,MSFT,MICROSOFT CORP,50,415.20,4.95,20755.05',
      '03/15/2024,Buy,GOOG,ALPHABET INC,25,140.80,4.95,3524.95',
      '03/15/2024,Sell,TSLA,TESLA INC,30,175.30,4.95,5254.05',
      '03/15/2024,Buy,META,META PLATFORMS,40,500.10,4.95,19999.05',
    ].join('\n');

    const result = detectColumns(csv);

    expect(result.mapping.symbol).toBe('Symbol');
    expect(result.mapping.dateTime).toBe('Date');
    expect(result.mapping.side).toBe('Action');
    expect(result.mapping.quantity).toBe('Quantity');
    expect(result.mapping.price).toBe('Price');
    expect(result.mapping.commission).toBe('Fees & Comm');
    expect(result.mapping.proceeds).toBe('Amount');
    expect(result.confidence).toBeGreaterThanOrEqual(80);
  });

  // -----------------------------------------------------------------------
  // 3. TD Ameritrade headers
  // -----------------------------------------------------------------------
  it('should detect TD Ameritrade columns', () => {
    const csv = [
      'DATE,TRANSACTION ID,DESCRIPTION,QUANTITY,SYMBOL,PRICE,COMMISSION,AMOUNT',
      '03/15/2024,12345,Bought 100 AAPL,100,AAPL,172.50,6.95,17256.95',
      '03/15/2024,12346,Sold 50 MSFT,50,MSFT,415.20,6.95,20753.05',
      '03/15/2024,12347,Bought 25 GOOG,25,GOOG,140.80,6.95,3526.95',
      '03/15/2024,12348,Sold 30 TSLA,30,TSLA,175.30,6.95,5252.05',
      '03/15/2024,12349,Bought 40 META,40,META,500.10,6.95,19997.05',
    ].join('\n');

    const result = detectColumns(csv);

    expect(result.mapping.symbol).toBe('SYMBOL');
    expect(result.mapping.dateTime).toBe('DATE');
    expect(result.mapping.quantity).toBe('QUANTITY');
    expect(result.mapping.price).toBe('PRICE');
    expect(result.mapping.commission).toBe('COMMISSION');
    expect(result.mapping.proceeds).toBe('AMOUNT');
    expect(result.confidence).toBeGreaterThanOrEqual(80);
  });

  // -----------------------------------------------------------------------
  // 4. Webull headers
  // -----------------------------------------------------------------------
  it('should detect Webull columns', () => {
    const csv = [
      'Symbol,Side,Filled Qty,Avg Price,Fee,Status,Trade Time',
      'AAPL,BUY,100,172.50,0.00,Filled,2024-03-15 10:30:00',
      'MSFT,SELL,50,415.20,0.00,Filled,2024-03-15 11:00:00',
      'GOOG,BUY,25,140.80,0.00,Filled,2024-03-15 11:30:00',
      'TSLA,SELL,30,175.30,0.00,Filled,2024-03-15 12:00:00',
      'META,BUY,40,500.10,0.00,Filled,2024-03-15 12:30:00',
    ].join('\n');

    const result = detectColumns(csv);

    expect(result.mapping.symbol).toBe('Symbol');
    expect(result.mapping.side).toBe('Side');
    expect(result.mapping.quantity).toBe('Filled Qty');
    expect(result.mapping.price).toBe('Avg Price');
    expect(result.mapping.commission).toBe('Fee');
    expect(result.mapping.dateTime).toBe('Trade Time');
    expect(result.confidence).toBeGreaterThanOrEqual(60);
  });

  // -----------------------------------------------------------------------
  // 5. Completely unknown broker with common column names
  // -----------------------------------------------------------------------
  it('should detect unknown broker with common column names', () => {
    const csv = [
      'Trade Date,Ticker,Buy/Sell,Shares,Exec Price,Fee',
      '2024-03-15,AAPL,Buy,100,172.50,1.99',
      '2024-03-15,MSFT,Sell,50,415.20,1.99',
      '2024-03-15,GOOG,Buy,25,140.80,1.99',
      '2024-03-15,TSLA,Sell,30,175.30,1.99',
      '2024-03-15,META,Buy,40,500.10,1.99',
    ].join('\n');

    const result = detectColumns(csv);

    expect(result.mapping.symbol).toBe('Ticker');
    expect(result.mapping.dateTime).toBe('Trade Date');
    expect(result.mapping.side).toBe('Buy/Sell');
    expect(result.mapping.quantity).toBe('Shares');
    expect(result.mapping.price).toBe('Exec Price');
    expect(result.mapping.commission).toBe('Fee');
    expect(result.confidence).toBeGreaterThanOrEqual(60);
  });

  // -----------------------------------------------------------------------
  // 6. CSV with metadata rows before the header (header on row 5)
  // -----------------------------------------------------------------------
  it('should detect header on row 5 with metadata rows before it', () => {
    const csv = [
      'Brokerage Account Export',
      'Account: 123456789',
      'Generated: 2024-03-15',
      '',
      'Symbol,Trade Date,Side,Quantity,Price,Commission',
      'AAPL,2024-03-15,BUY,100,172.50,1.00',
      'MSFT,2024-03-15,SELL,50,415.20,1.00',
      'GOOG,2024-03-15,BUY,25,140.80,1.00',
      'TSLA,2024-03-15,SELL,30,175.30,1.00',
      'META,2024-03-15,BUY,40,500.10,1.00',
    ].join('\n');

    const result = detectColumns(csv);

    expect(result.mapping.symbol).toBe('Symbol');
    expect(result.mapping.dateTime).toBe('Trade Date');
    expect(result.mapping.side).toBe('Side');
    expect(result.mapping.quantity).toBe('Quantity');
    expect(result.mapping.price).toBe('Price');
    expect(result.mapping.commission).toBe('Commission');
    // The blank line is filtered so header ends up at index 4 in the filtered lines
    // but what matters is it found the right one
    expect(result.headerRow).toBeGreaterThanOrEqual(2);
    expect(result.dataStartRow).toBe(result.headerRow + 1);
    expect(result.confidence).toBeGreaterThanOrEqual(60);
  });

  // -----------------------------------------------------------------------
  // 7. Edge case: ambiguous "Amount" column
  // -----------------------------------------------------------------------
  it('should disambiguate "Amount" column correctly', () => {
    // Here "Amount" should map to proceeds (not quantity) because data
    // looks like dollar amounts, while "Qty" is clearly the quantity column.
    const csv = [
      'Date,Sym,Qty,Price,Amount,Fee',
      '2024-03-15,AAPL,100,172.50,17250.00,1.00',
      '2024-03-15,MSFT,50,415.20,20760.00,1.00',
      '2024-03-15,GOOG,25,140.80,3520.00,1.00',
      '2024-03-15,TSLA,30,175.30,5259.00,1.00',
      '2024-03-15,META,40,500.10,20004.00,1.00',
    ].join('\n');

    const result = detectColumns(csv);

    expect(result.mapping.symbol).toBe('Sym');
    expect(result.mapping.dateTime).toBe('Date');
    expect(result.mapping.quantity).toBe('Qty');
    expect(result.mapping.price).toBe('Price');
    // Amount should be mapped to proceeds, NOT quantity
    // (since Qty is already mapped to quantity, Amount goes to proceeds)
    expect(result.mapping.proceeds).toBe('Amount');
    expect(result.mapping.commission).toBe('Fee');
    expect(result.confidence).toBeGreaterThanOrEqual(60);
  });

  // -----------------------------------------------------------------------
  // Additional tests
  // -----------------------------------------------------------------------
  it('should return confidence 0 when required fields are missing', () => {
    const csv = [
      'Foo,Bar,Baz',
      'hello,world,123',
    ].join('\n');

    const result = detectColumns(csv);

    expect(result.confidence).toBe(0);
  });

  it('should handle empty CSV content', () => {
    const result = detectColumns('');
    expect(result.confidence).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should list unmapped headers', () => {
    const csv = [
      'Symbol,Date,Quantity,Price,SomeCustomField,AnotherField',
      'AAPL,2024-03-15,100,172.50,custom1,custom2',
      'MSFT,2024-03-15,50,415.20,custom1,custom2',
      'GOOG,2024-03-15,25,140.80,custom1,custom2',
      'TSLA,2024-03-15,30,175.30,custom1,custom2',
      'META,2024-03-15,40,500.10,custom1,custom2',
    ].join('\n');

    const result = detectColumns(csv);

    expect(result.unmappedHeaders).toContain('SomeCustomField');
    expect(result.unmappedHeaders).toContain('AnotherField');
  });

  it('should handle quoted CSV fields in headers', () => {
    const csv = [
      '"Symbol","Trade Date","Side","Quantity","Price","Commission"',
      'AAPL,2024-03-15,BUY,100,172.50,1.00',
      'MSFT,2024-03-15,SELL,50,415.20,1.00',
      'GOOG,2024-03-15,BUY,25,140.80,1.00',
      'TSLA,2024-03-15,SELL,30,175.30,1.00',
      'META,2024-03-15,BUY,40,500.10,1.00',
    ].join('\n');

    const result = detectColumns(csv);

    expect(result.mapping.symbol).toBe('Symbol');
    expect(result.mapping.dateTime).toBe('Trade Date');
    expect(result.mapping.quantity).toBe('Quantity');
    expect(result.mapping.price).toBe('Price');
    expect(result.confidence).toBeGreaterThanOrEqual(60);
  });
});
