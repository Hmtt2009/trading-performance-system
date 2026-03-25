import { describe, it, expect } from 'vitest';
import { classifyParseError } from '@/lib/parsers/error-classifier';

describe('classifyParseError', () => {
  it('classifies empty string as empty_file', () => {
    const result = classifyParseError('');
    expect(result.errorType).toBe('empty_file');
    expect(result.message).toBe('The uploaded file is empty.');
    expect(result.suggestion).toContain('downloaded the correct file');
  });

  it('classifies whitespace-only content as empty_file', () => {
    const result = classifyParseError('   \n  \n  ');
    expect(result.errorType).toBe('empty_file');
  });

  it('classifies JSON content as not_csv', () => {
    const json = '{"trades": [{"symbol": "AAPL", "qty": 100}]}';
    const result = classifyParseError(json);
    expect(result.errorType).toBe('not_csv');
    expect(result.message).toContain("doesn't appear to be a CSV");
    expect(result.suggestion).toContain('CSV format');
    expect(result.detectedContentType).toBe('JSON');
  });

  it('classifies XML content as not_csv', () => {
    const xml = '<?xml version="1.0"?><FlexQueryResponse><trades></trades></FlexQueryResponse>';
    const result = classifyParseError(xml);
    expect(result.errorType).toBe('not_csv');
    expect(result.detectedContentType).toBe('XML');
  });

  it('classifies PDF content as not_csv', () => {
    const pdf = '%PDF-1.4 binary content here';
    const result = classifyParseError(pdf);
    expect(result.errorType).toBe('not_csv');
    expect(result.detectedContentType).toBe('PDF');
  });

  it('classifies plain text without commas as not_csv', () => {
    const text = 'This is just some plain text\nwith multiple lines\nbut no commas at all';
    const result = classifyParseError(text);
    expect(result.errorType).toBe('not_csv');
  });

  it('classifies CSV with position data as wrong_report_type (positions)', () => {
    const csv = 'Open Positions,Symbol,Quantity,Market Value\nData,AAPL,100,17250.00\nData,MSFT,50,21000.00';
    const result = classifyParseError(csv);
    expect(result.errorType).toBe('wrong_report_type');
    expect(result.message).toContain('positions report');
    expect(result.suggestion).toContain('Trade History');
    expect(result.detectedContentType).toBe('positions report');
  });

  it('classifies CSV with dividend data as wrong_report_type (dividends)', () => {
    const csv = 'Date,Symbol,Dividend,Amount,Tax\n2024-03-15,AAPL,Dividend,125.00,12.50\n2024-03-15,MSFT,Dividend,89.00,8.90';
    const result = classifyParseError(csv);
    expect(result.errorType).toBe('wrong_report_type');
    expect(result.message).toContain('dividend report');
    expect(result.detectedContentType).toBe('dividend report');
  });

  it('classifies CSV with balance data as wrong_report_type (balance)', () => {
    const csv = 'Account,Cash Balance,Securities,Net Asset Value\nU1234567,50000.00,125000.00,175000.00';
    const result = classifyParseError(csv);
    expect(result.errorType).toBe('wrong_report_type');
    expect(result.message).toContain('balance statement');
    expect(result.detectedContentType).toBe('balance statement');
  });

  it('classifies CSV with trade columns but no data rows as no_trades', () => {
    const csv = 'Symbol,Side,Quantity,Price,Commission,DateTime';
    const result = classifyParseError(csv);
    expect(result.errorType).toBe('no_trades');
    expect(result.message).toContain('No trades found');
    expect(result.suggestion).toContain('date range');
  });

  it('classifies CSV with trade columns and data rows but unparseable as no_trades', () => {
    const csv =
      'Symbol,Side,Quantity,Price,Commission,DateTime\nAAPL,BUY,100,172.50,1.00,2024-03-15';
    const result = classifyParseError(csv);
    expect(result.errorType).toBe('no_trades');
    expect(result.message).toContain('No trades found');
  });

  it('classifies CSV with random/unrecognized column names as no_columns', () => {
    const csv =
      'Foo,Bar,Baz,Qux\nval1,val2,val3,val4\nval5,val6,val7,val8';
    const result = classifyParseError(csv);
    expect(result.errorType).toBe('no_columns');
    expect(result.message).toContain('2 rows');
    expect(result.message).toContain("couldn't identify trade columns");
    expect(result.suggestion).toContain('IBKR');
    expect(result.suggestion).toContain('Schwab');
  });

  it('classifies CSV with non-US symbols (.L, .HK) as non_us_market', () => {
    const csv =
      'Ticker,Action,Shares,Cost\nVOD.L,Buy,500,120.50\nHSBC.HK,Sell,200,55.30\nBP.L,Buy,300,450.00';
    const result = classifyParseError(csv);
    expect(result.errorType).toBe('non_us_market');
    expect(result.message).toContain('non-US market');
    expect(result.suggestion).toContain('US stocks only');
  });

  it('returns unknown_format for a single-line CSV with no recognizable pattern', () => {
    // Only 1 line, no trade columns, no report keywords → no_columns needs >1 line
    const csv = 'JustOneColumnWithNoMeaning';
    const result = classifyParseError(csv);
    expect(result.errorType).toBe('unknown_format');
    expect(result.message).toContain("couldn't identify");
    expect(result.suggestion).toContain('IBKR');
  });
});
