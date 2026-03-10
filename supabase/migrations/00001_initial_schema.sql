-- Trading Performance System - Initial Schema
-- MVP: IBKR stock trades, 4 behavioral patterns

-- ============================================
-- USERS (extends Supabase auth.users)
-- ============================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'paid')),
  subscription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'canceled', 'past_due')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create user profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- BROKER ACCOUNTS
-- ============================================
CREATE TABLE public.broker_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  broker_name TEXT NOT NULL CHECK (broker_name IN ('ibkr', 'schwab', 'webull')),
  account_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_broker_accounts_user ON public.broker_accounts(user_id);

-- ============================================
-- FILE UPLOADS
-- ============================================
CREATE TABLE public.file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  broker_account_id UUID REFERENCES public.broker_accounts(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes INTEGER,
  broker_format TEXT,
  trades_parsed INTEGER NOT NULL DEFAULT 0,
  duplicates_skipped INTEGER NOT NULL DEFAULT 0,
  errors_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_file_uploads_user ON public.file_uploads(user_id);

-- ============================================
-- TRADES (grouped logical trades)
-- ============================================
CREATE TABLE public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  broker_account_id UUID REFERENCES public.broker_accounts(id),
  file_upload_id UUID REFERENCES public.file_uploads(id),

  -- Trade identity
  symbol TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'stock'
    CHECK (asset_type IN ('stock', 'option')),
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),

  -- Execution
  entry_time TIMESTAMPTZ NOT NULL,
  exit_time TIMESTAMPTZ,
  entry_price DECIMAL(12,4) NOT NULL,
  exit_price DECIMAL(12,4),
  quantity INTEGER NOT NULL,
  total_commission DECIMAL(10,4) NOT NULL DEFAULT 0,

  -- Calculated
  gross_pnl DECIMAL(12,4),
  net_pnl DECIMAL(12,4),
  pnl_percent DECIMAL(8,4),
  hold_time_minutes INTEGER,

  -- Position context
  position_value DECIMAL(14,4) NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT false,

  -- Deduplication
  execution_hash TEXT UNIQUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trades_user_date ON public.trades(user_id, entry_time);
CREATE INDEX idx_trades_user_symbol ON public.trades(user_id, symbol);
CREATE INDEX idx_trades_session ON public.trades(user_id, (entry_time::date));
CREATE INDEX idx_trades_upload ON public.trades(file_upload_id);

-- ============================================
-- TRADE EXECUTIONS (raw fills from CSV)
-- ============================================
CREATE TABLE public.trade_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES public.trades(id) ON DELETE CASCADE,
  file_upload_id UUID REFERENCES public.file_uploads(id),

  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity INTEGER NOT NULL,
  price DECIMAL(12,4) NOT NULL,
  commission DECIMAL(10,4) NOT NULL DEFAULT 0,
  executed_at TIMESTAMPTZ NOT NULL,

  -- Raw CSV row for debugging
  raw_data JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_executions_trade ON public.trade_executions(trade_id);

-- ============================================
-- TRADING SESSIONS (daily summary)
-- ============================================
CREATE TABLE public.trading_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,

  -- Summary
  total_trades INTEGER NOT NULL DEFAULT 0,
  winning_trades INTEGER NOT NULL DEFAULT 0,
  losing_trades INTEGER NOT NULL DEFAULT 0,
  gross_pnl DECIMAL(12,4) NOT NULL DEFAULT 0,
  net_pnl DECIMAL(12,4) NOT NULL DEFAULT 0,
  win_rate DECIMAL(5,4),

  -- Behavioral summary
  patterns_detected INTEGER NOT NULL DEFAULT 0,
  behavior_cost DECIMAL(12,4) NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, session_date)
);

CREATE INDEX idx_sessions_user_date ON public.trading_sessions(user_id, session_date);

-- ============================================
-- TRADER BASELINES (rolling averages)
-- ============================================
CREATE TABLE public.trader_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Computed baselines
  avg_trades_per_day DECIMAL(6,2),
  stddev_trades_per_day DECIMAL(6,2),
  avg_position_size DECIMAL(14,4),
  stddev_position_size DECIMAL(14,4),
  avg_hold_time_minutes DECIMAL(8,2),
  avg_time_between_trades_minutes DECIMAL(8,2),
  avg_winning_hold_time_minutes DECIMAL(8,2),
  avg_losing_hold_time_minutes DECIMAL(8,2),
  overall_win_rate DECIMAL(5,4),
  total_trades_analyzed INTEGER NOT NULL DEFAULT 0,

  -- Time-based performance
  performance_by_hour JSONB,
  performance_by_dow JSONB,

  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- ============================================
-- PATTERN DETECTIONS
-- ============================================
CREATE TABLE public.pattern_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.trading_sessions(id) ON DELETE CASCADE,

  pattern_type TEXT NOT NULL
    CHECK (pattern_type IN ('overtrading', 'size_escalation', 'rapid_reentry', 'premature_exit')),
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium')),
  severity TEXT CHECK (severity IN ('minor', 'moderate', 'severe')),

  -- Involved trades
  trigger_trade_id UUID REFERENCES public.trades(id),
  involved_trade_ids UUID[],

  -- Impact
  dollar_impact DECIMAL(12,4),
  description TEXT,

  -- Detection metadata
  detection_data JSONB,

  -- User feedback
  user_dismissed BOOLEAN NOT NULL DEFAULT false,
  dismissed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_patterns_user_type ON public.pattern_detections(user_id, pattern_type);
CREATE INDEX idx_patterns_session ON public.pattern_detections(session_id);

-- ============================================
-- AI DEBRIEFS
-- ============================================
CREATE TABLE public.ai_debriefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.trading_sessions(id) ON DELETE CASCADE,

  debrief_type TEXT NOT NULL CHECK (debrief_type IN ('daily', 'weekly', 'monthly')),
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

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_debriefs_user ON public.ai_debriefs(user_id);
CREATE INDEX idx_debriefs_session ON public.ai_debriefs(session_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trader_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pattern_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_debriefs ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY users_own_data ON public.users
  FOR ALL USING (auth.uid() = id);

CREATE POLICY broker_accounts_own_data ON public.broker_accounts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY file_uploads_own_data ON public.file_uploads
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY trades_own_data ON public.trades
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY trade_executions_own_data ON public.trade_executions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.trades
      WHERE trades.id = trade_executions.trade_id
      AND trades.user_id = auth.uid()
    )
  );

CREATE POLICY trading_sessions_own_data ON public.trading_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY trader_baselines_own_data ON public.trader_baselines
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY pattern_detections_own_data ON public.pattern_detections
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY ai_debriefs_own_data ON public.ai_debriefs
  FOR ALL USING (auth.uid() = user_id);
