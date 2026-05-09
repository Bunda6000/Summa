-- Migration: monitoring_events + alert_config + pg_cron check-alerts job
-- Created: 2026-05-09

-- ── 1. monitoring_events ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.monitoring_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text        NOT NULL,
  severity    text        NOT NULL CHECK (severity IN ('info', 'warn', 'error', 'critical')),
  message     text        NOT NULL,
  metadata    jsonb,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS monitoring_events_event_type_idx
  ON public.monitoring_events(event_type);

CREATE INDEX IF NOT EXISTS monitoring_events_severity_idx
  ON public.monitoring_events(severity);

CREATE INDEX IF NOT EXISTS monitoring_events_created_at_idx
  ON public.monitoring_events(created_at DESC);

CREATE INDEX IF NOT EXISTS monitoring_events_user_id_idx
  ON public.monitoring_events(user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.monitoring_events ENABLE ROW LEVEL SECURITY;

-- Only service_role (edge functions) may read or write monitoring events.
-- Regular users never see this table.
CREATE POLICY "Service role can manage monitoring events"
  ON public.monitoring_events
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 2. alert_config ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.alert_config (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type       text    NOT NULL UNIQUE,
  threshold_count  int     NOT NULL DEFAULT 5,
  window_minutes   int     NOT NULL DEFAULT 60,
  enabled          boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage alert config"
  ON public.alert_config
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 3. Default alert thresholds ──────────────────────────────────────────────

INSERT INTO public.alert_config (event_type, threshold_count, window_minutes)
VALUES
  ('auth_failure',    10, 15),   -- 10 failed logins in 15 min
  ('auth_lockout',     3, 60),   -- 3 account lockouts in 1 hour
  ('billing_failure',  3, 60),   -- 3 billing errors in 1 hour
  ('rtdn_error',       3, 60),   -- 3 RTDN processing failures in 1 hour
  ('sync_failure',    10, 30)    -- 10 sync failures in 30 min
ON CONFLICT (event_type) DO NOTHING;

-- ── 4. pg_cron — run check-alerts every 15 minutes ───────────────────────────
-- Requires the pg_cron extension (enabled by default on Supabase).
-- The edge function URL is constructed from the project ref at runtime.

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'check-alerts-every-15min',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url    := (SELECT 'https://' || current_setting('app.settings.supabase_url', true) || '/functions/v1/check-alerts'),
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body   := '{}'::jsonb
    );
  $$
);
