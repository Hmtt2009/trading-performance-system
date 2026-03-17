# Code Review Report — Round 1

## Date: 2026-03-17
## Project: Flinch — AI-Powered Trading Performance System
## Tech Stack: Next.js 16, TypeScript, Tailwind CSS, Supabase, Claude API

---

### Executive Summary
- **Overall quality score: 6.0/10**
- **Total issues found: 22**
- **Critical: 4 | High: 6 | Medium: 8 | Low: 4**
- **Test coverage: ~36 functions tested / ~101 total functions (36%)**
- The core parsing and analysis logic is solid with good test coverage. The main gaps are in API route input validation, rate limiting, security headers, and missing tests for API routes, auth flows, and webhook handlers.

---

### Critical Issues (Must Fix)

#### C1. N+1 Query in Upload Route — Execution Inserts
- **File:** `src/app/api/upload/route.ts` lines 167-223
- **Issue:** Each trade's executions are inserted one-by-one in a nested loop. For 100 trades with 2 executions each = 300 individual DB calls.
- **Impact:** Upload timeout and DB connection exhaustion under real-world load.
- **Fix:** Collect all executions into an array and batch insert with a single `supabase.from('trade_executions').insert(allExecutions)`.

#### C2. Missing Input Validation on Sort Parameters
- **File:** `src/app/api/trades/route.ts` line 18
- **Issue:** `sortBy` from query params is used before whitelist validation on line 30. If Supabase SDK doesn't sanitize, this is a SQL injection vector.
- **Impact:** Potential SQL injection or query manipulation.
- **Fix:** Validate `sortBy` against whitelist BEFORE any use. Return 400 for invalid values.

#### C3. Missing Date Validation on Multiple API Routes
- **Files:** `src/app/api/analysis/cost/route.ts` line 10, `src/app/api/analysis/dashboard/route.ts` line 14, `src/app/api/trades/route.ts` lines 15-16
- **Issue:** Date parameters accepted from URL without format validation. Only `timeline/[date]` and `debrief/[date]` validate with regex.
- **Impact:** Invalid dates could cause query errors, edge-case bugs, or unexpected behavior.
- **Fix:** Add `YYYY-MM-DD` regex check on all date parameters. Validate with `Date` constructor.

#### C4. No Rate Limiting on Upload Endpoint
- **File:** `src/app/api/upload/route.ts` line 11
- **Issue:** No rate limit. Each upload triggers CSV parsing, baseline recomputation, pattern detection, and potentially AI calls. A malicious user could DoS the server.
- **Impact:** Denial of service, excessive Supabase/Claude API costs.
- **Fix:** Add rate limiting — max 10 uploads per hour per user. Check recent upload count before processing.

---

### High Priority Issues

#### H1. Missing MIME Type Check on File Upload
- **File:** `src/app/api/upload/route.ts` line 31
- **Issue:** Only checks file extension (`.csv`). A file named `malware.exe.csv` would pass.
- **Impact:** Potential for unexpected file content processing.
- **Fix:** Also validate `file.type` against `text/csv` and `text/plain`.

#### H2. Webhook Error Logs Expose User IDs
- **File:** `src/app/api/webhooks/whop/route.ts` line 64-70
- **Issue:** Error logs include `whopUserId`, `supabaseUserId`, and `membershipId`. If logs are accessible via error tracking, attackers can enumerate valid users.
- **Impact:** User enumeration attack vector.
- **Fix:** Log only a hash or partial ID. Remove full user identifiers from error messages.

