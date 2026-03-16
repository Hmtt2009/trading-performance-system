-- Fix: quantity columns use INTEGER which truncates fractional shares
-- Some brokers (Schwab, Webull) support fractional share trading

ALTER TABLE public.trades ALTER COLUMN quantity TYPE DECIMAL(12,4);
ALTER TABLE public.trade_executions ALTER COLUMN quantity TYPE DECIMAL(12,4);
