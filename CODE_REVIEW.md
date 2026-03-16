# Code Review Report

## Date
2026-03-15 (Round 3)

## Project Name
Trading Performance System

## Tech Stack
- Next.js 16 (App Router) + React 19 + TypeScript 5
- Supabase (PostgreSQL, Auth, RLS, Storage)
- Tailwind CSS 4
- Claude API (Sonnet) for AI debriefs
- yahoo-finance2 for post-exit price tracking
- Recharts 3.8 for data visualization
- csv-parse for CSV parsing (IBKR only; other parsers use hand-rolled CSV)
- Vitest 4.0 for testing (30+ tests)
- Stripe (billing -- not yet implemented)

---

## Executive Summary

- **Overall Quality Score:** 5/10
- **Total Issues Found:** 55 (deduplicated across all review areas)
- **Critical:** 6 | **High:** 10 | **Medium:** 22 | **Low:** 17

The core analysis engine (pattern detection, baseline computation) is well-designed with thoughtful, trader-relative thresholds. However, several critical bugs exist: the upload route hardcodes broker to IBKR (breaking multi-broker support), the `tdameritrade` value is missing from the database CHECK constraint, there's a division-by-zero in premature exit detection, and the non-IBKR parsers have incorrect VWAP calculations. The "Cost of Behavior" metric -- the product's core value proposition -- uses `Math.abs(dollarImpact)` which incorrectly inflates costs when flagged trades were profitable. Performance-wise, the upload route performs N+1 queries and loads all user trades into memory on every upload. The frontend lacks request cancellation on filter changes, causing race conditions across multiple components.

---

## Critical Issues (Must Fix)

### C1. Upload route hardcodes broker to `'ibkr'`
- **File:** `src/app/api/upload/route.ts:114-116`
- **Description:** When getting/creating a broker account, the code always uses `broker_name: 'ibkr'` regardless of which broker was detected by the parser. Schwab, TD Ameritrade, and Webull uploads are silently misattributed to an IBKR account.
- **Fix:** Use `parseResult.metadata.brokerFormat` to determine the correct broker name.

### C2. `tdameritrade` missing from database CHECK constraint
- **File:** `supabase/migrations/00001_initial_schema.sql:55`
- **Description:** The `broker_accounts.broker_name` CHECK constraint only allows `('ibkr', 'schwab', 'webull')`. TypeScript types include `'tdameritrade'` and the TD Ameritrade parser returns it as `brokerFormat`. Any TD Ameritrade upload will fail with a constraint violation at the database level.
- **Fix:** Add `'tdameritrade'` to the CHECK constraint.

### C3. Division by zero in premature exit detection when `holdTimeMinutes` is 0
- **File:** `src/lib/analysis/patterns.ts:271-272`
- **Description:** When `trade.holdTimeMinutes` is 0 (instant fill), `holdRatio = 0 / avg = 0`, then `estimatedFullProfit = netPnl / 0 = Infinity`. The cap on line 276 limits `leftOnTable` to `netPnl * 3`, so every 0-minute winning trade is falsely flagged as a premature exit with inflated dollar impact. This corrupts cost-of-behavior totals.
- **Fix:** Add `if (trade.holdTimeMinutes <= 0) continue;` before the holdRatio calculation.

### C4. N+1 query pattern in upload route
- **File:** `src/app/api/upload/route.ts:142-209`
- **Description:** Each trade is inserted one at a time in a serial loop with a per-trade duplicate-check query (line 144), an insert (line 155), and per-execution inserts (lines 194-208). A file with 500 trades produces 1000+ sequential database round-trips. This makes uploads extremely slow and will timeout on serverless platforms.
- **Fix:** Batch-insert trades using Supabase's `.insert([...array])`. Remove the per-trade duplicate query (line 144) -- rely on the `existingHashes` set (already loaded at lines 76-84) and the unique constraint catch at line 183.

