# TECHNICAL SPECIFICATION
## Architecture, Stack, Data Models, APIs

---

## 1. TECH STACK (Recommended)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 14+ (App Router) + TypeScript | SSR, responsive, fast |
| Styling | Tailwind CSS + shadcn/ui | Dark mode, rapid UI development |
| Charts | Recharts or Lightweight Charts (TradingView) | Financial data visualization |
| Backend | Next.js API Routes + Server Actions | Unified codebase, simpler deployment |
| Database | Supabase (PostgreSQL) | Auth, storage, real-time, familiar to founder |
| Auth | Supabase Auth (email + Google SSO) | Built-in, handles sessions |
| File Storage | Supabase Storage | Store original CSV files |
| AI | Claude API (Anthropic) | Debrief generation, narrative layer |
| Payments | Stripe | Billing, subscriptions, trials |
| Hosting | Vercel | Next.js optimized, edge functions |
| Analytics | PostHog or Mixpanel | Product analytics, funnel tracking |

### Why This Stack
- Founder has Supabase experience
- Next.js + Vercel = fastest deployment path
- All managed services = zero DevOps for solo founder
- Claude API = familiar, high quality for coaching narrative
- Total infrastructure cost estimate: $50–150/month at MVP scale

---

## 2. HIGH-LEVEL ARCHITECTURE

```
┌─────────────────────────────────────────────────┐
│                   FRONTEND                       │
│              Next.js (App Router)                 │
│  ┌──────────┬──────────┬──────────┬───────────┐  │
│  │Dashboard │Trade List│ Session  │  Upload   │  │
│  │          │+ Detail  │ Timeline │  + Report │  │
│  └──────────┴──────────┴──────────┴───────────┘  │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────┐
│                 API LAYER                        │
│           Next.js API Routes                     │
│  ┌──────────┬──────────┬──────────┬───────────┐  │
│  │ Upload   │ Analysis │ AI      │  Billing  │  │
│  │ + Parse  │ Engine   │ Debrief │  (Stripe) │  │
│  └──────────┴──────────┴──────────┴───────────┘  │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────┐
│              ANALYSIS ENGINE                     │
│         (Core Business Logic)                    │
│  ┌──────────────────────────────────────────┐    │
│  │  Layer 1: Deterministic Analysis         │    │
│  │  - P&L calculations                      │    │
│  │  - Baseline computation                  │    │
│  │  - Statistical aggregations              │    │
│  ├──────────────────────────────────────────┤    │
│  │  Layer 2: Pattern Detection              │    │
│  │  - Rule engine (4 patterns)              │    │
│  │  - Confidence scoring                    │    │
│  │  - Dollar impact calculation             │    │
│  ├──────────────────────────────────────────┤    │
│  │  Layer 3: AI Narrative (Claude API)      │    │
│  │  - Receives structured facts             │    │
│  │  - Generates coaching debrief            │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────┐
│                 DATA LAYER                       │
│              Supabase (PostgreSQL)                │
│  ┌──────────┬──────────┬──────────┬───────────┐  │
│  │  Users   │  Trades  │ Sessions │ Analysis  │  │
│  │          │          │          │  Results  │  │
│  └──────────┴──────────┴──────────┴───────────┘  │
└─────────────────────────────────────────────────┘
```

---

## 3. DATA MODELS

### Users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  subscription_tier TEXT DEFAULT 'free', -- 'free', 'paid'
  subscription_status TEXT DEFAULT 'active',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Broker Accounts
