# Code Review Report

## Date
2026-03-15

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
- **Overall quality score: 5/10**
- **Total issues found: 39**
- **Critical: 7 | High: 12 | Medium: 14 | Low: 6**

The core architecture is sound — baseline-relative pattern detection, execution grouping, and the analysis pipeline are well-designed. However, there are multiple API-to-component data contract mismatches that cause crashes and broken views in production. The upload route has N+1 query performance issues, several API routes lack input validation, and the debrief endpoint has no rate limiting or response validation. Security posture is reasonable (RLS, auth middleware) but the auth callback has an open redirect vulnerability and the middleware silently skips auth when env vars are missing.

---

### Critical Issues (Must Fix)

**C1. CostOfBehaviorView — API response contract mismatch**
- **File:** `src/components/cost/CostOfBehaviorView.tsx:15-30` vs `src/app/api/analysis/cost/route.ts:34`
- **Description:** The component interface expects `{ actualPnl, simulatedPnl, byPattern: Array, equityCurveComparison[].simulated }` but the API returns `{ totalNetPnl, estimatedPnlWithout, byPattern: Record<string,Object>, equityCurveComparison[].withoutPatterns }`. Four field name mismatches + byPattern is an object but component iterates it as an array (`data.byPattern.length`, `data.byPattern.sort().map()`).
- **Impact:** Cost of Behavior view renders with undefined values; `data.byPattern.length` returns `undefined`, `.sort()` crashes. The entire analysis tab is broken.
- **Fix:** Align the API response field names with the component interface, or transform the data client-side. Specifically: rename `totalNetPnl` → `actualPnl`, `estimatedPnlWithout` → `simulatedPnl`, convert `byPattern` from `Record` to array with `patternType`/`instances`/`totalImpact` fields, rename `withoutPatterns` → `simulated` in equity curve entries.

**C2. Upload route — N+1 query pattern causes severe performance degradation**
- **File:** `src/app/api/upload/route.ts:124-187`
- **Description:** For each trade in the parse result, the code makes 2-3 individual database queries: one SELECT to check for duplicates (line 126-130), one INSERT for the trade (line 137-161), and N INSERTs for executions (line 176-186). A 100-trade upload triggers 300+ sequential database round-trips.
- **Impact:** Uploads of real-sized files (100+ trades) are extremely slow and may timeout on serverless.
- **Fix:** Batch the duplicate check with a single `.in('execution_hash', allHashes)` query before the loop. Use bulk `.insert()` for trades and executions.

**C3. Debrief API — no rate limiting, no response validation**
- **File:** `src/app/api/ai/debrief/[date]/route.ts:29-36`
- **Description:** Each POST hits the Claude API ($0.01-0.05 per call) with no rate limiting, no caching, and no check of `response.ok` before calling `response.json()` (line 34). If Claude returns an error status, parsing fails silently. The API key uses non-null assertion (`process.env.ANTHROPIC_API_KEY!`) without checking it exists.
- **Impact:** Users can spam-generate debriefs incurring unlimited API costs. Failed Claude responses produce garbage debriefs stored permanently. Missing API key causes runtime crash.
- **Fix:** Add rate limiting (1 debrief per date per hour), check `response.ok` before parsing, validate env var at startup.

**C4. Auth callback — open redirect vulnerability**
- **File:** `src/app/auth/callback/route.ts:7,13`
- **Description:** The `next` query parameter is used directly in the redirect URL without validation: `NextResponse.redirect(\`${origin}${next}\`)`. An attacker can craft a URL like `/auth/callback?code=xxx&next=//evil.com` which redirects to `https://yoursite.com//evil.com` — browser resolves this as a protocol-relative URL to `evil.com`.
- **Impact:** Phishing attacks after OAuth login. Attacker sends victim a crafted login link; after successful auth, victim is redirected to attacker's lookalike site.
- **Fix:** Validate `next` starts with `/` and doesn't contain `//`: `if (!/^\/[a-zA-Z0-9\/_-]*$/.test(next)) next = '/dashboard';`

