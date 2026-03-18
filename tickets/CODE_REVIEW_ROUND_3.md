# Code Review Report — Round 3

## Date: 2026-03-18
## Project: Flinch — AI-Powered Trading Performance System
## Tech Stack: Next.js 16, TypeScript, Tailwind CSS, Supabase, Claude API

### Executive Summary
- Overall quality score: 8.0/10
- Total issues found: 14
- Critical: 0 | High: 6 | Medium: 5 | Low: 3
- Test coverage: 305 tests across 13 files — parsers, analysis, AI all well-covered; API routes and components untested
- The codebase is architecturally sound with strong separation of concerns. Issues are primarily defensive coding gaps, not logic bugs.

### High Priority Issues

**H1. Webhook handler missing membership data validation**
- **File:** `src/app/api/webhooks/whop/route.ts`
- **Lines:** 28-50, 80-105
- **Issue:** Membership object properties accessed without null/structure checks. If Whop sends malformed data, the handler could fail silently or process incorrect data.
- **Impact:** Silent data corruption or unhandled errors on webhook events
- **Fix:** Add validation for membership structure and whopUserId before processing

**H2. Unsafe metadata casting in webhook handler**
- **File:** `src/app/api/webhooks/whop/route.ts`
- **Lines:** 34-38
- **Issue:** `metadata` cast as `Record<string, unknown>` without validating `supabase_user_id` is a valid UUID
- **Impact:** Could write invalid user IDs to database
- **Fix:** Validate UUID format before using supabase_user_id

**H3. AuthGuard race condition on unmount**
- **File:** `src/components/auth/AuthGuard.tsx`
- **Lines:** 12-29
- **Issue:** State updates on unmounted component if auth check completes after navigation away
- **Impact:** React warnings, potential memory leaks
- **Fix:** Add `isMounted` flag with cleanup in useEffect

**H4. NavHeader logout missing error handling**
- **File:** `src/components/NavHeader.tsx`
- **Lines:** 59-64
- **Issue:** `handleLogout` is async but has no try-catch. If Supabase signOut fails, promise rejects unhandled.
- **Impact:** Unhandled promise rejection, user stuck on page
- **Fix:** Wrap in try-catch, redirect regardless

**H5. checkSubscription casts database values without validation**
- **File:** `src/lib/auth/checkSubscription.ts`
- **Lines:** 22-23
- **Issue:** Database subscription_tier/status cast directly to TypeScript union types without checking valid values
- **Impact:** Invalid tier could bypass feature gating
- **Fix:** Validate against allowed values, default to 'free' if invalid

**H6. Pattern dismiss endpoint missing UUID validation**
- **File:** `src/app/api/analysis/patterns/[id]/route.ts`
- **Line:** 10
- **Issue:** Pattern ID from URL used directly in query without UUID format validation
- **Impact:** Malformed IDs cause unnecessary DB queries
- **Fix:** Validate UUID format before querying

### Medium Priority Issues

**M1. No timeout on Claude API call in debrief route**
- **File:** `src/app/api/ai/debrief/[date]/route.ts`, Line 90
- **Issue:** No AbortController timeout on the fetch to Claude API

**M2. Debrief generation race condition**
- **File:** `src/app/api/ai/debrief/[date]/route.ts`, Lines 49-68
- **Issue:** Two concurrent requests could both pass rate limit check and call Claude API

**M3. Sessions endpoint missing error check on Supabase response**
- **File:** `src/app/api/sessions/route.ts`, Lines 16-21
- **Issue:** Error variable captured but not checked before using data

**M4. Inconsistent pagination across list endpoints**
- **File:** `src/app/api/trades/route.ts` vs `src/app/api/sessions/route.ts`
- **Issue:** Trades uses page-based with total count, Sessions uses offset-based without count

**M5. Silent error swallowing in multiple components**
- **Files:** TickerTape.tsx, FileUpload.tsx, PatternCard.tsx
- **Issue:** Empty catch blocks hide errors

### Low Priority Issues

**L1. Dead code: `src/app/_new_page.tsx`**
- Unused template file

**L2. Magic numbers in pattern detection thresholds**
- **File:** `src/lib/analysis/patterns.ts`, Lines 202, 276

**L3. Missing accessible labels on SVG icons**
- **File:** login/signup pages - Google logo SVGs lack aria-label

### Test Coverage Report

| Module | Tested | Status |
|--------|--------|--------|
| IBKR Parser | 27 tests | Comprehensive |
| Schwab Parser | ~20 tests | Good |
| TD Ameritrade Parser | ~20 tests | Good |
| Webull Parser | ~20 tests | Good |
| Broker Detection | ~15 tests | Good |
| Baseline Computation | Part of 35 tests | Good |
| Pattern Detection (4 types) | Part of 35 tests | Good |
| Session Analysis | Part of 35 tests | Good |
| Scorecard | Part of 35 tests | Good |
| AI Debrief | 23 tests | Good |
| Post-Exit Price | ~10 tests | Adequate |
| Nullable Number | ~10 tests | Adequate |
| Check Subscription | ~10 tests | Adequate |
| API Routes (15) | 0 tests | **Not tested** |
| React Components (14) | 0 tests | **Not tested** |
| Auth Flows | 0 tests | **Not tested** |
