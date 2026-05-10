-- Migration: create subscriptions table for feature gating

CREATE TYPE public.subscription_status AS ENUM ('free', 'active', 'grace_period', 'expired', 'canceled');

CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status            public.subscription_status NOT NULL DEFAULT 'free',
  current_period_end timestamptz,
  grace_period_end   timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

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

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id);
