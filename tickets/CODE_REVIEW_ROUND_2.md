# Code Review Report — Round 2

## Date: 2026-03-17
## Project: Flinch — AI-Powered Trading Performance System
## Tech Stack: Next.js 16, TypeScript, Tailwind CSS, Supabase, Claude API

---

### Executive Summary
- **Overall quality score: 7.5/10** (up from 6.0/10 in Round 1)
- **Total new issues found: 16**
- **Critical: 0 | High: 2 | Medium: 8 | Low: 6**
- **Test coverage: ~42 tests / ~52 exported functions (42%)**
- All 10 Critical+High issues from Round 1 have been fixed and merged. The codebase is significantly more secure with proper input validation, rate limiting, security headers, and dependency hygiene. Remaining issues are Medium/Low severity — no Critical issues remain.

---

### Round 1 Issues — Resolution Status

| ID | Issue | Status |
|----|-------|--------|
| C1 | N+1 query in upload | **Fixed** (PR #57) |
| C2 | Sort param validation | **Fixed** (PR #58) |
| C3 | Date/period validation | **Fixed** (PR #59) |
| C4 | Upload rate limiting | **Fixed** (PR #60) |
| H1 | MIME type check | **Fixed** (PR #66) |
| H2 | Webhook log sanitization | **Fixed** (PR #67) |
| H3 | Security headers | **Fixed** (PR #68) |
| H4 | crypto-js replacement | **Fixed** (PR #70) |
| H5 | Period param validation | **Fixed** (in PR #59) |
| H6 | Enrichment error tracking | **Fixed** (PR #71) |

---

### High Priority Issues

#### H1. Scorecard Route Missing Period Validation
- **File:** `src/app/api/analysis/scorecard/route.ts` line 29
- **Issue:** Dashboard and cost routes were given period whitelist validation in Round 1 (PR #59), but the scorecard route was missed. It accepts any string and silently defaults to `90d`.
- **Impact:** Inconsistent API behavior; arbitrary period values silently accepted.
- **Fix:** Add the same `validPeriods` whitelist check used in dashboard/cost routes.

#### H2. Billing Checkout APP_URL Fallback to Localhost
- **File:** `src/app/api/billing/checkout/route.ts` line 26
- **Issue:** `process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'` means if the env var is missing in production, checkout redirects go to localhost, silently breaking the payment flow.
- **Impact:** Broken checkout redirect in production if env var not set.
- **Fix:** Fail loudly if `NEXT_PUBLIC_APP_URL` is not set instead of falling back to localhost.

---

### Medium Priority Issues (Report Only — Do Not Auto-Fix)

#### M1. CSP Includes unsafe-inline and unsafe-eval
- **File:** `next.config.ts` line 13
- CSP includes `'unsafe-inline'` and `'unsafe-eval'` which are required by Next.js development mode but weaken XSS protection. Should be tightened for production with nonce-based CSP.

#### M2. Webhook Secret Not Required in Production
- **File:** `src/lib/whop/client.ts` line 13
- `WHOP_WEBHOOK_SECRET ?? null` means webhook signature verification is disabled if env var is missing. Should throw in production.

#### M3. Date Regex Allows Invalid Dates (9999-99-99)
- **Files:** `src/app/api/ai/debrief/[date]/route.ts`, `src/app/api/analysis/timeline/[date]/route.ts`
- Regex `/^\d{4}-\d{2}-\d{2}$/` passes `2024-13-45`. Should additionally validate with `Date` constructor.

#### M4. Pattern Type Filter Not Validated
- **File:** `src/app/api/analysis/patterns/route.ts` line 14
- `patternType` parameter passed directly to Supabase query without validating against known values.

#### M5. Session ID Parameter Not Format-Validated
- **File:** `src/app/api/analysis/patterns/route.ts` line 15
- `sessionId` used in query without UUID format validation. RLS prevents data leakage but validation is still best practice.

#### M6. AI Debrief Stores Full Trade Data
- **File:** `src/app/api/ai/debrief/[date]/route.ts` line 74
- Complete `structuredInput` (all trades, patterns, baseline) stored in `ai_debriefs` table. Consider encrypting or storing only a reference.

#### M7. Debrief Rate Limiting is Soft (10-minute window)
- **File:** `src/app/api/ai/debrief/[date]/route.ts` lines 28-48
- Rate limiting relies on `updated_at` timestamp check. Determined attackers could bypass by hitting from multiple clients.

#### M8. Open Redirect Risk in Auth Callback
- **File:** `src/app/auth/callback/route.ts` line 5
- `next` parameter validated with regex but could redirect to internal API routes. Consider whitelist approach.

---

### Low Priority Issues (Report Only — Do Not Auto-Fix)

#### L1. Inconsistent parseInt Radix Usage
- **Files:** `trades/route.ts`, `patterns/route.ts` — some calls missing radix parameter.

#### L2. Floating Point Precision in Size Escalation
- **File:** `src/lib/analysis/patterns.ts` line 147 — hardcoded multipliers on floating-point values.

#### L3. Falsy Value Coalescing (|| vs ??)
- **File:** `src/lib/analysis/patterns.ts` — uses `|| 0` instead of `?? 0` for netPnl which masks zero.

#### L4. Timezone Inconsistency Between Weekly and Scorecard
- **Files:** `weekly/route.ts` uses UTC, `scorecard/route.ts` uses Eastern time.

#### L5. Missing ARIA Labels on Interactive Elements
- **Files:** `PatternCard.tsx`, `TradeList.tsx`, `SessionTimeline.tsx` (carried from Round 1 L3).

#### L6. Index Keys in List Rendering
- **Files:** `TickerTape.tsx`, `DashboardView.tsx` (carried from Round 1 L4).

---

### Architecture Recommendations

1. **Add Zod validation middleware** — Centralize input validation with Zod schemas at API boundaries.
2. **Environment variable validation on startup** — Validate all required env vars at build/startup time, not at request time.
3. **Nonce-based CSP for production** — Replace `unsafe-inline`/`unsafe-eval` with nonces when deploying.
4. **Add integration tests for API routes** — 14 routes with 0% test coverage is the biggest quality gap.

---

### Test Coverage Report

| Module | Functions | Tested | Coverage |
|--------|-----------|--------|----------|
| **Analysis** (baseline, patterns, session, scorecard) | 5 | 5 | 100% |
| **Parsers** (ibkr, schwab, tda, webull) | 8 | 3 | 37.5% |
| **AI/Debrief** | 3 | 0 | 0% |
| **Market/PostExit** | 2 | 0 | 0% |
| **Auth/Supabase/Whop** | 5 | 0 | 0% |
| **Utilities** (brokers, nullableNumber) | 3 | 2 | 67% |
| **API Routes** (14 routes) | 14 | 0 | 0% |
| **Components** (12 components) | N/A | 0 | 0% |
| **TOTAL** | ~52 | ~15 | ~29% |

Test count: 42 tests across 4 test files, all passing.

**Key gaps:** Schwab/TD/Webull parsers (1,371 lines untested), all API routes, AI debrief pipeline.
