-- Migration: create subscriptions table for Google Play purchase records
-- Purchase tokens are write-once from the Edge Function (service_role).
-- RLS blocks all client access — tokens are never returned to the client.

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_token      text        NOT NULL,
  product_id          text        NOT NULL,
  order_id            text,
  subscription_status text        NOT NULL DEFAULT 'active'
                                  CHECK (subscription_status IN ('active', 'cancelled', 'expired', 'past_due')),
  renewal_date        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions (user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.subscriptions_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.subscriptions_set_updated_at();

-- RLS: all access blocked for authenticated clients.
-- Only the Edge Function (service_role) can read or write.
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- No SELECT policy → clients cannot read purchase tokens.
-- No INSERT/UPDATE policy → clients cannot write subscription records.
-- The Edge Function bypasses RLS using the service_role key.

-- Add renewal_date to profiles so the app can display it without
-- needing access to the subscriptions table.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS renewal_date timestamptz;
