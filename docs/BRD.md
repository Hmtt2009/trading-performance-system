# BUSINESS REQUIREMENTS DOCUMENT (BRD)
## AI-Powered Trading Performance System
### Version: 2.0 | March 2026

---

## 1. PRODUCT VISION

**One sentence:**
A system that takes a single file from a trader and returns the brutal, beautiful truth about their trading behavior — what patterns are costing them money, and what to change.

**What the product does (3 things):**
1. Discovers behavioral patterns automatically from trade data — no self-reporting required.
2. Evaluates decision quality independently of P&L outcome using a transparent framework.
3. Quantifies the dollar cost of each behavioral pattern ("Your revenge trades cost you $3,847 this quarter").

**What the product does NOT claim:**
- It does not read the trader's mind.
- It does not guarantee the patterns it finds are the only explanation.
- It discovers *likely patterns* and presents them with confidence levels, not certainties.

---

## 2. THE PROBLEM

### Surface Problem
Retail traders lose money consistently and don't understand why. They have charts, scanners, and courses — but nothing that shows them their own behavioral patterns.

### Deeper Problem
After a loss, cortisol spikes. The brain enters threat mode. The trader takes an unplanned "revenge" trade. This trade has worse outcomes. But the emotional state that caused it blocks the self-awareness to recognize the pattern. This is a neurological feedback loop that requires an external system to break.

### Why Existing Tools Fail
- **TradeZella, TraderVue, TraderSync:** Require manual journaling. The "lazy trader" quits within 3 weeks.
- **All existing tools** measure outcomes (P&L, win rate) not process (decision quality, behavior).
- **None** automatically detect behavioral patterns from data alone.
- **None** quantify the dollar cost of specific behavioral mistakes.

### The Gap
Existing tools: "Here's what happened to your money."
This product: "Here's what you keep doing to yourself, here's what it's costing you, and here's what to change."

---

## 3. TARGET USER

### Primary Persona: "The Lazy Trader"

**Who they are:**
- Trades U.S. stocks (equities)
- Account size: $5,000–$200,000
- Experience: 6 months to 5 years
- Uses IBKR (primary), Schwab/TDA, or Webull
- Mix of day trading and swing trading
- Takes 3–30 trades per week

**Psychology:**
- Knows they have behavioral problems
- Not disciplined enough for daily journaling
- Has tried a journal/spreadsheet and quit
- Wants the tool to do all the work

**What they want:**
"Show me what I'm doing wrong. Don't make me do any work. Just tell me."

**Common mistakes they repeat:**
- Enter trades without a plan
- Revenge trade after losses
- Close winners too early
- Increase size after consecutive losses
- Overtrade in choppy markets

### V1 Exclusions (NOT targeting yet)
- Options traders (Phase 2)
- Prop firm traders (Phase 2)
- Algorithmic/automated traders
- Buy-and-hold investors
- Traders seeking signals or trade ideas

---

## 4. PRODUCT PRINCIPLES

1. **Zero required effort, optional lightweight feedback.** Upload a file. That's it. But optionally allow: "Was this flag correct?" or "Dismiss this pattern."
2. **Truth over comfort.** If a winning trade was a bad decision, say so.
3. **Beautiful simplicity.** Complex engine, clean surface. Understand your biggest problem in 5 seconds.
4. **The "aha moment" is the product.** The moment a trader sees a pattern they didn't know they had.
5. **Confidence levels, not certainty.** "Likely revenge trade (high confidence)" not "You revenge traded."
6. **Context is everything.** A trade exists in the context of what came before it, what time it happened, and market conditions.
7. **Build for the lazy, impress the serious.**

---

## 5. ANALYTICAL FRAMEWORK

### 5.1 Decision Quality Model

Every trade is assessed on dimensions that can be reliably inferred from data:

**High-Confidence Signals (deterministic):**
- Position sizing relative to account and recent trades
- Hold time consistency with trader's own baseline
- Trade frequency relative to trader's normal pace
- Sequence position (trade after loss? after consecutive losses?)
- Time of day relative to trader's historical performance
- Same-ticker churn (multiple entries/exits same stock same session)