```sql
CREATE TABLE broker_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  broker_name TEXT NOT NULL, -- 'ibkr', 'schwab', 'webull'
  account_label TEXT, -- user-friendly label
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### File Uploads
```sql
CREATE TABLE file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  broker_account_id UUID REFERENCES broker_accounts(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Supabase storage path
  file_size_bytes INTEGER,
  broker_format TEXT, -- detected format version
  trades_parsed INTEGER DEFAULT 0,
  duplicates_skipped INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Trades
```sql
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  broker_account_id UUID REFERENCES broker_accounts(id),
  file_upload_id UUID REFERENCES file_uploads(id),

  -- Trade Identity
  symbol TEXT NOT NULL,
  asset_type TEXT DEFAULT 'stock', -- 'stock', 'option' (Phase 2)
  direction TEXT NOT NULL, -- 'long', 'short'

  -- Execution
  entry_time TIMESTAMPTZ NOT NULL,
  exit_time TIMESTAMPTZ,
  entry_price DECIMAL(12,4) NOT NULL,
  exit_price DECIMAL(12,4),
  quantity INTEGER NOT NULL,
  total_commission DECIMAL(10,4) DEFAULT 0,

  -- Calculated
  gross_pnl DECIMAL(12,4),
  net_pnl DECIMAL(12,4),
  pnl_percent DECIMAL(8,4),
  hold_time_minutes INTEGER,

  -- Position context
  position_value DECIMAL(14,4), -- entry_price * quantity
  is_open BOOLEAN DEFAULT false,

  -- Deduplication
  execution_hash TEXT UNIQUE, -- hash of key fields for duplicate detection

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_trades_user_date ON trades(user_id, entry_time);
CREATE INDEX idx_trades_symbol ON trades(user_id, symbol);
CREATE INDEX idx_trades_session ON trades(user_id, DATE(entry_time));
```

### Trade Executions (raw fills)
```sql
CREATE TABLE trade_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  file_upload_id UUID REFERENCES file_uploads(id),

  side TEXT NOT NULL, -- 'buy', 'sell'
  quantity INTEGER NOT NULL,
  price DECIMAL(12,4) NOT NULL,
  commission DECIMAL(10,4) DEFAULT 0,
  executed_at TIMESTAMPTZ NOT NULL,

  -- Raw from CSV
  raw_data JSONB, -- original CSV row for debugging

  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Trading Sessions
```sql
CREATE TABLE trading_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,

  -- Summary
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  gross_pnl DECIMAL(12,4) DEFAULT 0,
  net_pnl DECIMAL(12,4) DEFAULT 0,
  win_rate DECIMAL(5,4),

  -- Behavioral summary
  patterns_detected INTEGER DEFAULT 0,
  behavior_cost DECIMAL(12,4) DEFAULT 0, -- total "cost of behavior"

  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, session_date)
);
```

### Trader Baselines
```sql
CREATE TABLE trader_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Computed baselines (rolling)
  avg_trades_per_day DECIMAL(6,2),
  stddev_trades_per_day DECIMAL(6,2),
  avg_position_size DECIMAL(14,4),
  stddev_position_size DECIMAL(14,4),
  avg_hold_time_minutes DECIMAL(8,2),
  avg_time_between_trades_minutes DECIMAL(8,2),
  avg_winning_hold_time_minutes DECIMAL(8,2),
  avg_losing_hold_time_minutes DECIMAL(8,2),
  overall_win_rate DECIMAL(5,4),
  total_trades_analyzed INTEGER DEFAULT 0,

  -- Time-based performance
  performance_by_hour JSONB, -- {"09": {trades, winRate, avgPnl}, "10": {...}}
  performance_by_dow JSONB, -- {"mon": {...}, "tue": {...}}

  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);
```

### Pattern Detections
```sql
CREATE TABLE pattern_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES trading_sessions(id),

  pattern_type TEXT NOT NULL,
  -- 'overtrading', 'size_escalation', 'rapid_reentry', 'premature_exit'

  confidence TEXT NOT NULL, -- 'high', 'medium'
  severity TEXT, -- 'minor', 'moderate', 'severe'

  -- Involved trades
  trigger_trade_id UUID REFERENCES trades(id), -- the trade that triggered detection
  involved_trade_ids UUID[], -- all trades in the pattern sequence

  -- Impact
  dollar_impact DECIMAL(12,4), -- estimated cost of this pattern instance
  description TEXT, -- human-readable: "3 trades in 8 minutes after $200 loss"

  -- Detection metadata
  detection_data JSONB, -- full detection context for debugging/transparency

  -- User feedback
  user_dismissed BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_patterns_user_type ON pattern_detections(user_id, pattern_type);
CREATE INDEX idx_patterns_session ON pattern_detections(session_id);
```

### AI Debriefs
```sql
CREATE TABLE ai_debriefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES trading_sessions(id),

  debrief_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  period_start DATE,
  period_end DATE,

  -- Input (what was sent to AI)
  structured_input JSONB NOT NULL,

  -- Output
  debrief_text TEXT NOT NULL,

  -- Cost tracking
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost_usd DECIMAL(6,4),

  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. API ENDPOINTS (MVP)

