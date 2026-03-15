-- Fix: trade_executions.trade_id must be NOT NULL
-- Without this, RLS policy's correlated subquery returns false for NULL trade_id,
-- making the execution permanently invisible to all users including the owner.

ALTER TABLE public.trade_executions ALTER COLUMN trade_id SET NOT NULL;
