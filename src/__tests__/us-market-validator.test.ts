import { describe, it, expect } from 'vitest';
import {
  validateUSMarket,
  isUSSymbol,
  type ValidationResult,
} from '@/lib/parsers/us-market-validator';
import type { RawExecution } from '@/types';

// ---------------------------------------------------------------------------
// Helper: build a minimal RawExecution for testing
// ---------------------------------------------------------------------------
function makeExec(overrides: Partial<RawExecution> = {}): RawExecution {
  return {
    symbol: 'AAPL',
    dateTime: new Date('2024-01-15T15:00:00Z'), // 10:00 AM ET (winter)
    side: 'buy',
    quantity: 100,
    price: 150,
    commission: 1,
    assetCategory: 'STK',
    currency: 'USD',
    accountId: 'U123',
    rawRow: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isUSSymbol unit tests
// ---------------------------------------------------------------------------
describe('isUSSymbol', () => {
  it('accepts standard US tickers', () => {
    expect(isUSSymbol('AAPL')).toBe(true);
    expect(isUSSymbol('MSFT')).toBe(true);
    expect(isUSSymbol('NVDA')).toBe(true);
    expect(isUSSymbol('A')).toBe(true);
    expect(isUSSymbol('GOOGL')).toBe(true);
    expect(isUSSymbol('TSLA')).toBe(true);
  });

  it('accepts Berkshire class shares (BRK.B, BRK.A)', () => {
    expect(isUSSymbol('BRK.B')).toBe(true);
    expect(isUSSymbol('BRK.A')).toBe(true);
  });

  it('rejects non-US suffixed tickers', () => {
    expect(isUSSymbol('VOD.L')).toBe(false);   // London
    expect(isUSSymbol('9988.HK')).toBe(false);  // Hong Kong (starts with digit)
    expect(isUSSymbol('SHOP.TO')).toBe(false);   // Toronto (two-letter suffix)
    expect(isUSSymbol('BHP.AX')).toBe(false);    // Australia
  });

  it('rejects numeric-only symbols', () => {
    expect(isUSSymbol('1234')).toBe(false);
    expect(isUSSymbol('9988')).toBe(false);
  });

  it('rejects empty or lowercase symbols', () => {
    expect(isUSSymbol('')).toBe(false);
    expect(isUSSymbol('aapl')).toBe(false);
  });

  it('rejects symbols longer than 5 characters', () => {
    expect(isUSSymbol('ABCDEF')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateUSMarket – all valid US tickers
// ---------------------------------------------------------------------------
describe('validateUSMarket', () => {
  it('passes all valid US tickers through', () => {
    const executions = [
      makeExec({ symbol: 'AAPL' }),
      makeExec({ symbol: 'TSLA' }),
      makeExec({ symbol: 'NVDA' }),
      makeExec({ symbol: 'BRK.B' }),
    ];

    const result = validateUSMarket(executions);

    expect(result.validExecutions).toHaveLength(4);
    expect(result.skippedExecutions).toHaveLength(0);
    expect(result.summary.totalChecked).toBe(4);
    expect(result.summary.passed).toBe(4);
    expect(result.summary.skippedNonUS).toBe(0);
    expect(result.summary.skippedNonUSD).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Non-US tickers
  // -------------------------------------------------------------------------
  it('skips non-US tickers', () => {
    const executions = [
      makeExec({ symbol: 'VOD.L' }),
      makeExec({ symbol: '9988.HK' }),
      makeExec({ symbol: 'SHOP.TO' }),
    ];

    const result = validateUSMarket(executions);

    expect(result.validExecutions).toHaveLength(0);
    expect(result.skippedExecutions).toHaveLength(3);
    expect(result.summary.skippedNonUS).toBe(3);
    // Should contain the non-US message
    expect(result.warnings[0]).toMatch(/non-US/i);
    expect(result.warnings[0]).toContain('3');
  });

  // -------------------------------------------------------------------------
  // Mixed US and non-US
  // -------------------------------------------------------------------------
  it('keeps US trades and skips non-US trades in a mixed batch', () => {
    const executions = [
      makeExec({ symbol: 'AAPL' }),
      makeExec({ symbol: 'VOD.L' }),
      makeExec({ symbol: 'MSFT' }),
      makeExec({ symbol: '9988.HK' }),
    ];

    const result = validateUSMarket(executions);

    expect(result.validExecutions).toHaveLength(2);
    expect(result.skippedExecutions).toHaveLength(2);
    expect(result.validExecutions.map((e) => e.symbol)).toEqual(['AAPL', 'MSFT']);
    expect(result.summary.skippedNonUS).toBe(2);
    expect(result.warnings[0]).toMatch(/2 non-US trades were skipped/);
  });

  // -------------------------------------------------------------------------
  // Non-USD currency filtering
  // -------------------------------------------------------------------------
  it('skips trades with non-USD currency', () => {
    const executions = [
      makeExec({ symbol: 'AAPL', currency: 'USD' }),
      makeExec({ symbol: 'MSFT', currency: 'GBP' }),
      makeExec({ symbol: 'NVDA', currency: 'CAD' }),
    ];

    const result = validateUSMarket(executions);

    expect(result.validExecutions).toHaveLength(1);
    expect(result.skippedExecutions).toHaveLength(2);
    expect(result.summary.skippedNonUSD).toBe(2);
    expect(result.warnings[0]).toMatch(/non-US/);
  });

  // -------------------------------------------------------------------------
  // After-hours trade warning (7:30 PM ET)
  // -------------------------------------------------------------------------
  it('warns for after-hours trades (7:30 PM ET) but does not skip them', () => {
    // 7:30 PM ET = 00:30 UTC next day (in winter EST = UTC-5)
    const executions = [
      makeExec({
        symbol: 'AAPL',
        dateTime: new Date('2024-01-16T00:30:00Z'), // 7:30 PM ET Jan 15
      }),
    ];

    const result = validateUSMarket(executions);

    // Trade should NOT be skipped (within 4 AM–8 PM window)
    expect(result.validExecutions).toHaveLength(1);
    expect(result.skippedExecutions).toHaveLength(0);
    // 7:30 PM is within extended hours, so no warning expected
    expect(result.summary.outsideMarketHours).toBe(0);
  });

  it('warns for trades outside extended hours (after 8 PM ET)', () => {
    // 9:00 PM ET = 02:00 UTC next day (in winter EST = UTC-5)
    const executions = [
      makeExec({
        symbol: 'AAPL',
        dateTime: new Date('2024-01-16T02:00:00Z'), // 9:00 PM ET Jan 15
      }),
    ];

    const result = validateUSMarket(executions);

    // Trade should NOT be skipped — just warned
    expect(result.validExecutions).toHaveLength(1);
    expect(result.summary.outsideMarketHours).toBe(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/outside US extended trading hours/);
  });

  // -------------------------------------------------------------------------
  // Pre-market trade (5:00 AM ET) – should pass but warn? No – 5 AM is
  // within extended hours (4 AM–8 PM), so no warning expected.
  // -------------------------------------------------------------------------
  it('passes pre-market trades (5:00 AM ET) without warning', () => {
    // 5:00 AM ET = 10:00 AM UTC (winter EST = UTC-5)
    const executions = [
      makeExec({
        symbol: 'TSLA',
        dateTime: new Date('2024-01-15T10:00:00Z'), // 5:00 AM ET
      }),
    ];

    const result = validateUSMarket(executions);

    expect(result.validExecutions).toHaveLength(1);
    expect(result.skippedExecutions).toHaveLength(0);
    expect(result.summary.outsideMarketHours).toBe(0);
    // No warnings because 5 AM is within extended hours
    expect(result.warnings).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Weekend trade — should warn
  // -------------------------------------------------------------------------
  it('warns for weekend trades', () => {
    // 2024-01-14 is a Sunday
    const executions = [
      makeExec({
        symbol: 'NVDA',
        dateTime: new Date('2024-01-14T15:00:00Z'), // Sunday 10:00 AM ET
      }),
    ];

    const result = validateUSMarket(executions);

    // Trade should still be in validExecutions (warn only)
    expect(result.validExecutions).toHaveLength(1);
    expect(result.summary.outsideMarketHours).toBe(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/weekend/i);
    expect(result.warnings[0]).toMatch(/Sunday/);
  });

  // -------------------------------------------------------------------------
  // Empty input
  // -------------------------------------------------------------------------
  it('handles empty array', () => {
    const result = validateUSMarket([]);

    expect(result.validExecutions).toHaveLength(0);
    expect(result.skippedExecutions).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.summary.totalChecked).toBe(0);
    expect(result.summary.passed).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Summary message format
  // -------------------------------------------------------------------------
  it('includes the correct Flinch-branded message when non-US trades exist', () => {
    const executions = [makeExec({ symbol: 'VOD.L' })];
    const result = validateUSMarket(executions);

    expect(result.warnings[0]).toBe(
      'We found trades in non-US markets. Flinch currently supports US stocks only. 1 non-US trade was skipped.',
    );
  });
});
