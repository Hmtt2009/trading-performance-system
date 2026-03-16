# Code Review Report — Round 4

**Date:** 2026-03-17
**Reviewer:** Claude Code (Automated)
**Scope:** Full codebase — parsers, analysis engine, API routes, frontend, database schema, middleware

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 2     |
| High     | 12    |
| Medium   | 16    |
| Low      | 12    |

---

## Critical Issues

### C1: Missing Tailwind v4 Theme Tokens — ~52 Utility Classes Silently Fail

**File:** `src/app/globals.css:40-64`
**Impact:** UI renders with browser defaults (transparent/black) instead of design system colors.

The `@theme inline` block defines `--color-card` but the codebase uses `bg-panel` (33 occurrences), not `bg-card`. Similarly, `bg-red-bg` (13 uses), `bg-green-bg`, `bg-amber-bg`, `bg-blue-bg` are used but only their semantic aliases (`--color-loss-bg`, `--color-profit-bg`) are defined.

**Missing mappings:**
```css
--color-panel: var(--panel);
--color-panel-hover: var(--panel-hover);
--color-red-bg: var(--red-bg);
--color-green-bg: var(--green-bg);
--color-amber-bg: var(--amber-bg);
--color-blue-bg: var(--blue-bg);
```

**Fix:** Add these 6 lines to the `@theme inline` block.

---

### C2: Protected Pages Have No Client-Side Auth Guard

**Files:** `src/app/dashboard/page.tsx`, `src/app/upload/page.tsx`, `src/app/trades/page.tsx`, `src/app/analysis/page.tsx`
**Impact:** If middleware is bypassed or misconfigured, all protected pages render without authentication checks.

The middleware (see H3) returns a 503 when env vars are missing, which blocks ALL routes. But the protected pages themselves never verify `user` before fetching data — they rely entirely on middleware and API-level auth. If someone accesses the page with a stale session or during a middleware misconfiguration window, the page renders with empty data or errors rather than redirecting to login.

**Fix:** Add a lightweight auth check at the top of each protected page layout or use a shared `<AuthGuard>` wrapper component.

---

## High Priority Issues

### H1: Commission Over-Counted for Partially Matched Trades

**File:** `src/lib/parsers/ibkr-parser.ts:513`
**Also affects:** `schwab-parser.ts`, `tdameritrade-parser.ts`, `webull-parser.ts`

When a position is partially closed (`matchedQty < entryQty`), the commission calculation sums ALL entry and exit execution commissions:
```typescript
const totalComm = [...entryExecs, ...exitExecs].reduce((s, e) => s + e.commission, 0);
```
This includes commission from unmatched executions. For example, if a trader enters 100 shares across 2 fills (50 each at $1 commission) but only exits 50 shares, the code sums all 3 execution commissions ($3) instead of pro-rating ($1.50 for matched portion + $1 for exit).

**Fix:** Pro-rate commission based on `matchedQty / totalQty` for each side.

---

### H2: yahoo-finance2 Constructor May Be Incorrect

**File:** `src/lib/market/postExitPrice.ts:14-15`

```typescript
const YahooFinance = (await import('yahoo-finance2')).default;
return new YahooFinance();
```

In yahoo-finance2 v2, the default export is already an instantiated object (singleton). Calling `new YahooFinance()` on it may throw or create an improperly initialized instance. The v3 API uses `new YahooFinance()` but has a different import pattern.

**Fix:** Verify which version is installed (`package.json`) and use the correct pattern. For v2: use the default export directly without `new`. For v3: use the documented constructor.

---

### H3: Middleware Blocks ALL Routes When Env Vars Missing

**File:** `src/middleware.ts:10-12`

```typescript
if (!supabaseUrl || !supabaseAnonKey) {
  return new NextResponse('Service unavailable...', { status: 503 });
}
```

