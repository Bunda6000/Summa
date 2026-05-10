-- Migration: add renewal_date to profiles, create purchase_history table
-- Fixes a missing column the verify-play-purchase edge function already writes to,
-- and adds per-purchase receipt storage for the billing UI.

-- 1. Add renewal_date to profiles
--    The edge function upserts this column but it was absent from the original migration.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS renewal_date timestamptz;

-- 2. Purchase history — one row per verified Google Play purchase
CREATE TABLE IF NOT EXISTS public.purchase_history (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id       text        NOT NULL,
  product_id     text        NOT NULL,
  purchase_token text        NOT NULL UNIQUE,
  status         text        NOT NULL DEFAULT 'purchased'
                               CHECK (status IN ('purchased', 'refunded')),
  purchased_at   timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchase_history_user_id_idx
  ON public.purchase_history(user_id);

CREATE INDEX IF NOT EXISTS purchase_history_purchased_at_idx
  ON public.purchase_history(user_id, purchased_at DESC);

ALTER TABLE public.purchase_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own purchase history"
  ON public.purchase_history FOR SELECT
  USING (auth.uid() = user_id);