### C5. IBKR parser: blank line terminates Flex Query section prematurely
- **File:** `src/lib/parsers/ibkr-parser.ts:204-212`
- **Description:** For Flex Query format, the parser stops at the first empty line. If the CSV has a single blank line between trade rows (common in some exports), all subsequent trades are silently dropped with no warning.
- **Fix:** Do not use blank lines as section terminators, or warn when data rows appear after a blank line.

### C6. RLS policy on `trade_executions` uses subquery against nullable FK
- **File:** `supabase/migrations/00001_initial_schema.sql:133, 293-300`
- **Description:** The `trade_executions` RLS policy relies on a correlated subquery to `trades`. But `trade_id` has no `NOT NULL` constraint. If `trade_id` is ever NULL, the execution becomes permanently invisible to all users including the owner.
- **Fix:** Add `NOT NULL` to `trade_executions.trade_id`. Consider adding a `user_id` column directly for a simpler RLS policy.

---

## High Priority Issues

### H1. `Math.abs(dollarImpact)` treats profitable flagged trades as costs
- **File:** `src/lib/analysis/session.ts:21-24, 54`
- **Description:** `behaviorCost` is computed as `patterns.reduce((s, p) => s + Math.abs(p.dollarImpact), 0)`. For overtrading, `dollarImpact` is the net P&L of excess trades. If those excess trades were profitable, `Math.abs()` still counts them as a "cost." The same issue affects `computeCostOfBehavior`. This is the product's core value proposition and shows misleading numbers.
- **Fix:** Define a clear sign convention. Only sum negative impacts as costs, or redesign `dollarImpact` to always represent cost as a positive value.

### H2. `simulatedPnl` calculation is semantically incorrect
- **File:** `src/lib/analysis/session.ts:63-64`
- **Description:** `simulatedPnl = actualPnl + totalBehaviorCost`. Since `totalBehaviorCost` is always positive (sum of `Math.abs`), `simulatedPnl` is always better than `actualPnl`. For overtrading where excess trades were profitable, removing them should make P&L *worse*, not better.
- **Fix:** Each pattern type needs its own sign convention for how `dollarImpact` feeds into simulated P&L.

### H3. VWAP calculation incorrect in Schwab/TDA/Webull parsers
- **File:** `src/lib/parsers/schwab.ts:288-289`, `tdameritrade.ts:273-274`, `webull.ts:294-295`
- **Description:** These parsers compute VWAP using total entry/exit quantity even when `matchedQty < entryQty`. The IBKR parser correctly uses `calculateVWAP(entryExecs, matchedQty)` for FIFO matching. For scaled positions with partial closes, P&L will be wrong in non-IBKR parsers.
- **Fix:** Port the IBKR parser's `calculateVWAP` function to the other parsers, or extract into a shared module.

### H4. Custom CSV parser doesn't handle escaped quotes
- **File:** `src/lib/parsers/schwab.ts:189-206`, `tdameritrade.ts:174-191`, `webull.ts:195-212`
- **Description:** `parseCSVLine` toggles `inQuotes` on every `"`. Per RFC 4180, `""` inside a quoted field is a literal quote. If a field contains an odd number of escaped quotes, parsing breaks for the rest of the line.
- **Fix:** Handle `""` as escaped literal quote, or use the `csv-parse` library already in the project's dependencies.

### H5. Unmatched excess exit quantity silently lost (non-IBKR parsers)
- **File:** `src/lib/parsers/schwab.ts:245-320`, `tdameritrade.ts:230-305`, `webull.ts:251-326`
- **Description:** When `exitQty > entryQty`, excess exit executions are silently discarded. When `entryQty > exitQty`, the IBKR parser creates an open position for the remainder; the other parsers don't.
- **Fix:** Port the IBKR parser's unmatched quantity handling to all parsers.

