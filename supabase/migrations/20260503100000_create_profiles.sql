-- Migration: create profiles table for user account data
-- Stores display name and plan. Plan is write-protected via trigger.

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name       text,
  plan               text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'paid')),
  subscription_status text NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'past_due')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at on every write
CREATE OR REPLACE FUNCTION public.profiles_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_set_updated_at();

-- Plan immutability: silently revert any client attempt to change plan.
-- The UPDATE succeeds and returns 200 — the plan just doesn't change.
-- Only a privileged server-side call (service_role) should ever mutate plan.
CREATE OR REPLACE FUNCTION public.profiles_protect_plan()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.plan = OLD.plan;
  NEW.subscription_status = OLD.subscription_status;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_protect_plan
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_protect_plan();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);
