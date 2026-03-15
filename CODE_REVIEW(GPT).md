# Code Review Report

## Date
2026-03-15

## Project Name
Trading Performance System

## Tech Stack
- Frontend: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Recharts
- Backend: Next.js route handlers, Supabase Auth/Postgres/RLS
- Analysis: Custom parser and rule-based trade analysis engine
- AI: Anthropic Claude API integration
- Tooling: Vitest, ESLint, TypeScript

### Executive Summary
- Overall quality score (1-10): 5.5/10
- Total issues found: 12
- Brief summary: The project has a solid architectural foundation and a clear analysis model, but several user-facing flows are still inconsistent or broken. The highest-risk issues are a failing IBKR Activity Statement parser, a broken session timeline contract, a public upload flow that the backend rejects, incorrect broker attribution for non-IBKR uploads, and zero-PnL trades being dropped from analytics. Verification found `tsc --noEmit` passing, `npm run lint` failing, and 1 failing test out of 30.

### Critical Issues (Must Fix)

#### C1. IBKR Activity Statement parsing drops the symbol column and fails one of the supported upload formats
- File path: `src/lib/parsers/ibkr-parser.ts`
- Line number: 153-156
- Description: `preprocessActivityStatement()` always strips three leading columns with `cells.slice(3)`, but the supported Activity Statement shape in the test fixture only has two section-prefix columns before the real trade data. That removes the `Symbol` column from both header and data rows, causing parsing to fail. This is confirmed by the failing test at `src/__tests__/ibkr-parser.test.ts:87-95`.
- Suggested fix: Detect whether the row has a two-column or three-column section prefix before slicing, preserve the actual trade headers, and keep the regression test green.

#### C2. Timeline tab expects a `timeline` payload that the API never returns
- File path: `src/app/api/analysis/timeline/[date]/route.ts`
- Line number: 13-18
- Description: The API returns `{ trades, patterns, session, date }`, but `src/components/timeline/SessionTimeline.tsx:13-24` and `src/components/timeline/SessionTimeline.tsx:94-106` require a `timeline` array with cumulative P&L entries. Once data loads, the component reads `data.timeline.length`, so the current response shape breaks the feature.
- Suggested fix: Return a fully built `timeline` array from the API, including cumulative P&L and attached patterns per trade, or change the component to derive that structure from the raw response before render.

### High Priority Issues

#### H1. Anonymous upload is advertised and routed publicly, but the upload API always requires auth
- File path: `src/app/api/upload/route.ts`
- Line number: 14-17
- Description: The landing page promises "Upload Free - No Account Needed" at `src/app/page.tsx:96-101`, and middleware exposes `/upload` publicly at `src/middleware.ts:4`, but the upload endpoint immediately returns 401 for unauthenticated visitors. This makes the top-of-funnel CTA fail at the moment of submission.
- Suggested fix: Either implement a real anonymous upload pipeline end-to-end or, more safely, protect `/upload` and update the public copy so the product promise matches runtime behavior.

#### H2. All uploads are stored under `ibkr`, and TD Ameritrade is not allowed by the schema
- File path: `src/app/api/upload/route.ts`
- Line number: 110-126
- Description: The upload route always looks up and creates broker accounts with `broker_name = 'ibkr'`, even though `parseTradeCSV()` supports Schwab, TD Ameritrade, and Webull. On top of that, `supabase/migrations/00001_initial_schema.sql:52-58` only allows `('ibkr', 'schwab', 'webull')`, so TD Ameritrade cannot be represented correctly in the database at all.
- Suggested fix: Map the detected parser format to the correct broker name before lookup/insert and add a migration that expands the broker check constraint to include `tdameritrade`.

#### H3. Break-even trades are converted to null and disappear from downstream analytics
- File path: `src/app/api/upload/route.ts`
- Line number: 241-247
- Description: When existing trades are rehydrated for baseline/session analysis, fields like `gross_pnl`, `net_pnl`, and `pnl_percent` are converted with truthiness checks. A real value of `0` becomes `null`, so break-even trades are treated like incomplete trades and are dropped from session counts, baseline calculations, and win-rate math.
- Suggested fix: Replace truthy checks with explicit null checks before calling `Number(...)`.