**Medium-Confidence Signals (heuristic):**
- Entry timing relative to the stock's recent move (possible chasing)
- Exit timing relative to subsequent price movement (possible premature exit)
- Size escalation after losses (possible tilt)
- Rapid re-entry after loss (possible revenge trade)

**Low-Confidence Signals (interpretive — Phase 2+):**
- Entry quality relative to support/resistance (requires chart analysis)
- Fear-based vs. strategic exit (requires intraday context)
- Thesis quality inference

**Important:** The system clearly labels which confidence tier each insight comes from.

### 5.2 Behavioral Pattern Taxonomy (MVP: 4 Patterns)

**PATTERN 1: OVERTRADING**
- Definition: Trade frequency significantly above trader's own baseline.
- Detection: Daily trade count > 2 standard deviations above rolling average, OR multiple same-ticker trades within short window.
- Confidence: HIGH (purely data-driven)
- Dollar impact: Sum P&L of trades beyond normal frequency.

**PATTERN 2: SIZE ESCALATION AFTER LOSSES (Tilt)**
- Definition: Increasing position size following consecutive losses.
- Detection: 2+ consecutive losses → next trade(s) position size > average by significant margin.
- Confidence: HIGH (purely data-driven)
- Dollar impact: Excess loss attributable to oversized positions.