### H6. Race conditions in data-fetching components
- **File:** `src/components/trades/TradeList.tsx:57-86`, `DashboardView.tsx:60-80`, `ScorecardView.tsx:209-226`, `CostOfBehaviorView.tsx:57-77`
- **Description:** Rapidly switching period selectors or typing in filters fires concurrent fetches with no cancellation. A response from an earlier request can arrive after a later one, overwriting correct data with stale data.
- **Fix:** Use `AbortController` in the `useEffect` cleanup to cancel inflight requests.

### H7. `quantity` column uses INTEGER -- cannot represent fractional shares
- **File:** `supabase/migrations/00001_initial_schema.sql:104, 137`
- **Description:** Both `trades.quantity` and `trade_executions.quantity` use `INTEGER`, but some brokers support fractional shares. TypeScript types use `number` (float). Fractional quantities are silently truncated on insert.
- **Fix:** Change to `DECIMAL(12,4)`.

### H8. All user trades loaded into memory after every upload
- **File:** `src/app/api/upload/route.ts:226-230`
- **Description:** `SELECT * FROM trades WHERE user_id = ?` loads the entire trade history (all columns) into memory after every upload for baseline recomputation. Combined with session/pattern processing, this can exhaust serverless memory.
- **Fix:** Select only needed columns, or move baseline recomputation to a background job.

### H9. No rate limiting on AI debrief endpoint (on main branch)
- **File:** `src/app/api/ai/debrief/[date]/route.ts:15`
- **Description:** The POST endpoint calls the Anthropic Claude API with no rate limiting. A user can spam this endpoint to generate unlimited AI calls. (Note: a fix exists on `fix/debrief-rate-limiting` branch but is not yet merged.)
- **Fix:** Merge the rate-limiting branch, or add per-user rate limiting.

### H10. Upload route is a long-running synchronous request
- **File:** `src/app/api/upload/route.ts` (entire file)
- **Description:** The handler performs file parsing, trade insertion, baseline computation, session analysis, pattern detection, and Yahoo Finance API calls in a single request. On Vercel, default timeout is 10 seconds. This will routinely exceed that.
- **Fix:** Return after parsing + insertion, then process analysis asynchronously.

---

## Medium Priority Issues

### M1. Timezone inconsistency across all parsers
- **File:** All parser files
- **Description:** Dates are parsed as local time in some cases and UTC in others. `toISOString()` used for date grouping produces UTC strings. A trade at 22:00 EST is grouped into the next UTC day. Affects session analysis, hour-of-day metrics, and day-of-week performance.
- **Fix:** Normalize all times to a consistent timezone (e.g., America/New_York).

### M2. `getHours()` uses local time vs `toISOString()` uses UTC for grouping
- **File:** `src/lib/analysis/baseline.ts:135`, `scorecard.ts:55`
- **Description:** `getHours()` returns server local hour. `toISOString().split('T')[0]` returns UTC date. Hour-of-day and date groupings are inconsistent.
- **Fix:** Use consistent timezone handling throughout.

### M3. Population standard deviation used instead of sample standard deviation
- **File:** `src/lib/analysis/baseline.ts:209-214`
- **Description:** The `stddev` function divides by N (population) instead of N-1 (sample). With small datasets, this underestimates variance and makes overtrading detection too sensitive.
- **Fix:** Use Bessel's correction: `Math.sqrt(sum / (N - 1))`.

### M4. `trades.indexOf(t)` is O(n) per lookup in overtrading detection
- **File:** `src/lib/analysis/patterns.ts:56`
- **Description:** For each day flagged as overtrading, `indexOf` performs a linear scan. Across all flagged days, this approaches O(n^2).
- **Fix:** Build a `Map<ParsedTrade, number>` lookup for O(1) resolution.

### M5. Hash collision: identical fills at same timestamp treated as duplicates
- **File:** All parsers (e.g., `ibkr-parser.ts:78`, `schwab.ts:209`)
- **Description:** Hash is `SHA256(symbol|dateTime|side|quantity|price)`. Two identical partial fills at the same second produce the same hash, silently dropping a legitimate execution.
- **Fix:** Include a row index or running counter in the hash.