**C5. Middleware auth bypass when env vars are missing**
- **File:** `src/middleware.ts:10-12`
- **Description:** If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing, middleware does `return NextResponse.next()` — allowing unauthenticated access to all protected routes (`/dashboard`, `/analysis`, `/trades`, all API routes).
- **Impact:** If Vercel env vars are accidentally deleted or misconfigured, entire app becomes publicly accessible including user data.
- **Fix:** Return a 503 error response instead of passing through: `return new NextResponse('Service unavailable', { status: 503 });`

**C6. Scorecard profitFactor can be Infinity — breaks JSON serialization**
- **File:** `src/lib/analysis/scorecard.ts:48`
- **Description:** When `grossLosses === 0` and `grossWins > 0`, profitFactor is set to `Infinity`. `JSON.stringify({ profitFactor: Infinity })` produces `{"profitFactor":null}`. This propagates through the API response as `null`, causing downstream rendering issues.
- **Impact:** Scorecard view shows incorrect profit factor for traders with no losing trades. API response contains unexpected nulls.
- **Fix:** Cap at a display-friendly maximum: `grossWins > 0 ? 999.99 : 0`

**C7. Session analysis — nonsensical type cast masks bug**
- **File:** `src/lib/analysis/session.ts:71`
- **Description:** `patternType: type as ParsedTrade['direction'] extends string ? typeof type : never` — this conditional type resolves to `typeof type` (which is `string`) since `ParsedTrade['direction']` does extend `string`. The cast is confusing and masks the fact that `type` should be validated as a `PatternType` union member.
- **Impact:** Invalid pattern type strings could be passed through without TypeScript catching them. Currently works by coincidence since input comes from the Map key which originates from valid `PatternType` values.
- **Fix:** Use `type as PatternType` directly, or better, type the Map key as `PatternType`.

---

### High Priority Issues

**H1. Upload route — silent failures on database operations**
- **File:** `src/app/api/upload/route.ts:176-186,232-249,264-278,302-313`
- **Description:** Multiple database operations (trade execution inserts, baseline upserts, session upserts, pattern inserts) have no error checking. The return value of each `.insert()` / `.upsert()` is ignored.
- **Impact:** Partial data insertion without user notification. Baseline or session data could silently fail to update, causing stale analysis.
- **Fix:** Check `{ error }` on each operation; collect errors and include in response.

**H2. Upload route — unvalidated file size**
- **File:** `src/app/api/upload/route.ts:18-32`
- **Description:** No file size validation before `await file.text()`. A malicious user could upload a multi-GB file, exhausting serverless function memory.
- **Impact:** DoS via memory exhaustion. Vercel functions have 1-4GB memory limits.
- **Fix:** Add `if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 413 });`

**H3. Date parameters not validated in API routes**
- **File:** `src/app/api/analysis/timeline/[date]/route.ts:9-11` and `src/app/api/ai/debrief/[date]/route.ts:9,20-21`
- **Description:** The `date` URL parameter is used directly in database queries without format validation. `new Date(date)` accepts arbitrary strings and returns Invalid Date, causing `nextDate.toISOString()` to throw.
- **Impact:** Malformed date parameters crash the API route with an unhandled exception.
- **Fix:** Validate with regex: `if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });`

**H4. Trades API — no validation on page/limit/sortBy parameters**
- **File:** `src/app/api/trades/route.ts:13-18`
- **Description:** `parseInt()` is called on page/limit without range validation. Negative page creates negative offset. Zero or very large limit could return entire database.
- **Impact:** Invalid pagination behavior; potential performance issues with unbounded limit.
- **Fix:** Clamp values: `Math.max(1, page)`, `Math.min(Math.max(1, limit), 100)`.

**H5. Parser price/quantity validation rejects zero values incorrectly**
- **File:** `src/lib/parsers/ibkr-parser.ts:334-341`, `schwab.ts`, `tdameritrade.ts`, `webull.ts` (same pattern)
- **Description:** All parsers use `if (!price || isNaN(price))` which rejects price of 0. While rare, 0 is a valid falsy number. The `!quantity` check similarly rejects quantity of 0 after `Math.abs()`.
- **Impact:** Edge case: legitimate zero-price transactions or adjustments are rejected with error.
- **Fix:** Use `if (isNaN(price))` instead of `if (!price || isNaN(price))`. For quantity, use `if (isNaN(quantity) || quantity <= 0)`.

