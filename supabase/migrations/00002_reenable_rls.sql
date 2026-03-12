-- Re-enable RLS on all tables (ensure none were disabled during development)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trader_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pattern_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_debriefs ENABLE ROW LEVEL SECURITY;
