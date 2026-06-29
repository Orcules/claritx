-- Migration 004: Add subscription status tracking columns
ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_user_credits_stripe_sub_id
  ON user_credits(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_credits_stripe_cust_id
  ON user_credits(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
