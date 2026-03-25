import type { RawExecution } from '@/types';

export interface ValidationResult {
  validExecutions: RawExecution[];
  skippedExecutions: RawExecution[];
  warnings: string[];
  summary: {
    totalChecked: number;
    passed: number;
    skippedNonUS: number;
    skippedNonUSD: number;
    outsideMarketHours: number;
  };
}

/**
 * Plain US stock symbols: 1-5 uppercase letters with no suffix.
 */
const US_PLAIN_SYMBOL_RE = /^[A-Z]{1,5}$/;

/**
 * Known US class-share base tickers that legitimately use a dot suffix
 * (e.g. BRK.A, BRK.B, MOG.A, MOG.B, LEN.B, HEI.A).
 * This set is checked when a symbol contains a dot followed by a single letter,
 * to distinguish US class shares from non-US exchange suffixes like VOD.L.
 */
const US_CLASS_SHARE_BASES = new Set([
  'BRK', 'MOG', 'LEN', 'HEI', 'GOOG',
]);

/**
 * Returns true if a symbol looks like a valid US stock ticker.
 *
 * Valid:   AAPL, MSFT, A, GOOGL, BRK.B
 * Invalid: VOD.L, 9988.HK, SHOP.TO, 1234
 */
export function isUSSymbol(symbol: string): boolean {
  // Plain tickers (no dots): 1-5 uppercase letters
  if (US_PLAIN_SYMBOL_RE.test(symbol)) {
    return true;
  }

  // Class shares: base ticker (1-5 uppercase) + dot + single uppercase letter
  // Only allowed for known US class-share base tickers.
  const dotIdx = symbol.indexOf('.');
  if (dotIdx > 0) {
    const base = symbol.slice(0, dotIdx);
    const suffix = symbol.slice(dotIdx + 1);
    if (
      US_PLAIN_SYMBOL_RE.test(base) &&
      suffix.length === 1 &&
      /^[A-Z]$/.test(suffix) &&
      US_CLASS_SHARE_BASES.has(base)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Convert a Date to Eastern Time (America/New_York) and return the hour and
 * minute components plus the day-of-week (0 = Sunday, 6 = Saturday).
 */
function toET(date: Date): { hour: number; minute: number; dow: number } {
  // Intl.DateTimeFormat gives us the wall-clock values in the target timezone
  // independent of the host machine's timezone setting.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === 'hour')!.value);
  const minute = Number(parts.find((p) => p.type === 'minute')!.value);
  const weekday = parts.find((p) => p.type === 'weekday')!.value;

  const dowMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return { hour, minute, dow: dowMap[weekday] ?? 0 };
}

/**
 * Returns true when the given ET time is within the extended US trading
 * window: 4:00 AM – 8:00 PM ET (pre-market through after-hours).
 */
function isWithinExtendedHours(hour: number, minute: number): boolean {
  const totalMinutes = hour * 60 + minute;
  // 4:00 AM = 240 min, 8:00 PM = 1200 min
  return totalMinutes >= 240 && totalMinutes < 1200;
}

/**
 * Validate an array of parsed executions, keeping only trades from US
 * markets and flagging any that fall outside extended trading hours.
 */
export function validateUSMarket(executions: RawExecution[]): ValidationResult {
  const validExecutions: RawExecution[] = [];
  const skippedExecutions: RawExecution[] = [];
  const warnings: string[] = [];

  let skippedNonUS = 0;
  let skippedNonUSD = 0;
  let outsideMarketHours = 0;

  for (const exec of executions) {
    // 1. Currency check (skip non-USD)
    if (exec.currency && exec.currency.toUpperCase() !== 'USD') {
      skippedNonUSD++;
      skippedExecutions.push(exec);
      continue;
    }

    // 2. Symbol check (skip non-US tickers)
    if (!isUSSymbol(exec.symbol)) {
      skippedNonUS++;
      skippedExecutions.push(exec);
      continue;
    }

    // 3. Market-hours check (warn only, never skip)
    const { hour, minute, dow } = toET(exec.dateTime);

    if (dow === 0 || dow === 6) {
      outsideMarketHours++;
      warnings.push(
        `Trade ${exec.symbol} at ${exec.dateTime.toISOString()} falls on a weekend (${dow === 0 ? 'Sunday' : 'Saturday'}).`,
      );
    } else if (!isWithinExtendedHours(hour, minute)) {
      outsideMarketHours++;
      warnings.push(
        `Trade ${exec.symbol} at ${exec.dateTime.toISOString()} is outside US extended trading hours (4:00 AM – 8:00 PM ET).`,
      );
    }

    validExecutions.push(exec);
  }

  // Summary message when non-US trades were detected
  const totalNonUS = skippedNonUS + skippedNonUSD;
  if (totalNonUS > 0) {
    warnings.unshift(
      `We found trades in non-US markets. Flinch currently supports US stocks only. ${totalNonUS} non-US trade${totalNonUS === 1 ? ' was' : 's were'} skipped.`,
    );
  }

  return {
    validExecutions,
    skippedExecutions,
    warnings,
    summary: {
      totalChecked: executions.length,
      passed: validExecutions.length,
      skippedNonUS,
      skippedNonUSD,
      outsideMarketHours,
    },
  };
}