When `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are not set (common in fresh local dev, CI, or deployment misconfiguration), every route — including the marketing homepage `/`, `/pricing`, `/about` — returns 503. This makes the app completely inaccessible.

**Fix:** Move the env check to AFTER the public route check, or only apply it to routes that actually need authentication.

---

### H4: `createClient()` Throws Uncaught When Env Vars Missing

**Files:** `src/app/login/page.tsx:27`, `src/app/signup/page.tsx`

`createClient()` from `@supabase/ssr` throws if URL/key are missing. In the login page, this is called inside event handlers (`handleEmailLogin`, `handleGoogleLogin`) without a try/catch. If the Supabase client can't initialize, the user sees an unhandled exception rather than a helpful error message.

**Fix:** Wrap `createClient()` in a try/catch or validate env vars before calling.

---

### H5: Unsanitized Tab Query Parameter

**File:** `src/app/analysis/page.tsx:141`

```typescript
const activeTab = (searchParams.get('tab') as TabKey) || 'patterns';
```

The `tab` param is cast to `TabKey` without validation. While this doesn't cause XSS (the value is compared against known keys for rendering), an invalid value silently results in no tab content being rendered — the user sees an empty page with no error.

**Fix:** Validate against `TABS.map(t => t.key)` and fall back to `'patterns'` for invalid values:
```typescript
const rawTab = searchParams.get('tab');
const activeTab = TABS.some(t => t.key === rawTab) ? (rawTab as TabKey) : 'patterns';
```

---

### H6: No AbortController in DebriefView and SessionTimeline

**Files:** `src/components/debrief/DebriefView.tsx:44-46`, `src/components/timeline/SessionTimeline.tsx:74-76`

Both components fetch data in `useEffect` when the `date` prop changes. If the user rapidly changes dates, multiple fetches fire concurrently and the last one to resolve wins — which may not be the most recent date. This causes stale data to appear for the wrong date.

**Fix:** Add `AbortController` to the `useEffect` and abort previous requests on cleanup:
```typescript
useEffect(() => {
  const controller = new AbortController();
  fetchTimeline(controller.signal);
  return () => controller.abort();
}, [date]);
```

---

### H7-H9: Supabase 1000-Row Default Limit Causes Silent Data Truncation

**Files:**
- `src/app/api/upload/route.ts:247-251` — fetches ALL user trades for baseline computation
- `src/app/api/analysis/weekly/route.ts:38-42` — fetches ALL sessions
- `src/app/api/analysis/scorecard/route.ts:38` — fetches ALL trades for period

Supabase PostgREST returns a maximum of 1000 rows by default. For active traders with >1000 trades, baseline computation silently uses only the first 1000, producing inaccurate averages and thresholds. The weekly and scorecard routes similarly truncate.

**Fix:** Add `.limit(10000)` or implement pagination. For the upload route's baseline computation, paginate with `.range(from, to)` in a loop until all rows are fetched.

---

### H10: Duplicate Migration Number 00004

**Files:**
- `supabase/migrations/00004_allow_tdameritrade_broker.sql`
- `supabase/migrations/00004_trade_executions_not_null.sql`

Two migration files share the same `00004` prefix. Supabase CLI processes migrations in lexicographic order. One migration may silently fail or both may run in an unpredictable order, leading to schema inconsistency.

**Fix:** Rename `00004_trade_executions_not_null.sql` to `00006_trade_executions_not_null.sql` and `00005_quantity_to_decimal.sql` to `00007_quantity_to_decimal.sql`.

---

### H11: AiDebrief TypeScript Type Missing `updated_at` Field

**File:** `src/types/database.ts:150-163`

Migration `00003_add_debriefs_updated_at.sql` adds an `updated_at` column with a trigger, but the TypeScript `AiDebrief` interface doesn't include it. Code that reads debriefs and accesses `updated_at` will get a TypeScript error, and code that inserts/updates may include stale type information.

**Fix:** Add `updated_at: string;` to the `AiDebrief` interface.

---

### H12: `quantity` Not Converted with `Number()` After DECIMAL Migration

**File:** `src/app/api/upload/route.ts:262`

Migration `00005_quantity_to_decimal.sql` changes the `quantity` column type from `INTEGER` to `DECIMAL`. Supabase's PostgREST client returns `DECIMAL` columns as **strings**. The upload route converts `entry_price`, `exit_price`, `total_commission`, `position_value` with `Number()` but assigns `quantity` directly:

```typescript
quantity: t.quantity,  // String from DECIMAL column!
```

This causes type mismatches downstream — `positionValue` calculations, pattern detection thresholds, and commission pro-rating all expect numeric `quantity`.

**Fix:** Change to `quantity: Number(t.quantity)`.

---

## Medium Priority Issues

### M1: Population vs Sample Standard Deviation

**File:** `src/lib/analysis/baseline.ts:209-213`

The `stddev` function divides by `n` (population stddev) instead of `n-1` (sample stddev). For a trader's baseline computed from a sample of their trades, sample stddev is more appropriate. This causes the overtrading threshold to be slightly too tight, increasing false positives.

---

### M2: Row Number Inaccurate for Activity Statement Parser Errors

**File:** `src/lib/parsers/ibkr-parser.ts:295`

Error messages report `row` numbers that don't account for section headers and blank lines in Activity Statement format. Reported row numbers don't match the actual CSV file lines, making debugging difficult.

---

### M3: Premature Exit Estimation Flawed for Very Short Holds

**File:** `src/lib/analysis/patterns.ts:290-297`

The premature exit detector estimates "full profit" by dividing actual profit by the hold-time ratio: `estimatedFullProfit = netPnl / holdRatio`. For very short holds (e.g., 1 minute when average is 30), this extrapolates wildly (30x the captured profit). The 3x cap helps but still produces inflated estimates.

---

### M4: `getHours()`/`getDay()` Use Local Timezone in Baseline

**Files:** `src/lib/analysis/baseline.ts:135`, `src/lib/analysis/scorecard.ts:55`

The baseline computation uses `getHours()` and `getDay()` which return local timezone values. On a server in UTC, a trade at 3:30 PM ET would be bucketed as hour 19/20. This causes performance-by-hour and performance-by-day-of-week to be shifted. The scorecard route correctly uses `Intl.DateTimeFormat` with `America/New_York`, but the baseline does not.

---

### M5: IBKR Compact Date Format Parsed Without Timezone

**File:** `src/lib/parsers/ibkr-parser.ts:52`

IBKR Activity Statement dates in `YYYYMMDD` format are parsed as local time via `new Date(...)`. This can shift dates by one day depending on the server timezone.

---

### M6: Quantity/Price Validation Rejects Zero Using Falsy Check

**Files:** `src/lib/parsers/schwab-parser.ts`, `tdameritrade-parser.ts`, `webull-parser.ts`

Validation like `if (!quantity || !price)` rejects quantity=0 or price=0.00 as invalid. While 0-quantity trades are unusual, 0-price can occur for certain corporate actions. This silently drops valid rows.

---

### M7: Direction Determination Fragile for Multi-Day Imports

**File:** `src/lib/parsers/ibkr-parser.ts:496`

Direction is determined by the side of the first execution: `const isLong = firstExec.side === 'buy'`. If executions from a previous day's short entry are imported alongside today's covering buys, the first execution in the array may be a buy (the cover), misclassifying the trade as long.

---

### M8: N+1 Sequential Inserts in Upload Route

**File:** `src/app/api/upload/route.ts` (trade + execution insert loop)

Trades and executions are inserted one-by-one in a loop. For a file with 200 trades averaging 3 executions each, this produces ~800 sequential database roundtrips. Supabase supports batch inserts.

**Fix:** Collect all trades into an array and use a single `.insert(tradesArray)` call, then batch executions similarly.

---

### M9: Full Trade Data Sent to Claude API for Debriefs

**File:** `src/lib/ai/debrief.ts`

The debrief prompt builder sends complete trade data including execution details. For sessions with many trades, this can exceed token limits or inflate API costs.

---

### M10: `parseInt()` Without Radix or NaN Check

**Files:** Multiple API routes using query params

`parseInt(searchParams.get('offset'))` can return `NaN` if the param is not a valid number. This NaN propagates into Supabase `.range()` calls, producing unexpected results.

---

### M11: Bypassable Rate Limit on Debrief Generation

**File:** `src/app/api/ai/debrief/[date]/route.ts`

Rate limiting checks use an in-memory counter or timestamp that resets on server restart. In serverless deployments (Vercel), each invocation may get a fresh instance, making the rate limit ineffective.

---

### M12: Date Parameters Not Validated in API Routes

**Files:** `src/app/api/ai/debrief/[date]/route.ts`, `src/app/api/analysis/timeline/[date]/route.ts`

The `date` path parameter is used directly in database queries without validating its format. Invalid dates like `../../etc/passwd` or `null` are passed to Supabase, which handles them gracefully but wastes a database roundtrip.

---

### M13: `involved_trade_ids` Always Empty in Pattern Detections

**File:** `src/app/api/upload/route.ts` (pattern insert)

The `involved_trade_ids` field in `pattern_detections` is always inserted as an empty array. The pattern detectors compute `involvedTradeIndices` but these indices are never mapped to actual trade database IDs.

---

### M14: `estimated_cost_usd` Never Populated in Debriefs

**File:** `src/app/api/ai/debrief/[date]/route.ts`

The `estimated_cost_usd` column exists in the schema and TypeScript type but is never computed or stored when creating debriefs.

---

### M15: Missing Content Security Policy and Security Headers

**File:** `next.config.ts` or `middleware.ts`

No CSP, HSTS, X-Frame-Options, or other security headers are configured. This is important for a financial application handling sensitive trading data.

---

### M16: `alert()` Used for Stripe Placeholder

**File:** `src/components/marketing/PricingSection.tsx` (or similar)

Client-side `alert()` is used as a placeholder for Stripe integration. This should be replaced before production.

---

## Low Priority Issues

### L1: Hash Missing `accountId` — Cross-Account Collision Risk

**File:** `src/lib/parsers/ibkr-parser.ts`

The execution hash doesn't include `accountId`, so identical trades across different broker accounts could collide and be marked as duplicates.

---

### L2: Index Remap Fallback to `-1` Could Propagate

**File:** `src/lib/analysis/patterns.ts:30`

`originalIndexMap.get(t) ?? -1` returns -1 if a trade isn't found. A -1 index propagated to callers could cause out-of-bounds access.

---

### L3: `formatCurrency` Duplicated Across 7+ Files

**Files:** Multiple components

The same `formatCurrency` helper is reimplemented in `SessionTimeline.tsx`, `CostOfBehaviorView.tsx`, `Dashboard.tsx`, etc. Extract to a shared utility.

---

### L4: File Input Not Reset After Successful Upload

**File:** `src/components/upload/FileUpload.tsx`

After a successful upload, the file input retains its selection. Re-uploading the same file won't trigger the `onChange` event.

---

### L5: `toNullableNumber` Missing Undefined/Empty-String Guard

**File:** `src/app/api/upload/route.ts`

The `toNullableNumber` helper doesn't handle `undefined` or empty string `""` inputs, which could produce `NaN`.

---

### L6: Duplicate Trigger Function in Migrations

**File:** `supabase/migrations/00003_add_debriefs_updated_at.sql`

The trigger function `update_updated_at_column` may already exist from the initial schema. The migration should use `CREATE OR REPLACE FUNCTION`.

---

### L7: RLS Correlated Subquery Performance

**File:** `supabase/migrations/00001_initial_schema.sql`

Some RLS policies use correlated subqueries (e.g., checking `user_id` through a JOIN to `trades`). For large tables, these can cause significant query overhead.

---

### L8: Admin/Service Client Missing `autoRefreshToken: false`

**File:** `src/lib/supabase/server.ts`

Server-side Supabase clients should disable `autoRefreshToken` and `persistSession` since there's no browser context. This prevents unnecessary refresh attempts.

---

### L9: Foreign Keys Missing ON DELETE Behavior

**File:** `supabase/migrations/00001_initial_schema.sql`

Foreign keys like `trade_executions.trade_id -> trades.id` don't specify `ON DELETE CASCADE` or `ON DELETE SET NULL`. Deleting a trade leaves orphaned executions.

---

### L10: Webull Parser Strips Timezone Info

**File:** `src/lib/parsers/webull-parser.ts`

The Webull parser strips timezone suffixes from date strings before parsing, losing timezone context.

---

### L11: Calendar Date Picker UTC Shift

**Files:** `src/app/analysis/page.tsx` (TimelineTab, DebriefTab)

`new Date().toISOString().split('T')[0]` uses UTC date. After midnight local time but before midnight UTC, this returns tomorrow's date, causing confusing default selections.

---

### L12: PatternCard Dismiss Fails Silently

**File:** `src/components/patterns/PatternCard.tsx:68-69`

The dismiss error handler is `catch { // Silently fail }`. The user gets no feedback if the dismiss API call fails — the button just stops spinning.

---

## Recommendations

### Immediate (before first user)
1. Fix C1 (Tailwind theme tokens) — 6 lines added to globals.css
2. Fix H10 (duplicate migration) — file rename
3. Fix H11 (AiDebrief type) — 1 line
4. Fix H12 (quantity Number()) — 1 line
5. Fix H5 (tab validation) — 2 lines

### Before beta launch
6. Fix H1 (commission pro-rating) — moderate refactor across 4 parsers
7. Fix H3 (middleware env check) — move check after public route match
8. Fix H7-H9 (1000-row limit) — add pagination or higher limits
9. Fix H6 (AbortController) — add cleanup to 2 components
10. Fix C2 (client auth guard) — add `<AuthGuard>` wrapper

### Before production
11. Fix H2 (yahoo-finance2 API) — verify and fix constructor usage
12. Fix H4 (createClient throws) — add try/catch
13. Address all Medium issues
14. Add security headers (M15)
15. Replace alert() placeholders (M16)
