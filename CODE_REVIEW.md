# Code Review Report

## Date
2026-03-15 (Round 2 — post-fix review)

## Project Name
Trading Performance System (Flinch)

## Tech Stack
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Recharts
- **Backend:** Next.js API Routes (serverless), Supabase (PostgreSQL + Auth + RLS)
- **AI:** Claude API (Sonnet) for trading debriefs
- **Parsing:** csv-parse, CryptoJS (SHA256 hashing)
- **Testing:** Vitest (30 tests across 2 test files)
- **Deployment:** Vercel

---

### Executive Summary
- **Overall quality score: 6.5/10** (up from 5/10 — prior critical issues resolved)
- **Total issues found: 31**
- **Critical: 3 | High: 8 | Medium: 13 | Low: 7**

Round 1 fixes addressed: cost API response alignment, scorecard Infinity serialization, upload error handling, file size limits, pagination validation, auth callback open redirect, middleware auth bypass, overtrading excessCount, and slice(-0) bug. The remaining issues are primarily: N+1 query performance in uploads, missing rate limiting on the debrief endpoint, timezone inconsistency in the scorecard API, pattern deduplication gaps, and several frontend robustness issues.

---

### Critical Issues (Must Fix)

**C1. Upload route — N+1 query pattern causes severe performance degradation**
- **File:** `src/app/api/upload/route.ts:133-200`
- **Description:** For each trade, the code executes an individual SELECT for duplicate checking (line 135-139) followed by individual INSERTs for the trade and its executions. The existing hashes are already fetched upfront at lines 67-75, making the per-trade duplicate SELECT redundant in most cases. A 100-trade upload triggers 300+ sequential database round-trips.
- **Impact:** Uploads of real-sized files (100+ trades) are extremely slow and may timeout on serverless (Vercel 10s default for hobby, 60s for pro).
- **Fix:** Remove the per-trade duplicate SELECT (rely on upfront hash set + unique constraint catch). Batch trade inserts where possible.

**C2. Debrief API — no rate limiting on expensive Claude API calls**
- **File:** `src/app/api/ai/debrief/[date]/route.ts:36-39`
- **Description:** Each POST hits the Claude API with no rate limiting, throttling, or quota tracking. While the upsert on line 47 prevents duplicate storage, a user can repeatedly call POST for different dates or force re-generation.
- **Impact:** Unbounded API costs. A single malicious user could exhaust the Anthropic API budget.
- **Fix:** Add rate limiting — either per-user daily limit tracked in DB, or per-IP rate limiting via middleware. Even a simple "1 debrief per date per 10 minutes" check would suffice.

**C3. Scorecard API — timezone inconsistency between hour and day-of-week**
- **File:** `src/app/api/analysis/scorecard/route.ts:57-82`
- **Description:** Hour is correctly derived from Eastern Time via `Intl.DateTimeFormat` (line 57-72), but day-of-week uses `entryDate.getUTCDay()` (line 80) which is UTC. A trade at 11 PM ET on Friday is 3 AM UTC Saturday — the scorecard would show this as a Saturday trade but filed under Friday's hour.
- **Impact:** Day-of-week performance data is incorrect for trades near midnight UTC, causing misleading "best/worst day" analysis. Affects the scorecard, insights, and "do more/do less" recommendations.
- **Fix:** Derive day-of-week from the same ET formatter:
  ```typescript
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
  });
  const etDayName = dayFormatter.format(entryDate);
  ```

---

### High Priority Issues

**H1. Pattern deduplication only checks triggerTradeIndex, not involvedTradeIndices**
- **File:** `src/lib/analysis/patterns.ts:324-348`
- **Description:** `deduplicateImpact()` tracks which `triggerTradeIndex` has been counted, but a trade can be involved in multiple patterns without being the trigger. For example, trade 5 triggers overtrading and is also involved in size escalation (triggered by trade 6). Both patterns keep their full dollar impact, double-counting trade 5's P&L.
- **Impact:** Behavior cost can be overstated when patterns share involved trades.
- **Fix:** Build a set of all involved trade indices across patterns and deduplicate impact based on involvement, not just trigger.

**H2. Pattern dismiss endpoint doesn't filter by user_id in query**
- **File:** `src/app/api/analysis/patterns/[id]/route.ts:10`
- **Description:** The initial SELECT fetches the pattern by ID without filtering by user_id: `.eq('id', id).single()`. It then checks `pattern.user_id !== user.id` in application code. If RLS is ever misconfigured or bypassed, this pattern allows cross-user data access before the app-level check.
- **Impact:** Defense-in-depth gap. Currently protected by RLS, but fragile.
- **Fix:** Add `.eq('user_id', user.id)` to the query itself.