### M6. Webull timezone stripping loses information
- **File:** `src/lib/parsers/webull.ts:178`
- **Description:** Strips EST/EDT/PST before parsing, then creates Date in server local time. On a UTC server, EST times are off by 5 hours.
- **Fix:** Convert timezone abbreviations to UTC offsets before parsing.

### M7. Negative hold time not handled
- **File:** `src/lib/parsers/ibkr-parser.ts:519-521`, `schwab.ts:297`
- **Description:** `holdTimeMinutes` can be negative if exit timestamp precedes entry timestamp (e.g., short trades with misordered fills). Stored as-is, affecting downstream analysis.
- **Fix:** Use `Math.abs()` on hold time, or ensure correct entry/exit ordering.

### M8. No test coverage for Schwab, TD Ameritrade, or Webull parsers
- **File:** `src/__tests__/`
- **Description:** Three of four broker parsers have zero test coverage (300+ lines each). Bugs like the VWAP issue (H3) go undetected.
- **Fix:** Add test suites for each broker parser.

### M9. Massive code duplication across broker parsers
- **File:** `src/lib/parsers/schwab.ts`, `tdameritrade.ts`, `webull.ts`
- **Description:** `matchExecutionsToTrades`, `groupIntoTrades`, `generateHash`, `parseCSVLine`, and `round` are duplicated nearly identically across all three files. Bug fixes must be applied in 4 places.
- **Fix:** Extract shared logic into `src/lib/parsers/shared.ts`.

### M10. `file_path` constructed from unsanitized user-controlled filename
- **File:** `src/app/api/upload/route.ts:59`
- **Description:** `file.name` from the client could contain path traversal characters. Currently only stored as metadata, but could be dangerous if later used for storage operations.
- **Fix:** Sanitize `file.name` by stripping directory separators and special characters.

### M11. Upload page in PUBLIC_ROUTES but API requires auth
- **File:** `src/middleware.ts:4`
- **Description:** `/upload` is public so unauthenticated users see the upload UI but API calls fail. Landing page CTA says "No Account Needed" (page.tsx:97).
- **Fix:** Either implement anonymous upload or remove `/upload` from public routes and update CTA.

### M12. Missing `offset` validation in sessions route
- **File:** `src/app/api/sessions/route.ts:14`
- **Description:** No lower bound check on `offset`. A negative offset produces unexpected `.range()` behavior.
- **Fix:** Add `Math.max(0, ...)`.

### M13. Unbounded `IN` clause in weekly route
- **File:** `src/app/api/analysis/weekly/route.ts:49-54`
- **Description:** All session IDs collected and passed in a single `.in()` query. Hundreds of sessions could exceed query plan limits.
- **Fix:** Use a join/subquery instead of materializing IDs client-side.

### M14. Dashboard and scorecard routes fetch all data without limits
- **File:** `src/app/api/analysis/dashboard/route.ts:39-44`, `scorecard/route.ts:38`
- **Description:** Pattern detections and trade data fetched without limits for broad periods. Could return thousands of rows.
- **Fix:** Add `.limit()` or aggregate in the database.

### M15. Missing composite index for upload route query pattern
- **File:** `supabase/migrations/00001_initial_schema.sql`
- **Description:** Upload route queries `pattern_detections` by `(session_id, trigger_trade_id, pattern_type)` but only `session_id` is individually indexed.
- **Fix:** Add composite index: `CREATE INDEX idx_patterns_session_trigger ON pattern_detections(session_id, trigger_trade_id, pattern_type);`

### M16. Missing `updated_at` triggers on most tables
- **File:** `supabase/migrations/00001_initial_schema.sql`
- **Description:** The `update_updated_at()` trigger only applies to `users`. Tables like `trader_baselines`, `file_uploads`, and `pattern_detections` have no automatic timestamp management.
- **Fix:** Add `updated_at` columns and triggers to tables where modification tracking matters.