**PATTERN 3: RAPID RE-ENTRY AFTER LOSS (Possible Revenge)**
- Definition: New trade taken within abnormally short time window after a losing trade.
- Detection: Loss → new trade within X minutes (calibrated to trader's normal pace) → often same or larger size.
- Confidence: MEDIUM (timing is factual, "revenge" intent is inferred)
- Dollar impact: P&L of rapid re-entry trades vs. baseline trades.
- Label: "Possible revenge pattern" not "You revenge traded."

**PATTERN 4: PREMATURE PROFIT TAKING**
- Definition: Closing winning positions significantly earlier than the trader's own average winning hold time.
- Detection: Exit in profit → hold time < 50% of trader's average winning hold time → price continued favorably after exit.
- Confidence: MEDIUM (timing is factual, "premature" is relative)
- Dollar impact: Estimated unrealized profit left on the table.

**Phase 2 Patterns (NOT in MVP):**
- Stop loss violation (needs intraday path or chart context)
- FOMO entry (needs chart-level move analysis)
- Averaging down (needs multi-leg grouping for options)

### 5.3 Context Analysis

**MVP Context (from data alone):**
- Sequence: What trades came before? Was trader in P&L positive or negative?
- Time: Time of day, day of week — correlated with performance.
- Frequency: Trading pace relative to trader's own baseline.
- Sizing: Position size relative to trader's own average.

**Phase 2 Context (requires external data):**
- Market regime: S&P 500 / VIX on trade day (trending/choppy/volatile)
- Macro calendar: FOMC, CPI, earnings dates
- News: Per-stock news on trade date

**Phase 3 Context (requires chart data):**
- Entry/exit relative to support/resistance/moving averages
- Volume context
- Chart pattern recognition

### 5.4 Academic Foundation

The framework is grounded in:
- **Prospect Theory** (Kahneman & Tversky) — loss aversion, disposition effect
- **Overconfidence Bias** (Barber & Odean) — frequency as risk signal
- **Emotional Regulation** (Lo & Repin) — arousal impairs decisions after losses
- **Deliberate Practice** (Ericsson) — process feedback, not outcome feedback
- **Practitioner literature** — Douglas, Steenbarger, Tendler

The product operationalizes established research, not invents new theory.

---

## 6. USER JOURNEY

### 6.1 First Visit (No Account)

1. Lands on website: "Upload your trades. See what you're really doing."
2. Selects broker (or auto-detected).
3. Uploads CSV file.
4. Waits ~15–30 seconds.
5. Sees LIMITED free report:
   - Basic P&L summary
   - **The #1 pattern costing them the most money** (shown in full detail)
   - Remaining patterns blurred/locked: "We found 4 behavioral patterns. Here's the biggest one..."
   - **"Cost of Behavior" number:** "Your [pattern] trades cost you $X — that's Y% of your total losses."
6. CTA: "Create free account to unlock full analysis."

The "aha moment" in step 5 is what converts them.

**Free report constraints:**
- Async-light processing (no heavy AI generation)
- No chart analysis, no news context
- Basic parsing + P&L + 1 pattern insight
- Rate limited to prevent abuse

### 6.2 Registered User — Daily Use

1. Finishes trading.
2. Exports CSV from IBKR (1-click).
3. Opens product, drags and drops file.
4. Sees within seconds:
   - **Today's P&L** — bold, clean, unmissable
   - **Behavioral flags** — any patterns triggered today
   - **Session timeline** — chronological view of trades with behavioral events marked
   - **AI Debrief** — coaching-style summary of the session
   - **"Cost of Behavior" today** — how much behavioral mistakes cost this session
5. Total time: 3–5 minutes reading. 0 minutes inputting.

### 6.3 Registered User — Weekly/Monthly Review

1. Opens dashboard.
2. Sees:
   - **Equity curve** with behavioral events overlaid
   - **Pattern trends** — "Revenge trading: 4 instances last month → 1 this month"
   - **Edge Scorecard** — where you make/lose money by time, stock type, hold time
   - **"Do More / Do Less"** — "Do more: morning trades held 20+ min. Do less: afternoon re-entries after losses."
   - **Best Days vs. Worst Days** — behavioral comparison
   - **AI Big Picture Report** — monthly coaching summary

### 6.4 Emotional Arc

- **First visit:** Shock. "It found my revenge trading from a CSV?"
- **First week:** Curiosity. Checks report daily.
- **First month:** Awareness. Starts recognizing patterns while trading.
- **Third month:** Improvement. Measurable reduction in behavioral mistakes.

---

## 7. FUNCTIONAL REQUIREMENTS (MVP ONLY)

### 7.1 File Upload & Parsing

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | Accept CSV files from IBKR (Activity Statement / Flex Query format) | Must |
| FR-02 | Auto-detect file format and validate structure | Must |
| FR-03 | Parse: date, time, symbol, direction, quantity, price, commission | Must |
| FR-04 | Group individual executions into logical trades (buys + sells = 1 trade) | Must |
| FR-05 | Handle partial fills and scaling in/out | Must |
| FR-06 | Detect and prevent duplicate imports | Must |
| FR-07 | Clear error messages for malformed files | Must |
| FR-08 | Drag-and-drop upload interface | Must |
| FR-09 | Process up to 500 trades in under 30 seconds | Must |
| FR-10 | Support Schwab/TDA CSV format | Should (add based on demand) |
| FR-11 | Support Webull CSV format | Should (add based on demand) |

### 7.2 Trade Display

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-12 | Display each trade: ticker, direction, entry/exit price, P&L ($, %), hold time | Must |
| FR-13 | Trade list view — sortable, filterable by date, ticker, P&L, flags | Must |
| FR-14 | Visual "verdict" per trade: good decision/outcome matrix (4 quadrants) | Must |
| FR-15 | Behavioral flag badges on flagged trades | Must |
| FR-16 | Expandable trade detail: breakdown of why it was flagged, context | Must |

### 7.3 Behavioral Pattern Detection

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-17 | Detect 4 MVP patterns automatically (overtrading, tilt, revenge, premature exit) | Must |
| FR-18 | Link each pattern instance to specific trades involved | Must |
| FR-19 | Calculate dollar impact per pattern instance | Must |
| FR-20 | Compare to trader's own baseline behavior | Must |
| FR-21 | Show confidence level: High / Medium | Must |
| FR-22 | Display as visual insight cards with headline + data + impact + recommendation | Must |
| FR-23 | Confidence thresholds: <30 trades = "Early observations", 30-100 = "Emerging", 100+ = "Established" | Must |
| FR-24 | Allow user to dismiss incorrect flags (optional feedback) | Should |

### 7.4 "Cost of Behavior" View

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-25 | Calculate total dollar cost of each behavioral pattern | Must |
| FR-26 | Show: "Your equity curve without [pattern] trades" simulation | Must |
| FR-27 | Per-pattern: "If you eliminated [pattern], your P&L would be +$X instead of -$Y" | Must |
| FR-28 | This is the #1 conversion and retention hook — make it visually striking | Must |

### 7.5 Session Timeline

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-29 | Chronological timeline of trades within a session | Must |
| FR-30 | Mark behavioral events on timeline (loss → rapid re-entry → larger size → loss) | Must |
| FR-31 | Visual storytelling of how a session unfolded behaviorally | Must |

### 7.6 Daily P&L Display

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-32 | Daily P&L: total $, %, # trades, win rate, biggest winner/loser | Must |
| FR-33 | Calendar heat map: daily P&L over weeks/months | Must |
| FR-34 | Cumulative equity curve with period selection (7d, 30d, 90d, all) | Must |

### 7.7 AI Session Debrief

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-35 | Generate AI debrief after each upload | Must |
| FR-36 | Tone: direct, warm, evidence-based. Professional coach — not cheerful bot. | Must |
| FR-37 | Structure: summary → what went well → what went wrong → biggest cost → 1 recommendation | Must |
| FR-38 | Must reference specific trades with correct ticker, time, and dollar amounts | Must |
| FR-39 | AI receives structured facts only — does not generate analysis from scratch | Must |
| FR-40 | Weekly/monthly aggregate debriefs | Should |

### 7.8 Edge Scorecard

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-41 | Break down performance by: time of day, hold time bucket, day of week, ticker/sector | Must |
| FR-42 | Per category: # trades, win rate, avg P&L, total P&L, profit factor | Must |
| FR-43 | Highlight top 2-3 strengths and top 2-3 leaks with dollar amounts | Must |
| FR-44 | "Do More / Do Less" summary based on scorecard data | Must |
| FR-45 | "Best Days vs. Worst Days" behavioral comparison | Should |

### 7.9 Dashboard

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-46 | At-a-glance: P&L, equity curve, top patterns (with trend arrows), scorecard summary, calendar | Must |
| FR-47 | Responsive — works on desktop and mobile | Must |
| FR-48 | Period selection: 7d, 30d, 90d, all time | Must |
| FR-49 | Load under 2 seconds for returning users | Must |

### 7.10 Account & Data

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-50 | Account creation: email + password, Google SSO | Must |
| FR-51 | Data encrypted at rest and in transit | Must |
| FR-52 | User can delete all data | Must |
| FR-53 | Full history of uploaded trades maintained | Must |
| FR-54 | Data export capability | Should |
| FR-55 | Multiple broker accounts per user | Phase 2 |

### 7.11 Monetization

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-56 | Free anonymous upload → limited report (1 pattern, basic P&L) | Must |
| FR-57 | Free account → basic dashboard, limited patterns (top 2 only), no AI debrief | Must |
| FR-58 | Paid tier → full analysis, all patterns, AI debriefs, full dashboard | Must |
| FR-59 | Stripe integration for billing | Must |
| FR-60 | 14-day free trial of paid tier, no credit card | Must |
| FR-61 | One paid tier only in MVP (no premium tier yet) | Must |

---

## 8. AI ARCHITECTURE

### Layer 1: Deterministic Analysis (No AI — handles 70% of work)
- P&L calculations
- Time/frequency aggregations
- Position sizing analysis
- Baseline computation per trader
- Pattern detection (rule-based)
- Statistical comparisons

### Layer 2: Behavioral Classification (Rule Engine + Heuristics)
- Combines multiple signals to classify patterns
- Conservative thresholds to minimize false positives
- Outputs structured classifications with confidence scores
- NOT LLM-dependent

### Layer 3: Natural Language Generation (LLM — Claude API)
- Receives structured facts from Layer 1 and 2
- Converts to coaching-style narrative
- Daily debriefs, weekly/monthly summaries
- References specific trades with correct data
- NEVER generates analysis — only explains/narrates

### AI Rules
- All claims traceable to actual trade data
- Confidence levels shown for all behavioral claims
- Tone: professional coach, not generic chatbot
- Cost target: < 15% of subscription revenue per user
- Estimated cost: $0.03–$0.10 per user per day

---

## 9. DESIGN REQUIREMENTS

### Visual Identity
- **Dark mode primary** (traders live in dark-mode platforms)
- Light mode available
- "Bloomberg credibility + Stripe beauty"
- Bold typography for key numbers
- Generous white space
- Color: green/red for P&L, amber for behavioral flags, blue for context

### Information Hierarchy (every screen)
1. **THE ONE NUMBER / ONE INSIGHT** (hero, impossible to miss)
2. **Supporting context** (visible without scrolling)
3. **Detailed breakdown** (on click/scroll)
4. **Raw data** (accessible but not prominent)

### Trust & Methodology Panel
- Every pattern shows: how it was detected, what data was used, what was inferred, confidence level
- Transparent methodology builds trust

### Mobile
- Responsive web, not native app
- Mobile for reading reports and dashboard
- Upload primarily on desktop
- Charts must be readable (pinch to zoom)

---

## 10. DATA PRIVACY

- Trade data is sensitive financial information
- All data encrypted at rest and in transit
- No data shared with third parties
- No data used for model training without explicit consent
- User can delete all data at any time
- Clear privacy policy

---

## 11. SUCCESS METRICS

### Activation
- Upload completed
- First insight seen
- Time to first insight (target: < 30 seconds)
- Account created after aha moment

### Retention
- Second upload within 7 days
- Weekly active uploads
- Debrief read completion rate

### Conversion
- Free → paid conversion rate
- Time to conversion

### User Outcomes
- Decrease in behavioral pattern frequency over time
- Decision quality trend improvement

### Business
- MRR, churn (target: < 8% monthly), LTV:CAC (target: > 3:1)
- AI cost per user per month (target: < 15% of ARPU)

---

## 12. COMPETITIVE POSITIONING

**For** retail U.S. stock traders who know they make behavioral mistakes but won't journal,
**[Product Name] is** an AI-powered trading analysis system
**that** automatically discovers behavioral patterns costing them money from a single file upload.
**Unlike** TradeZella, TraderVue, and TraderSync which require manual effort and measure only outcomes,
**[Product Name]** requires zero input, evaluates decision quality independently of P&L, quantifies the dollar cost of each behavioral pattern, and delivers coaching-style AI analysis.

### Key Differentiators
1. **Zero effort** — upload only, no tagging/journaling
2. **Decision ≠ Outcome** — separates decision quality from P&L
3. **Cost of Behavior** — puts a dollar amount on each pattern
4. **Behavioral inference from data** — no self-reporting
5. **Coaching, not dashboards** — AI speaks like a coach, not a database
6. **Transparent confidence levels** — honest about what it knows vs. infers

---

## 13. RISK REGISTER

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | Behavioral inference false positives | Medium | High | Conservative thresholds, confidence levels, user dismiss option |
| 2 | Scope creep during development | High | High | This BRD + PHASE_PLAN.md are the scope contract. Nothing added without updating docs. |
| 3 | User retention after initial novelty | Medium | High | "Cost of Behavior" evolves with more data. Trend tracking gives new value each week. |
| 4 | AI costs scaling beyond revenue | Low (early) | High (scale) | Layer 1-2 handle 70%+ of analysis. AI for narrative only. Monitor cost/user. |
| 5 | IBKR CSV format changes | Medium | Medium | Flexible parser, format version detection, clear error messages |
| 6 | Insufficient data for patterns (<30 trades) | Medium | Medium | Show basic P&L value immediately. Label early patterns as "preliminary." |
| 7 | Trust erosion from wrong flags | Medium | High | Confidence labels, transparent methodology, dismiss option |

---

## 14. OPEN QUESTIONS

| # | Question | Status | Impact |
|---|----------|--------|--------|
| 1 | Product name | TBD | Marketing, domain, branding |
| 2 | IBKR exact export format (Activity Statement vs. Flex Query) | TBD | Parser development |
| 3 | Paid tier exact price ($19? $29? $39?) | TBD | Revenue model |
| 4 | Free report exact limits | TBD | Conversion optimization |
| 5 | Minimum trustable analysis — what's the floor? | TBD | Launch criteria |
| 6 | Error tolerance for behavioral flags | TBD | Detection thresholds |
| 7 | Store original files or normalized trades only? | TBD | Storage/privacy |
| 8 | Shareable free report (for virality)? | TBD | Growth strategy |