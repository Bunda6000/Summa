-- Migration: add trial support to subscriptions
--
-- Adds 'trial' as a valid subscription_status so that users who start a
-- Google Play free trial can be tracked separately from paid subscribers.
-- trial_started_at / trial_ends_at record the window shown in the UI.

ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'trial';

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at    timestamptz;