**H6. Overtrading pattern — excess trades attribution is incorrect**
- **File:** `src/lib/analysis/patterns.ts:50-53`
- **Description:** `excessCount = Math.round(dayTrades.length - baseline.avgTradesPerDay)` then `excessTrades = dayTrades.slice(-excessCount)`. If threshold is 10 and trader made 11 trades, excess is `11 - avg(5) = 6`, attributing the last 6 trades as excess rather than just the 1 trade above threshold. The dollar impact sums P&L of those 6 trades, over-reporting behavior cost.
- **Impact:** Overtrading dollar impact is inflated — attributes too many trades as "excess".
- **Fix:** Use `excessCount = dayTrades.length - Math.ceil(effectiveThreshold)` to calculate trades above the detection threshold, not above the average.

**H7. indexOf() performance issue in pattern detection**
- **File:** `src/lib/analysis/patterns.ts:55`
- **Description:** `dayTrades.map((t) => trades.indexOf(t))` performs O(n*m) search on every detected overtrading day. With 500+ trades and multiple flagged days, this is unnecessarily slow.
- **Impact:** Slow pattern detection for large datasets.
- **Fix:** Pre-build an index Map of trade references to positions.

**H8. Null holdTimeMinutes bucketed as "scalp" trades**
- **File:** `src/lib/analysis/scorecard.ts:83`
- **Description:** `const mins = t.holdTimeMinutes || 0` — null hold times become 0, placing them in the "scalp (<5m)" bucket. These are likely open trades or data gaps, not actual scalps.
- **Impact:** Inflated scalp trade count; skewed hold time analysis.
- **Fix:** Skip trades with null holdTimeMinutes: `if (t.holdTimeMinutes == null) continue;`

**H9. Database type missing 'tdameritrade' broker**
- **File:** `src/types/database.ts:19`
- **Description:** `broker_name: 'ibkr' | 'schwab' | 'webull'` — missing `'tdameritrade'` despite TD Ameritrade parser existing and being functional.
- **Impact:** TypeScript won't catch broker name mismatches for TD Ameritrade accounts.
- **Fix:** Add `'tdameritrade'` to the union type.

**H10. Upload route — non-null assertion crash**
- **File:** `src/app/api/upload/route.ts:117`
- **Description:** `brokerAccountId = newAccount!.id` — if the broker account insert fails (e.g., database error), `newAccount` is null and this crashes.
- **Impact:** Unhandled exception crashes the upload for the user with no useful error.
- **Fix:** Check for null: `if (!newAccount) return NextResponse.json({ error: 'Failed to create broker account' }, { status: 500 });`

**H11. Supabase clients use non-null assertion without env validation**
- **File:** `src/lib/supabase/client.ts:5-6`, `server.ts:8-9`, `admin.ts:10-11`
- **Description:** All three clients use `process.env.NEXT_PUBLIC_SUPABASE_URL!` without verifying the variable exists. If missing, the Supabase client silently receives `undefined`.
- **Impact:** Cryptic runtime errors instead of clear "missing env var" messages.
- **Fix:** Add a shared env validation module that throws at import time if required vars are missing.

**H12. Empty next.config.ts — no security headers**
- **File:** `next.config.ts`
- **Description:** The Next.js config is empty. No security headers configured (X-Content-Type-Options, X-Frame-Options, Content-Security-Policy, etc.).
- **Impact:** Vulnerable to clickjacking, MIME type confusion, and missing CSP protection.
- **Fix:** Add security headers configuration to `next.config.ts`.

---

### Medium Priority Issues

**M1. Code duplication across broker parsers**
- **Files:** `schwab.ts`, `tdameritrade.ts`, `webull.ts` — each ~330 lines
- **Description:** `groupIntoTrades()`, `matchExecutionsToTrades()`, `generateHash()`, `round()`, `parseCSVLine()` are copy-pasted with minor variations across all three non-IBKR parsers. IBKR parser has its own versions. Total: ~1200 lines of duplicated logic.
- **Impact:** Bug fixes (like the VWAP calculation) must be applied in 4 places. Inconsistent trade matching behavior across brokers.
- **Fix:** Extract shared utilities into a `src/lib/parsers/shared.ts` module.