### M17. Accessibility: missing `htmlFor`/`id` on form labels
- **File:** `src/app/login/page.tsx:86,101`, `signup/page.tsx:125,140,155`, `analysis/page.tsx:107,125`
- **Description:** Labels lack `htmlFor`, inputs lack `id`. Screen readers cannot associate labels with controls.
- **Fix:** Add matching `id` and `htmlFor` attributes.

### M18. Accessibility: file input has no accessible label
- **File:** `src/components/upload/FileUpload.tsx:107`
- **Description:** Hidden file input has no `aria-label` or associated `<label>`.
- **Fix:** Add `aria-label="Upload CSV file"`.

### M19. `formatCurrency` duplicated across 7+ files
- **File:** Multiple component files
- **Description:** Identical utility function copy-pasted in DashboardView, TradeList, ScorecardView, SessionTimeline, CostOfBehaviorView, TickerTape, weekly page.
- **Fix:** Extract to `src/lib/utils/format.ts`.

### M20. Error response parsing may throw on non-JSON responses
- **File:** `DashboardView.tsx:66-67`, `TradeList.tsx:72-73`, `ScorecardView.tsx:215-216`, `CostOfBehaviorView.tsx:63-64`
- **Description:** When response is not OK, `res.json()` is called to extract error. If server returns HTML (502 proxy error), `json()` throws and original error is lost.
- **Fix:** Wrap error JSON parsing in its own try-catch.

### M21. Fake progress bar misleads users
- **File:** `src/components/upload/FileUpload.tsx:52-63`
- **Description:** Progress values (10%, 30%, 80%, 100%) are hardcoded and don't reflect actual upload progress.
- **Fix:** Use `XMLHttpRequest` with progress events, or show an indeterminate spinner.

### M22. Pricing page Pro button uses `alert()`
- **File:** `src/app/pricing/page.tsx:92`
- **Description:** `onClick={() => alert('Stripe coming soon')}` is unprofessional placeholder UX.
- **Fix:** Replace with a toast notification or disable the button with a "Coming Soon" label.

---

## Low Priority Issues

### L1. `amountIdx` declared but never used
- **File:** `src/lib/parsers/schwab.ts:45`, `tdameritrade.ts:45`
- **Description:** Dead code.
- **Fix:** Remove.

### L2. Overtrading: `triggerTradeIndex` could be -1
- **File:** `src/lib/analysis/patterns.ts:57`
- **Description:** `trades.indexOf(t)` returns -1 if not found. Downstream code using this index gets `undefined`.
- **Fix:** Guard against -1 values.

### L3. PostExitPrice uses first bar close, not actual trade exit price
- **File:** `src/lib/market/postExitPrice.ts:41`
- **Description:** `exitPrice` in `PostExitData` is the close of the first hourly bar, not the trader's fill price. Variable naming is misleading.
- **Fix:** Rename to `firstBarClose` or accept actual exit price as a parameter.

### L4. Debrief prompt sends full trade data as untruncated JSON
- **File:** `src/lib/ai/debrief.ts:76`
- **Description:** For days with 50+ trades, this consumes significant LLM context and increases API costs.
- **Fix:** Cap trades sent (e.g., top 20 most impactful).

### L5. Breakeven trades classified as losses
- **File:** `src/lib/analysis/baseline.ts:43`, `scorecard.ts:38`
- **Description:** `netPnl! <= 0` includes $0.00 P&L as losses. Inflates loss count.
- **Fix:** Use `< 0` for losses.

### L6. `crypto-js` is deprecated/unmaintained
- **File:** `package.json:17`
- **Description:** Node.js has built-in `crypto` module with SHA256 support.
- **Fix:** Replace with `import { createHash } from 'crypto'` and remove dependency.

### L7. Hardcoded AI model version
- **File:** `src/app/api/ai/debrief/[date]/route.ts:39`
- **Description:** `'claude-sonnet-4-20250514'` is hardcoded.
- **Fix:** Move to environment variable.

