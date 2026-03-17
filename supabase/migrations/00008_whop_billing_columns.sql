-- Replace Stripe columns with Whop columns for billing integration
-- Keep subscription_tier and subscription_status as-is

-- Drop Stripe-specific columns
ALTER TABLE public.users DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE public.users DROP COLUMN IF EXISTS stripe_subscription_id;

-- Add Whop-specific columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS whop_user_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS whop_membership_id TEXT;

-- Index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_users_whop_user_id ON public.users (whop_user_id) WHERE whop_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_whop_membership_id ON public.users (whop_membership_id) WHERE whop_membership_id IS NOT NULL;