**M2. CostOfBehaviorView — hardcoded chart colors and fonts**
- **File:** `src/components/cost/CostOfBehaviorView.tsx:149,154,162-163`
- **Description:** Recharts config uses `fontFamily: 'monospace'` instead of the design system's `var(--font-space-mono)`, and raw hex colors instead of CSS variables.
- **Impact:** Charts don't match the rest of the UI styling. Inconsistent with DashboardView which correctly uses CSS variables.

**M3. TickerTape, PatternCard — silent error swallowing**
- **Files:** `src/components/TickerTape.tsx:35`, `src/components/patterns/PatternCard.tsx:57-58`
- **Description:** Empty catch blocks that silently swallow errors. Users see stale data or frozen UI with no error indication.
- **Fix:** At minimum, log to console. Preferably, set an error state.

**M4. DashboardView calendarData — potential crash on empty array edge case**
- **File:** `src/components/dashboard/DashboardView.tsx:277`
- **Description:** `new Date(calendarData[0].date + 'T00:00:00')` — while guarded by `calendarData.length > 0` on line 267, a race condition or unexpected API response shape could cause index-out-of-bounds.
- **Impact:** Low probability crash in calendar rendering.

**M5. Non-IBKR parsers use hand-rolled CSV parsing**
- **Files:** `schwab.ts:189-206`, `tdameritrade.ts:174-191`, `webull.ts:195-212`
- **Description:** Three parsers implement their own `parseCSVLine()` which doesn't handle all CSV edge cases (escaped quotes within quoted fields, multi-line fields). IBKR parser correctly uses the `csv-parse` library.
- **Impact:** Parsing failures on CSV files with edge-case formatting (commas in description fields, etc.).
- **Fix:** Use `csv-parse` across all parsers.

**M6. Premature exit detection uses linear P&L extrapolation**
- **File:** `src/lib/analysis/patterns.ts:270-271`
- **Description:** `estimatedFullProfit = trade.netPnl / holdRatio` assumes profit accrues linearly with time. In reality, stock prices don't move linearly. A trade held 2x longer doesn't earn 2x profit.
- **Impact:** Left-on-table estimates can be significantly overstated (capped at 3x, but still speculative).
- **Note:** Acknowledged as MVP limitation in code comments. Flag for future improvement.

**M7. Missing cleanup in FileUpload useEffect**
- **File:** `src/components/upload/FileUpload.tsx:33-40`
- **Description:** useEffect that fetches upload history doesn't return a cleanup function. If component unmounts during fetch, state updates occur on unmounted component.
- **Impact:** React warning in console; potential memory leak on rapid navigation.

**M8. Webull parser — hardcoded US timezone abbreviations**
- **File:** `src/lib/parsers/webull.ts:178`
- **Description:** Only handles EST/EDT/CST/CDT/MST/MDT/PST/PDT. Webull users in other regions could have different timezone formats.
- **Impact:** Date parsing fails silently for non-US timezones, producing invalid trade timestamps.

**M9. Schwab/TD parsers — hardcoded noon default time**
- **Files:** `src/lib/parsers/schwab.ts:169`, `tdameritrade.ts:167`
- **Description:** When time component is missing, defaults to `12:00:00`. Intraday pattern detection (rapid re-entry, hold time) becomes unreliable.
- **Impact:** False negatives in time-based pattern detection for trades missing timestamps.

**M10. Session timeline — API response structure mismatch**
- **File:** `src/components/timeline/SessionTimeline.tsx` vs `src/app/api/analysis/timeline/[date]/route.ts`
- **Description:** Component expects `data.timeline` (pre-computed array with `cumPnl` and pattern associations) but API returns `{ trades, patterns, session, date }` (raw arrays). The component likely crashes when accessing `data.timeline.length`.
- **Impact:** Session timeline view is broken.

**M11. Debrief markdown parser — potential XSS**
- **File:** `src/components/debrief/DebriefView.tsx:163-215`
- **Description:** Custom markdown rendering uses string splitting and `replace()` to strip markdown syntax, then renders as JSX text nodes. While React auto-escapes text content (safe), if `dangerouslySetInnerHTML` is ever added, this becomes an XSS vector. The AI debrief content originates from Claude API which could be influenced by prompt injection from trade data.
- **Impact:** Low risk currently (React escapes), but fragile pattern.

