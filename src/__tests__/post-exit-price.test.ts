import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock yahoo-finance2 ────────────────────────────────────────────────
// The real module's default export is a class. We mock it so that
// `new YahooFinance()` returns an object with a stub `chart` method.
const chartMock = vi.fn();

vi.mock('yahoo-finance2', () => {
  return {
    default: class MockYahooFinance {
      chart = chartMock;
    },
  };
});

// Import AFTER the mock is in place
import { getPostExitPriceData, createYahooFinanceClient } from '@/lib/market/postExitPrice';

// ── Helpers ────────────────────────────────────────────────────────────
/** A recent exit time so the >730 day guard is never hit. */
function recentExit() {
  return new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
}

function makeQuote(
  minutesAfterExit: number,
  exitTime: Date,
  close: number | null,
  high: number | null = close,
  low: number | null = close
) {
  return {
    date: new Date(exitTime.getTime() + minutesAfterExit * 60 * 1000),
    close,
    high,
    low,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────
describe('getPostExitPriceData', () => {
  beforeEach(() => {
    chartMock.mockReset();
  });

  // -------- 1. Old exits --------
  it('returns null when exitTime is more than 730 days ago', async () => {
    const oldExit = new Date(Date.now() - 731 * 24 * 60 * 60 * 1000);
    const result = await getPostExitPriceData('AAPL', oldExit);
    expect(result).toBeNull();
    // Should short-circuit without calling the API
    expect(chartMock).not.toHaveBeenCalled();
  });

  // -------- 2. Empty quotes --------
  it('returns null when yahoo returns no quotes', async () => {
    chartMock.mockResolvedValue({ quotes: [] });
    const result = await getPostExitPriceData('AAPL', recentExit());
    expect(result).toBeNull();
  });

  // -------- 3. First bar has no close --------
  it('returns null when the first quote has null close', async () => {
    const exit = recentExit();
    chartMock.mockResolvedValue({
      quotes: [makeQuote(0, exit, null, 100, 99)],
    });
    const result = await getPostExitPriceData('AAPL', exit);
    expect(result).toBeNull();
  });

  // -------- 4a. Direction: up --------
  it('detects direction "up" when upward move exceeds downward and > 0.05%', async () => {
    const exit = recentExit();
    // exitPrice = 100, maxHigh = 101 (1% up), minLow = 99.99 (0.01% down)
    chartMock.mockResolvedValue({
      quotes: [
        makeQuote(0, exit, 100, 100, 100),
        makeQuote(60, exit, 100.8, 101, 99.99),
      ],
    });
    const result = await getPostExitPriceData('AAPL', exit);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe('up');
  });

  // -------- 4b. Direction: down --------
  it('detects direction "down" when downward move exceeds upward and > 0.05%', async () => {
    const exit = recentExit();
    // exitPrice = 100, maxHigh = 100.01 (0.01% up), minLow = 98 (2% down)
    chartMock.mockResolvedValue({
      quotes: [
        makeQuote(0, exit, 100, 100, 100),
        makeQuote(60, exit, 98.5, 100.01, 98),
      ],
    });
    const result = await getPostExitPriceData('AAPL', exit);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe('down');
  });

  // -------- 4c. Direction: flat --------
  it('detects direction "flat" when both moves are <= 0.05%', async () => {
    const exit = recentExit();
    // exitPrice = 100, maxHigh = 100.04 (0.04%), minLow = 99.96 (0.04%)
    chartMock.mockResolvedValue({
      quotes: [
        makeQuote(0, exit, 100, 100, 100),
        makeQuote(60, exit, 100.02, 100.04, 99.96),
      ],
    });
    const result = await getPostExitPriceData('AAPL', exit);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe('flat');
  });

  // -------- 5. Price at offsets --------
  it('finds priceAt1h/2h/4h from closest bar within 30 minutes of target', async () => {
    const exit = recentExit();
    chartMock.mockResolvedValue({
      quotes: [
        makeQuote(0, exit, 100, 101, 99),   // exit bar
        makeQuote(55, exit, 102, 103, 101),  // ~1h (within 30 min of 60)
        makeQuote(125, exit, 104, 105, 103), // ~2h (within 30 min of 120)
        makeQuote(235, exit, 106, 107, 105), // ~4h (within 30 min of 240)
      ],
    });
    const result = await getPostExitPriceData('AAPL', exit);
    expect(result).not.toBeNull();
    expect(result!.priceAt1h).toBe(102);
    expect(result!.priceAt2h).toBe(104);
    expect(result!.priceAt4h).toBe(106);
  });

  it('returns null for an offset when no bar is within 30 minutes', async () => {
    const exit = recentExit();
    // Only have exit bar and a bar at +3h — 1h, 2h, 4h have no nearby bar
    chartMock.mockResolvedValue({
      quotes: [
        makeQuote(0, exit, 100, 101, 99),
        makeQuote(180, exit, 103, 104, 102), // 3h: not within 30min of 1h, 2h, or 4h
      ],
    });
    const result = await getPostExitPriceData('AAPL', exit);
    expect(result).not.toBeNull();
    expect(result!.priceAt1h).toBeNull();
    expect(result!.priceAt2h).toBeNull();
    expect(result!.priceAt4h).toBeNull();
  });

  // -------- 6. API errors --------
  it('returns null when the chart API throws', async () => {
    chartMock.mockRejectedValue(new Error('Network error'));
    const result = await getPostExitPriceData('AAPL', recentExit());
    expect(result).toBeNull();
  });

  // -------- 7. maxMovePercent calculation --------
  it('computes maxMovePercent as the larger of up and down moves (rounded to 2 decimals)', async () => {
    const exit = recentExit();
    // exitPrice = 200, maxHigh = 205 (2.5% up), minLow = 196 (2% down)
    // max move = 2.5%
    chartMock.mockResolvedValue({
      quotes: [
        makeQuote(0, exit, 200, 200, 200),
        makeQuote(60, exit, 203, 205, 198),
        makeQuote(120, exit, 201, 202, 196),
      ],
    });
    const result = await getPostExitPriceData('AAPL', exit);
    expect(result).not.toBeNull();
    expect(result!.maxMovePercent).toBe(2.5);
  });

  it('computes maxMovePercent from the down move when it is larger', async () => {
    const exit = recentExit();
    // exitPrice = 200, maxHigh = 201 (0.5% up), minLow = 192 (4% down)
    chartMock.mockResolvedValue({
      quotes: [
        makeQuote(0, exit, 200, 200, 200),
        makeQuote(60, exit, 195, 201, 192),
      ],
    });
    const result = await getPostExitPriceData('AAPL', exit);
    expect(result).not.toBeNull();
    expect(result!.maxMovePercent).toBe(4);
    expect(result!.direction).toBe('down');
  });

  // -------- 8. Creates client if none provided --------
  it('creates a client internally when yfClient is not provided', async () => {
    const exit = recentExit();
    chartMock.mockResolvedValue({
      quotes: [makeQuote(0, exit, 150, 151, 149)],
    });

    // Call without yfClient — should not throw
    const result = await getPostExitPriceData('AAPL', exit);
    expect(result).not.toBeNull();
    expect(result!.exitPrice).toBe(150);
    expect(chartMock).toHaveBeenCalledOnce();
  });

  it('uses the provided yfClient instead of creating a new one', async () => {
    const exit = recentExit();
    chartMock.mockResolvedValue({
      quotes: [makeQuote(0, exit, 150, 151, 149)],
    });

    // Create a client via the exported helper (uses our mock)
    const client = await createYahooFinanceClient();
    const result = await getPostExitPriceData('AAPL', exit, client);
    expect(result).not.toBeNull();
    expect(result!.exitPrice).toBe(150);
  });

  // -------- Edge: quotes array missing from result --------
  it('handles result with undefined quotes (treated as empty)', async () => {
    chartMock.mockResolvedValue({});
    const result = await getPostExitPriceData('AAPL', recentExit());
    expect(result).toBeNull();
  });

  // -------- Edge: exitPrice used as fallback for maxHigh/minLow --------
  it('returns maxMovePercent 0 when all bars match the exit price', async () => {
    const exit = recentExit();
    chartMock.mockResolvedValue({
      quotes: [
        makeQuote(0, exit, 100, 100, 100),
        makeQuote(60, exit, 100, 100, 100),
      ],
    });
    const result = await getPostExitPriceData('AAPL', exit);
    expect(result).not.toBeNull();
    expect(result!.maxMovePercent).toBe(0);
    expect(result!.direction).toBe('flat');
  });
});

describe('createYahooFinanceClient', () => {
  it('returns an object with a chart method', async () => {
    const client = await createYahooFinanceClient();
    expect(client).toBeDefined();
    expect(typeof client.chart).toBe('function');
  });
});
