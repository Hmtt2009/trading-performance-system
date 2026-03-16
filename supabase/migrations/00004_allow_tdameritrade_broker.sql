ALTER TABLE public.broker_accounts
  DROP CONSTRAINT IF EXISTS broker_accounts_broker_name_check;

ALTER TABLE public.broker_accounts
  ADD CONSTRAINT broker_accounts_broker_name_check
  CHECK (broker_name IN ('ibkr', 'schwab', 'tdameritrade', 'webull'));
