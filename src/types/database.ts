// Database types matching our Supabase schema

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  subscription_tier: 'free' | 'paid';
  subscription_status: 'active' | 'canceled' | 'past_due';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrokerAccount {
  id: string;
  user_id: string;
  broker_name: 'ibkr' | 'schwab' | 'webull';
  account_label: string | null;
  created_at: string;
}

export interface FileUpload {
  id: string;
  user_id: string;
  broker_account_id: string | null;
  file_name: string;
  file_path: string;
  file_size_bytes: number | null;
  broker_format: string | null;
  trades_parsed: number;
  duplicates_skipped: number;
  errors_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
}

export interface Trade {
  id: string;
  user_id: string;
  broker_account_id: string | null;
  file_upload_id: string | null;
  symbol: string;
  asset_type: 'stock' | 'option';
  direction: 'long' | 'short';
  entry_time: string;
  exit_time: string | null;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  total_commission: number;
  gross_pnl: number | null;
  net_pnl: number | null;
  pnl_percent: number | null;
  hold_time_minutes: number | null;
  position_value: number;
  is_open: boolean;
  execution_hash: string | null;
  created_at: string;
}

export interface TradeExecution {
  id: string;
  trade_id: string;
  file_upload_id: string | null;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  commission: number;
  executed_at: string;
  raw_data: Record<string, string> | null;
  created_at: string;
}

export interface TradingSession {
  id: string;
  user_id: string;
  session_date: string;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  gross_pnl: number;
  net_pnl: number;
  win_rate: number | null;
  patterns_detected: number;
  behavior_cost: number;
  created_at: string;
}

export interface TraderBaseline {
  id: string;
  user_id: string;
  avg_trades_per_day: number | null;
  stddev_trades_per_day: number | null;
  avg_position_size: number | null;
  stddev_position_size: number | null;
  avg_hold_time_minutes: number | null;
  avg_time_between_trades_minutes: number | null;
  avg_winning_hold_time_minutes: number | null;
  avg_losing_hold_time_minutes: number | null;
  overall_win_rate: number | null;
  total_trades_analyzed: number;
  performance_by_hour: Record<string, HourPerformance> | null;
  performance_by_dow: Record<string, DowPerformance> | null;
  computed_at: string;
}

export interface HourPerformance {
  trades: number;
  win_rate: number;
  avg_pnl: number;
  total_pnl: number;
}

export interface DowPerformance {
  trades: number;
  win_rate: number;
  avg_pnl: number;
  total_pnl: number;
}

export type PatternType =
  | 'overtrading'
  | 'size_escalation'
  | 'rapid_reentry'
  | 'premature_exit';

export type ConfidenceLevel = 'high' | 'medium';
export type Severity = 'minor' | 'moderate' | 'severe';

export interface PatternDetection {
  id: string;
  user_id: string;
  session_id: string | null;
  pattern_type: PatternType;
  confidence: ConfidenceLevel;
  severity: Severity | null;
  trigger_trade_id: string | null;
  involved_trade_ids: string[];
  dollar_impact: number | null;
  description: string | null;
  detection_data: Record<string, unknown> | null;
  user_dismissed: boolean;
  dismissed_at: string | null;
  created_at: string;
}

export interface AiDebrief {
  id: string;
  user_id: string;
  session_id: string | null;
  debrief_type: 'daily' | 'weekly' | 'monthly';
  period_start: string | null;
  period_end: string | null;
  structured_input: Record<string, unknown>;
  debrief_text: string;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_usd: number | null;
  created_at: string;
}