### Medium Priority Issues

#### M1. Pattern list route does not validate `limit`, so invalid values can break the query
- File path: `src/app/api/analysis/patterns/route.ts`
- Line number: 12-16
- Description: `Math.min(parseInt(searchParams.get('limit') || '50'), 100)` produces `NaN` for inputs like `?limit=abc`. That value is then passed into `.limit(limit)`, which can fail the route unexpectedly.
- Suggested fix: Parse with a radix, guard against `NaN`, and clamp the result just like the trades and sessions routes already do.

#### M2. Several analytics routes ignore Supabase query errors and can silently return misleading empty data
- File path: `src/app/api/analysis/dashboard/route.ts`
- Line number: 26-44
- Description: Dashboard, cost, weekly, timeline, and debrief routes read `data` from Supabase without checking the corresponding `error` object. If one of those queries fails, the app can render zeroes or partial payloads instead of surfacing a server error, which makes outages look like "no data."
- Suggested fix: Check every Supabase result consistently and return a 5xx with a useful error message whenever a required query fails.

#### M3. Non-IBKR parsers do not preserve unmatched remainder positions during partial exits
- File path: `src/lib/parsers/schwab.ts`
- Line number: 278-319
- Description: Unlike the IBKR parser, the Schwab, TD Ameritrade, and Webull parsers stop after creating a single matched trade and do not emit a separate open-position record for any remaining unmatched quantity. Partial exits on those brokers therefore lose open-position context.
- Suggested fix: Extract the trade-matching logic into a shared helper and reuse the IBKR-style remainder handling across all broker parsers.

#### M4. Scorecard recommendations are generated without a minimum sample threshold
- File path: `src/components/scorecard/ScorecardView.tsx`
- Line number: 97-119
- Description: `computeInsights()` ranks strengths and leaks across all buckets regardless of sample size. One or two lucky trades can therefore become "Do More," and one bad trade can become "Do Less."
- Suggested fix: Require a minimum number of trades per bucket before including it in strengths, leaks, or recommendation text.

### Low Priority Issues

#### L1. README is still the default Next.js template instead of project documentation
- File path: `README.md`
- Line number: 1-28
- Description: The repository README does not explain the actual product, required environment variables, supported brokers, or how to run the analysis stack.
- Suggested fix: Replace the scaffolded README with setup, architecture, and troubleshooting notes specific to this project.

#### L2. Service-role admin client exists but is unused
- File path: `src/lib/supabase/admin.ts`
- Line number: 1-13
- Description: The project defines a privileged Supabase client but nothing imports it. Unused security-sensitive helpers increase maintenance risk and create confusion about the intended data-access path.
- Suggested fix: Remove it until there is a real server-only use case, or document where it is expected to be used.

#### L3. Lint is currently red on avoidable issues
- File path: `src/components/TickerTape.tsx`
- Line number: 38
- Description: `npm run lint` currently fails because of a synchronous setState-in-effect warning in `TickerTape`, `prefer-const` errors in `src/lib/parsers/schwab.ts:180`, and unused variables in `src/app/signup/page.tsx:9` and `src/lib/parsers/tdameritrade.ts:45`. These are not the most urgent product bugs, but they keep the baseline quality gate from passing.
- Suggested fix: Clean up the unused values, address the effect pattern in `TickerTape`, and keep lint green as part of future changes.

### Architecture Recommendations
- Unify broker parser trade-matching logic so all supported brokers handle scaling, partial exits, hashing, and open positions the same way.
- Define shared request/response contracts for route handlers and client components to prevent API/UI drift like the timeline bug.
- Normalize imported timestamps into an explicit trading timezone before grouping sessions or bucketing scorecard data.
- Decide whether anonymous upload is a real product requirement and align middleware, UI copy, schema, and backend behavior around that decision.
- Add integration tests for the upload, timeline, and AI debrief routes so route-level regressions are caught before release.
