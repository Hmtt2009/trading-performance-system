# PHASE PLAN
## MVP → Phase 2 → Phase 3

---

## PHASE 1: MVP — "Trustable Core"

### Goal
Prove that a trader will:
1. Upload a file
2. See a behavioral insight they didn't know
3. Come back and upload again
4. Pay for the full analysis

### Target User
- U.S. stock traders ONLY (no options)
- IBKR ONLY (single broker, single format)
- Discretionary day/swing traders

### What Gets Built

**Ingestion:**
- IBKR CSV parser (one specific format)
- File upload (drag & drop)
- Trade grouping (executions → logical trades)
- Duplicate detection
- Data validation + clear errors

**Analysis Engine (Deterministic):**
- P&L calculations (per trade, per day, per period)
- Baseline computation (trader's own averages: frequency, size, hold time, timing)
- 4 behavioral patterns:
  1. Overtrading (high confidence)
  2. Size escalation after losses (high confidence)
  3. Rapid re-entry after loss / possible revenge (medium confidence)
  4. Premature profit taking (medium confidence)
- Dollar impact per pattern instance
- "Cost of Behavior" calculation
- Edge Scorecard by: time of day, hold time bucket, day of week, ticker/sector
- Session timeline reconstruction

**AI Layer:**
- Daily session debrief (Claude API)
- AI receives structured JSON facts → outputs coaching narrative
- References specific trades with correct data

**Frontend:**
- Dashboard (P&L, equity curve, pattern cards, calendar heatmap)
- Trade list with behavioral flags
- Session timeline view
- "Cost of Behavior" view with simulation equity curve
- Edge Scorecard with "Do More / Do Less"
- Individual trade detail (expandable)
- Responsive for mobile (read-only optimized)

**Business:**
- Landing page
- Auth (email + Google SSO)
- Free anonymous upload → limited report
- Free account → basic dashboard
- Paid tier → full analysis + AI debriefs
- Stripe billing
- 14-day free trial

### What Does NOT Get Built in MVP
- Options support
- Multiple brokers (Schwab, Webull — add only if demand)
- Chart analysis (support/resistance, entry/exit quality on chart)
- News context per trade
- Market context (VIX, SPY, macro calendar)
- Premium tier
- AI coaching conversations
- Psychological profiling
- Advanced pattern detection (FOMO, stop violation, averaging down)
- Intraday chart display
- Trade replay
- Social/sharing features
- Native mobile app
- Manual trade entry
- Pre-session check-in
- Multi-account support
- PDF/export reports

### Success Criteria for MVP
- 50+ traders upload files
- >40% return for second upload within 7 days
- >10% convert from free to paid
- Behavioral patterns have <20% false positive rate (based on user dismiss data)
- AI debrief rated useful by >70% of readers

---

## PHASE 2: "Context & Breadth"

### Goal
Add external context (charts, news, market) and expand market coverage.

### Unlocked by
- MVP validated (retention + conversion targets met)
- Revenue covering infrastructure costs

### Features

**Options Support:**
- Parse IBKR options trades
- Single-leg long calls/puts only (no spreads/Greeks initially)
- Treat as directional trades on underlying
- Options-specific patterns (theta decay impact, expiry-related mistakes)

**Additional Brokers:**
- Schwab/TDA CSV parser
- Webull CSV parser
- Auto-detect broker format

**Market Context:**
- Daily SPY, QQQ, VIX data overlay
- Macro calendar (FOMC, CPI, earnings dates)
- Market regime tagging per day (trending/choppy/volatile)
- "Your win rate on FOMC days: 28% vs. overall 47%"

**Chart Context (Basic):**
- Daily chart data for traded stocks
- Entry/exit plotted on daily chart
- Simple technical markers: 20/50/200 EMA, recent high/low
- Distance to recent high/low at entry
- Relative volume
- NO complex pattern recognition (breakout/pullback/reversal)

**News Context (Basic):**
- Per-stock news on trade date (major catalysts only)
- Earnings, analyst actions, major company news
- Categorize: news-driven move vs. technical move
- Use for context, not as primary analysis driver

**Additional Patterns:**
- FOMO entry (entry after significant move)
- Stop loss violation (with chart context)
- Position sizing errors (separate from tilt)

**Enhanced AI:**
- Weekly and monthly AI summary reports
- Trend analysis: "Your revenge trading decreased 40% this month"
- "Best Days vs. Worst Days" behavioral comparison

**Account:**
- Multiple broker accounts per user
- Data export (CSV, PDF reports)

**Business:**
- Premium tier (AI conversations, advanced profiling)
- Shareable insights (anonymized, for virality)
- Referral system

---

## PHASE 3: "Intelligence & Scale"

### Goal
Deep intelligence layer, real-time capabilities, B2B opportunity.

### Features

**Advanced Chart Analysis:**
- Support/resistance detection
- Entry/exit quality scoring relative to technical levels
- Chart pattern recognition (breakout, pullback, reversal)
- Intraday chart analysis for day trades
- Volume profile context

**Advanced Options:**
- Multi-leg strategies (spreads, strangles, iron condors)
- Greeks context (IV rank, theta decay, delta exposure)
- Strategy identification and optimization

**Real-Time Capabilities:**
- IBKR API direct sync (live trade capture)
- Intra-session alerts ("You've taken 3 unplanned trades in 40 minutes")
- Real-time behavioral monitoring

**Advanced AI:**
- AI coaching conversations (ask follow-up questions)
- Longitudinal psychological profiling
- Personalized improvement programs
- Custom pattern creation by user

**B2B Opportunity:**
- Prop firm integration (behavioral scoring for funded traders)
- White-label for trading educators
- API access for third-party tools

**Platform:**
- Native mobile app
- Desktop notifications
- Slack/Telegram debrief delivery
- Community features (optional)

---

## PHASE GATES

| Gate | Criteria to Pass | Opens |
|------|-----------------|-------|
| MVP → Phase 2 | 50+ active users, >40% weekly retention, >10% paid conversion | Context & Breadth features |
| Phase 2 → Phase 3 | $5K+ MRR, <8% monthly churn, validated demand for advanced features | Intelligence & Scale |

---

## SCOPE CHANGE PROCESS

1. New feature idea → add to "Ideas Backlog" in DECISIONS_LOG.md
2. Evaluate: Does it belong in current phase? Does it conflict with anything?
3. If it belongs in current phase AND is critical → update this document with justification
4. If it doesn't → add to appropriate future phase
5. NEVER add to current sprint without updating this document first