### L8. Dynamic imports used unnecessarily on every request
- **File:** All API routes (e.g., `trades/route.ts:10`)
- **Description:** `await (await import('@/lib/supabase/server')).createClient()` on every request. Double-await pattern is convoluted.
- **Fix:** Use standard static imports.

### L9. Admin client defined but never used
- **File:** `src/lib/supabase/admin.ts`
- **Description:** Unused code increases attack surface.
- **Fix:** Remove if unused.

### L10. `dark` class hardcoded with no toggle
- **File:** `src/app/layout.tsx:35`
- **Description:** Dark mode only, no toggle mechanism.
- **Fix:** Informational -- document as intentional.

### L11. Tab switching uses `router.push()` polluting browser history
- **File:** `src/app/analysis/page.tsx:142`
- **Description:** Each tab change creates a history entry. Back button steps through tabs instead of going to previous page.
- **Fix:** Use `router.replace()`.

### L12. No debounce on symbol filter input
- **File:** `src/components/trades/TradeList.tsx:124-127`
- **Description:** Every keystroke triggers an API request.
- **Fix:** Debounce by 300-500ms.

### L13. Duplicate padding classes on weekly page
- **File:** `src/app/analysis/weekly/page.tsx:111`
- **Description:** Both `py-6` and `py-20` specified on the same element.
- **Fix:** Remove the duplicate.

### L14. Duplicate tagline on pricing page
- **File:** `src/app/pricing/page.tsx:44, 100-102`
- **Description:** "Built for beginner and intermediate traders" appears twice.
- **Fix:** Remove one instance.

### L15. Non-deterministic test data
- **File:** `src/__tests__/analysis.test.ts:25, 39-40`
- **Description:** `Math.random()` in test helpers makes tests potentially flaky.
- **Fix:** Use deterministic test data or a seeded PRNG.

### L16. `vitest.config.ts` uses `__dirname` (CommonJS in ESM context)
- **File:** `vitest.config.ts:10`
- **Description:** `__dirname` is CommonJS. Works via Vitest transform but technically incorrect for ESM.
- **Fix:** Use `import.meta.dirname` or `fileURLToPath`.

### L17. Duplicate navigation components across marketing pages
- **File:** `src/app/page.tsx:67-82`, `pricing/page.tsx:25-37`, `about/page.tsx:7-19`
- **Description:** Inline nav bars duplicated across 3 pages.
- **Fix:** Extract into a shared marketing nav component.

---

## Architecture Recommendations

### 1. Extract shared parser logic
The Schwab, TD Ameritrade, and Webull parsers duplicate ~200 lines of identical trade-grouping, CSV parsing, and hashing code. Extract into a shared module (`src/lib/parsers/shared.ts`) to fix bugs once and maintain consistency.

### 2. Move upload processing to background job
The upload route does too much synchronously: parse, insert, baseline, sessions, patterns, market data. Split into:
- **Phase 1 (sync):** Parse CSV, insert trades, return upload summary
- **Phase 2 (async):** Baseline recomputation, session analysis, pattern detection, post-exit price enrichment

### 3. Standardize timezone handling
Adopt a consistent timezone strategy (e.g., all timestamps stored as UTC, all analysis done in America/New_York). Create a timezone utility module used across all parsers and analysis functions.

### 4. Fix Cost of Behavior semantics
The sign convention for `dollarImpact` needs to be clearly defined per pattern type:
- **Overtrading:** cost = negative P&L of excess trades (if profitable, not a cost)
- **Size escalation:** cost = excess loss from oversizing
- **Rapid reentry:** cost = loss from the revenge trade
- **Premature exit:** cost = profit left on table (always positive)

### 5. Add request cancellation across frontend
All data-fetching components should use `AbortController` to cancel stale requests when filters/periods change.

### 6. Batch database operations
Replace per-trade INSERT loops with bulk inserts. Consider using database functions (RPCs) for complex operations like session analysis.