**H3. Sessions API — no validation on offset parameter**
- **File:** `src/app/api/sessions/route.ts:14`
- **Description:** `parseInt(searchParams.get('offset') || '0')` has no range validation. Negative values cause undefined Supabase behavior; very large values waste resources.
- **Fix:** `const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);`

**H4. Debrief GET endpoint has no date format validation**
- **File:** `src/app/api/ai/debrief/[date]/route.ts:4-12`
- **Description:** The POST handler validates date format (line 21), but the GET handler passes the date parameter directly to the database query without validation (line 10). Malformed dates won't crash (Supabase treats as string match) but waste a DB query.
- **Fix:** Add the same regex validation as POST: `if (!/^\d{4}-\d{2}-\d{2}$/.test(date))`.

**H5. Silent trade insertion failures not reported to user**
- **File:** `src/app/api/upload/route.ts:172-180, 186-198`
- **Description:** When a trade insert fails (non-duplicate error), it's logged but skipped. When an execution insert fails, it's logged but the parent trade is still counted as imported. The response reports `tradesImported` without indicating partial failures.
- **Impact:** User believes all trades imported successfully when some may have failed silently.
- **Fix:** Track failed inserts and include a `failedTrades` count in the response.

**H6. Database type missing 'tdameritrade' broker name**
- **File:** `src/types/database.ts:19`
- **Description:** `broker_name: 'ibkr' | 'schwab' | 'webull'` — missing `'tdameritrade'` despite TD Ameritrade parser being functional.
- **Fix:** Add `'tdameritrade'` to the union type.

**H7. Null holdTimeMinutes bucketed as scalp trades in scorecard API**
- **File:** `src/app/api/analysis/scorecard/route.ts:85`
- **Description:** `const hold = t.hold_time_minutes || 0` — null hold times become 0, placing them in the "0-5min" (scalp) bucket. These are likely open trades or data gaps, not actual scalps.
- **Impact:** Inflated scalp trade count; skewed hold time analysis.
- **Fix:** Skip trades with null hold time: `if (t.hold_time_minutes == null) continue;` before the bucketing logic.

**H8. indexOf() O(n*m) performance in pattern detection**
- **File:** `src/lib/analysis/patterns.ts:55`
- **Description:** `dayTrades.map((t) => trades.indexOf(t))` performs a linear search for each day's trades. With 500+ total trades and multiple flagged days, this is O(n*m).
- **Fix:** Pre-build an index Map: `const tradeIndex = new Map(trades.map((t, i) => [t, i]));`

---

### Medium Priority Issues

**M1. Code duplication across 4 broker parsers**
- **Files:** `schwab.ts`, `tdameritrade.ts`, `webull.ts`, `ibkr-parser.ts`
- **Description:** `groupIntoTrades()`, `matchExecutionsToTrades()`, `generateHash()`, `round()`, `parseCSVLine()` are copy-pasted with minor variations. ~1200 lines of duplicated logic.
- **Fix:** Extract shared utilities into `src/lib/parsers/shared.ts`.

**M2. Non-IBKR parsers use hand-rolled CSV parsing**
- **Files:** `schwab.ts:189-206`, `tdameritrade.ts:174-191`, `webull.ts:195-212`
- **Description:** Three parsers implement their own `parseCSVLine()` which doesn't handle all edge cases (escaped quotes within quoted fields). IBKR parser correctly uses the `csv-parse` library.
- **Fix:** Use `csv-parse` across all parsers.

**M3. Session timeline — component/API data structure mismatch**
- **File:** `src/components/timeline/SessionTimeline.tsx` vs `src/app/api/analysis/timeline/[date]/route.ts`
- **Description:** Component expects `data.timeline` (pre-computed array) but API returns `{ trades, patterns, session, date }`. Timeline view likely crashes.
- **Fix:** Either transform data client-side or add a `timeline` field to the API response.

**M4. Signup — Google OAuth error leaves button in loading state**
- **File:** `src/app/signup/page.tsx:65-68`
- **Description:** If `supabase.auth.signInWithOAuth` fails, error is displayed but `googleLoading` isn't reset to `false`.
- **Fix:** Add `setGoogleLoading(false)` in the error branch.

**M5. TickerTape, PatternCard — silent error swallowing**
- **Files:** `src/components/TickerTape.tsx:35`, `src/components/patterns/PatternCard.tsx:57-58`
- **Description:** Empty catch blocks silently swallow errors. Users see stale data or frozen UI.
- **Fix:** At minimum, log to console.

**M6. Missing cleanup in FileUpload useEffect**
- **File:** `src/components/upload/FileUpload.tsx:33-40`
- **Description:** useEffect that fetches upload history doesn't return a cleanup function. State updates on unmounted component.
- **Fix:** Add abort controller or mounted flag.