#### H3. Missing Security Headers (CSP, HSTS)
- **File:** `next.config.ts`
- **Issue:** Has `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, but missing `Strict-Transport-Security`, `Content-Security-Policy`, and `Permissions-Policy`.
- **Impact:** Reduced protection against XSS, clickjacking, and downgrade attacks.
- **Fix:** Add HSTS, basic CSP, and Permissions-Policy headers.

#### H4. crypto-js Should Be Replaced with Node.js crypto
- **File:** `src/lib/parsers/ibkr-parser.ts`, `schwab.ts`, `tdameritrade.ts`, `webull.ts`
- **Issue:** `crypto-js` is a deprecated client-side library. Server-side code should use Node.js built-in `crypto` module which is faster and maintained.
- **Impact:** Supply chain risk from unmaintained dependency. Performance penalty.
- **Fix:** Replace `CryptoJS.SHA256(data).toString()` with `crypto.createHash('sha256').update(data).digest('hex')`.

#### H5. Period Parameter Not Validated on Dashboard/Cost Routes
- **File:** `src/app/api/analysis/dashboard/route.ts` line 14, `src/app/api/analysis/cost/route.ts` line 10
- **Issue:** `period` parameter accepts arbitrary strings. Should be validated against whitelist `['7d', '30d', '90d', 'all']`.
- **Impact:** Unexpected behavior or silent errors with invalid periods.
- **Fix:** Add explicit whitelist validation. Return 400 for invalid values.

#### H6. Silent Error Swallowing in Upload Enrichment
- **File:** `src/app/api/upload/route.ts` lines 361-382
- **Issue:** Post-exit enrichment errors are caught and logged but not reported to the user. Upload appears successful even when enrichment completely fails.
- **Impact:** Users don't know if pattern/enrichment data is incomplete.
- **Fix:** Track enrichment failure count and include in response: `enrichmentErrors: count`.

---

### Medium Priority Issues (Report Only — Do Not Auto-Fix)

#### M1. No Error Boundary in App Layout
- **File:** `src/app/layout.tsx`
- No React error boundary wraps the app. Component crashes show blank page.

#### M2. DebriefView Renders AI Text Without Sanitization
- **File:** `src/components/debrief/DebriefView.tsx` line 166
- String manipulation on AI-generated text (replace, slice). Not currently exploitable since Claude output is controlled, but should use a markdown renderer.

#### M3. Inconsistent Error Handling Across Parsers
- **Files:** All 4 parser files
- Some rows silently `continue`, others push to `errors` array. No consistent strategy.

#### M4. Console.warn in Production Code
- **Files:** `schwab.ts`, `tdameritrade.ts`, `webull.ts` (matchRoundTrip functions)
- Edge case warnings go to console. Should use structured logging or suppress.

#### M5. No Duplicate File Upload Detection
- **File:** `src/app/api/upload/route.ts`
- Same file can be uploaded multiple times. Should check file hash against recent uploads.

#### M6. Hardcoded Eastern Timezone in Scorecard
- **File:** `src/app/api/analysis/scorecard/route.ts` lines 57-66
- Hardcoded `America/New_York`. Global traders get wrong hour-of-day analysis.

#### M7. Missing Webhook Idempotency Check
- **File:** `src/app/api/webhooks/whop/route.ts`
- Same webhook event processed multiple times causes duplicate DB updates.

#### M8. AI Debrief Date Validation Too Loose
- **File:** `src/app/api/ai/debrief/[date]/route.ts` line 10
- Regex allows `9999-99-99`. Should also validate with `Date` constructor.

---

### Low Priority Issues (Report Only — Do Not Auto-Fix)

#### L1. Unused `InsightSection` Component Not Memoized
- **File:** `src/components/scorecard/ScorecardView.tsx`

#### L2. Magic Numbers Without Constants
- **File:** `src/lib/analysis/patterns.ts` — thresholds like 1.5, 0.4, 3

#### L3. Missing ARIA Labels on Interactive Elements
- **Files:** `PatternCard.tsx`, `TradeList.tsx`, `SessionTimeline.tsx`

#### L4. Index Keys in List Rendering
- **Files:** `TickerTape.tsx`, `DashboardView.tsx`

---

### Architecture Recommendations

1. **Add a validation middleware layer** — Use Zod schemas to validate all API route inputs at the boundary. Currently, validation is ad-hoc per route.
2. **Move to batch DB operations** — Beyond the upload N+1, consider batch patterns for baseline/session/pattern updates.
3. **Add structured logging** — Replace `console.error`/`console.warn` with a logging utility that includes context (user_id, route, timestamp).
4. **Add rate limiting middleware** — Centralized rate limiter in middleware.ts rather than per-route.

---

### Test Coverage Report

| Module | Functions | Tested | Coverage |
|--------|-----------|--------|----------|
| **Parsers** (ibkr, schwab, tda, webull) | ~48 | 21 | 44% |
| **Analysis** (baseline, patterns, session, scorecard) | ~20 | 15 | 75% |
| **API Routes** (14 routes) | 18 | 0 | 0% |
| **Auth/Middleware** | 3 | 0 | 0% |
| **AI/Debrief** | 2 | 0 | 0% |
| **Market/PostExit** | 2 | 0 | 0% |
| **Utilities** (brokers, nullableNumber) | 5 | 6 | 100% |
| **Components** (13 components) | N/A | 0 | 0% |
| **TOTAL** | ~101 | 42 | ~42% |

**Missing test fixtures:** `tickets/U21711012_20260330_20260403.csv` and `tickets/U21711012_20260406_20260410.csv` referenced in pipeline but not on disk.