**M12. Signup — Google OAuth error leaves button in loading state**
- **File:** `src/app/signup/page.tsx:65-68`
- **Description:** If `supabase.auth.signInWithOAuth` fails, the error is displayed but `googleLoading` isn't set back to `false`. The Google sign-in button appears frozen.
- **Fix:** Add `setGoogleLoading(false)` in the error branch.

**M13. Cost API — byPattern uses count/totalImpact but component expects instances/totalImpact**
- **File:** `src/app/api/analysis/cost/route.ts:25-27`
- **Description:** API builds `byPattern` with field name `count` but `CostOfBehaviorView` expects `instances`. This is part of the larger C1 mismatch but worth calling out separately.
- **Impact:** Pattern instance counts show as undefined in the breakdown table.

**M14. Missing database indexes for common query patterns**
- **File:** `supabase/migrations/00001_initial_schema.sql`
- **Description:** Missing composite indexes on: `pattern_detections(user_id, created_at)` (used by dashboard/cost queries), `trades(user_id, symbol)` (used by symbol filter), `ai_debriefs(user_id, period_start)` (used by debrief lookup).
- **Impact:** Slow queries as data grows. Full table scans on frequently-accessed routes.

---

### Low Priority Issues

**L1. TypeScript target is ES2017**
- **File:** `tsconfig.json:3`
- **Description:** ES2017 is dated. ES2020+ is recommended for modern Next.js projects.
- **Impact:** No functional issue currently but limits available syntax optimizations.

**L2. findStrengths/findLeaks code duplication**
- **File:** `src/lib/analysis/scorecard.ts:118-178`
- **Description:** `findStrengths()` and `findLeaks()` have identical gathering logic (4 identical for-loops each) with only the filter/sort differing.
- **Fix:** Extract common gathering into a helper.

**L3. Landing page uses inline hex colors instead of CSS classes**
- **Files:** `src/app/page.tsx`, `pricing/page.tsx`, `about/page.tsx`
- **Description:** Colors like `#070709`, `#00e87a`, `#6b6b78` hardcoded throughout. Dashboard components correctly use design system classes (`text-green`, `bg-panel`, etc.).
- **Impact:** Marketing pages won't respect theme changes. Inconsistent with app pages.

**L4. Missing aria-labels on interactive elements**
- **Files:** Multiple components — NavHeader, PatternCard, pricing buttons
- **Description:** Several buttons and links use only `title` attributes without `aria-label`, reducing screen reader accessibility.

**L5. Admin client is defined but never used**
- **File:** `src/lib/supabase/admin.ts`
- **Description:** The service role admin client is exported but not imported anywhere in the codebase.
- **Impact:** Dead code. The service role key is loaded unnecessarily.

**L6. Test coverage limited to parsers and analysis engine**
- **Files:** `src/__tests__/ibkr-parser.test.ts`, `src/__tests__/analysis.test.ts`
- **Description:** Only 2 test files covering ~30% of the codebase. No tests for: API routes, auth flow, middleware, components, database operations.
- **Impact:** Regressions in API layer or auth go undetected.

---

### Architecture Recommendations

1. **Extract shared parser utilities:** The 4 broker parsers share ~1200 lines of duplicated logic (trade grouping, VWAP, hashing, rounding). Extract into `src/lib/parsers/shared.ts` to ensure consistent behavior and single-point bug fixes.

2. **Add API contract validation:** Use Zod schemas (already a dependency) to validate both API request parameters and response shapes. This would have caught the C1 mismatch at build time.

3. **Implement batch database operations:** The upload route's sequential per-trade queries are the biggest performance bottleneck. Supabase supports bulk `.insert()` — use it for trades and executions.

4. **Add environment validation:** Create a `src/lib/env.ts` that validates all required env vars at import time using Zod. Import it in server startup paths.

5. **Add API route integration tests:** The API layer has zero test coverage. Add tests that mock Supabase and verify request validation, auth checks, and response shapes.

6. **Consider using the Anthropic SDK:** The debrief route makes raw `fetch()` calls to the Claude API. The `@anthropic-ai/sdk` package handles retries, streaming, error parsing, and type safety.