**M7. Premature exit detection uses linear P&L extrapolation**
- **File:** `src/lib/analysis/patterns.ts:270-271`
- **Description:** `estimatedFullProfit = trade.netPnl / holdRatio` assumes profit accrues linearly with time. Capped at 3x but still speculative.
- **Note:** Acknowledged MVP limitation.

**M8. Webull parser — hardcoded US timezone abbreviations**
- **File:** `src/lib/parsers/webull.ts:178`
- **Description:** Only handles EST/EDT/CST/CDT/MST/MDT/PST/PDT. Non-US users may have different formats.

**M9. Schwab/TD parsers — hardcoded noon default time**
- **Files:** `src/lib/parsers/schwab.ts:169`, `tdameritrade.ts:167`
- **Description:** When time component is missing, defaults to `12:00:00`. Intraday pattern detection becomes unreliable.

**M10. Missing database indexes for common query patterns**
- **File:** `supabase/migrations/00001_initial_schema.sql`
- **Description:** Missing composite indexes on: `pattern_detections(user_id, created_at)`, `trades(user_id, symbol)`, `ai_debriefs(user_id, period_start)`.
- **Impact:** Slow queries as data grows.

**M11. CostOfBehaviorView — hardcoded chart colors**
- **File:** `src/components/cost/CostOfBehaviorView.tsx:149,154`
- **Description:** Recharts uses `fontFamily: 'monospace'` instead of design system's `var(--font-space-mono)` and raw hex colors instead of CSS variables.

**M12. computeCostOfBehavior counts zero-impact pattern instances**
- **File:** `src/lib/analysis/session.ts:50-56`
- **Description:** After deduplication zeroes some pattern impacts, `computeCostOfBehavior` still increments `instances` for zero-impact patterns, making counts misleading.
- **Fix:** Only count patterns where `p.dollarImpact !== 0`.

**M13. Missing error boundary in analysis page**
- **File:** `src/app/analysis/page.tsx`
- **Description:** Uses `Suspense` but no `ErrorBoundary`. Component-level throws crash the page.

---

### Low Priority Issues

**L1. Test coverage limited to parsers and analysis engine**
- **Files:** `src/__tests__/ibkr-parser.test.ts`, `src/__tests__/analysis.test.ts`
- **Description:** Only 2 test files covering ~30% of the codebase. No tests for API routes, auth, middleware, or components.

**L2. Admin Supabase client is defined but never used**
- **File:** `src/lib/supabase/admin.ts`
- **Description:** Service role client exported but not imported anywhere. Dead code.

**L3. findStrengths/findLeaks code duplication in scorecard**
- **File:** `src/lib/analysis/scorecard.ts:118-178`
- **Description:** Both functions have identical gathering logic (4 identical for-loops) with only filter/sort differing.

**L4. Landing page uses inline hex colors instead of CSS variables**
- **Files:** `src/app/page.tsx`, `pricing/page.tsx`, `about/page.tsx`
- **Description:** Hardcoded colors don't respect theme system.

**L5. Missing aria-labels on interactive elements**
- **Files:** Multiple components — NavHeader, PatternCard, pricing buttons
- **Description:** Buttons use only `title` without `aria-label`.

**L6. Inconsistent error handling patterns across API routes**
- **Files:** Multiple routes
- **Description:** Mix of inline returns, centralized catch blocks, and silent catch-alls.

**L7. Missing symbol input validation in trades API**
- **File:** `src/app/api/trades/route.ts:26`
- **Description:** Symbol filter passed directly without length or format validation. A 1000-char string wastes resources.
- **Fix:** Validate with regex: `/^[A-Z0-9.\-]{1,10}$/`

---

### Architecture Recommendations

1. **Extract shared parser utilities:** The 4 broker parsers share ~1200 lines of duplicated logic. Extract into `src/lib/parsers/shared.ts` for consistent behavior and single-point bug fixes.

2. **Add API contract validation with Zod:** Zod is already a dependency. Define schemas for all API request parameters and response shapes to catch mismatches at build time.

3. **Implement batch database operations:** Replace sequential per-trade queries in the upload route with bulk `.insert()` calls. This is the single biggest performance improvement available.

4. **Add rate limiting infrastructure:** At minimum, add per-user rate limiting on the debrief endpoint. Consider a shared rate limiter for all API routes.

5. **Add API route integration tests:** The API layer has zero test coverage. Mock Supabase and verify request validation, auth checks, and response shapes.

6. **Use the Anthropic SDK:** Replace raw `fetch()` calls with `@anthropic-ai/sdk` for retries, streaming, error parsing, and type safety.

7. **Add environment validation module:** Create `src/lib/env.ts` using Zod to validate all required env vars at import time, giving clear startup errors instead of cryptic runtime crashes.