### Upload
```
POST   /api/upload              Upload CSV file
GET    /api/uploads             List user's uploads
GET    /api/uploads/:id/status  Check processing status
```

### Trades
```
GET    /api/trades              List trades (filterable, paginated)
GET    /api/trades/:id          Single trade detail
GET    /api/sessions            List trading sessions
GET    /api/sessions/:date      Single session detail + trades
```

### Analysis
```
GET    /api/analysis/dashboard  Dashboard summary data
GET    /api/analysis/patterns   All detected patterns
GET    /api/analysis/scorecard  Edge scorecard data
GET    /api/analysis/cost       "Cost of Behavior" data
GET    /api/analysis/timeline/:date  Session timeline data
POST   /api/analysis/patterns/:id/dismiss  Dismiss a pattern flag
```

### AI
```
POST   /api/ai/debrief/:date   Generate/retrieve daily debrief
GET    /api/ai/debrief/:date   Get existing debrief
```

### Auth & Billing
```
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/billing/status
POST   /api/billing/create-checkout
POST   /api/billing/webhook     Stripe webhook
```

### Anonymous (No auth)
```
POST   /api/free-report         Upload CSV → limited free report
```

---

## 5. PARSING SPECIFICATION (IBKR)

### Supported Format
IBKR Flex Query export — Trades section, CSV format.

### Expected Fields
```
Symbol, DateTime, Quantity, Price, Proceeds, Commission,
NetCash, TradeDate, TradeTime, Buy/Sell, AssetCategory,
Currency, AccountId
```

### Parsing Logic
1. Read CSV, skip header rows
2. Filter to AssetCategory = 'STK' (stocks only in MVP)
3. Filter to Currency = 'USD'
4. For each row: extract symbol, datetime, side, qty, price, commission
5. Generate execution_hash = SHA256(symbol + datetime + side + qty + price)
6. Check for duplicates against existing execution_hashes
7. Group executions into trades:
   - Same symbol, same day
   - Match buys to sells chronologically
   - Handle partial fills and scaling
8. Calculate per-trade: entry/exit price (VWAP), P&L, hold time
9. Store raw execution + grouped trade

### Error Handling
- Unrecognized format → clear message: "This doesn't look like an IBKR export. Please use Flex Query → Trades."
- Missing fields → skip row, count errors, show summary
- All rows fail → "Could not parse any trades. Check your file format."
- >10% error rate → warning banner on results

---

## 6. PATTERN DETECTION ALGORITHMS

See `PATTERNS_SPEC.md` for full detection logic.

---

## 7. AI PROMPT ARCHITECTURE

### Daily Debrief Prompt Structure
```
System: You are a professional trading performance coach. You analyze
structured trading data and deliver honest, specific, actionable feedback.
You are direct but warm. You reference specific trades by ticker and time.
You never invent data. You only use the facts provided.

User: Here is today's trading session data:

{structured_session_json}

This includes:
- All trades with P&L, timing, sizing
- Detected behavioral patterns with confidence levels
- Dollar impact of each pattern
- Comparison to trader's baseline metrics
- Edge scorecard highlights

Generate a coaching debrief with this structure:
1. Session summary (1-2 sentences: net result + key observation)
2. What went well (specific trades with evidence)
3. What went wrong (specific patterns with evidence)
4. Cost of behavior today (the dollar amount behavioral patterns cost)
5. One specific, actionable recommendation for next session

Rules:
- Reference trades by ticker and time (e.g., "Your AAPL trade at 10:47 AM")
- Use actual dollar amounts from the data
- If a pattern has medium confidence, say "possible" or "likely"
- Do not lecture. Be specific and useful.
- Keep it under 400 words.
```

### Cost Management
- Use claude-sonnet-4-20250514 for debriefs (balance quality/cost)
- Structured input keeps token count predictable
- Cache common recommendation templates
- Rate limit: 1 debrief per session per day

---

## 8. DEPLOYMENT

### Environment
- **Production:** Vercel (auto-deploy from main branch)
- **Staging:** Vercel preview deployments (per PR)
- **Database:** Supabase cloud (managed PostgreSQL)

### Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

### GitHub Workflow
- `main` — production, always deployable
- `develop` — integration branch
- Feature branches: `feature/parser-ibkr`, `feature/pattern-overtrading`, etc.
- PR required for merging to develop/main
- Vercel auto-deploys previews on PR