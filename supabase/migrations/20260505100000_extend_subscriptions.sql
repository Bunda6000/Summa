-- Migration: add purchase tracking columns to subscriptions table
--
-- These columns are required by verify-play-purchase and play-rtdn-webhook:
--   purchase_token  — the Google Play purchase token (unique per renewal cycle)
--   product_id      — the Google Play subscription product ID
--   order_id        — the Google Play order ID

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS purchase_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS product_id     text,
  ADD COLUMN IF NOT EXISTS order_id       text;

CREATE INDEX IF NOT EXISTS subscriptions_purchase_token_idx
  ON public.subscriptions (purchase_token)
  WHERE purchase_token IS NOT NULL;
