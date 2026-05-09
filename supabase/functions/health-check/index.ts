// Supabase Edge Function — health-check
//
// Returns aggregated system health metrics from the monitoring_events table.
// Restricted to admin users — the caller's JWT email must be in ADMIN_EMAILS.
//
// Required environment variables:
//   ADMIN_EMAILS              — comma-separated list of admin email addresses
//   SUPABASE_URL              — injected automatically
//   SUPABASE_SERVICE_ROLE_KEY — injected automatically
//   SUPABASE_ANON_KEY         — injected automatically

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  // ── 1. Verify admin JWT ────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Missing authorization header' }, 401);
  }

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await anonClient.auth.getUser();
  if (authError || !user) return json({ error: 'Unauthorized' }, 401);

  const adminEmails = (Deno.env.get('ADMIN_EMAILS') ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.includes((user.email ?? '').toLowerCase())) {
    return json({ error: 'Forbidden' }, 403);
  }

  // ── 2. Aggregate metrics ───────────────────────────────────────────────────
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const now = new Date();
  const minus1h = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const minus24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // Total events in the past 24 hours
  const { count: total24h } = await adminClient
    .from('monitoring_events')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', minus24h);

  // Auth failures in the past 1 hour
  const { count: authFailures1h } = await adminClient
    .from('monitoring_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'auth_failure')
    .gte('created_at', minus1h);

  // Total events in the past 1 hour (to compute rates)
  const { count: total1h } = await adminClient
    .from('monitoring_events')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', minus1h);

  // Billing failures in the past 24 hours
  const { count: billingFailures24h } = await adminClient
    .from('monitoring_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'billing_failure')
    .gte('created_at', minus24h);

  // RTDN errors in the past 24 hours
  const { count: rtdnErrors24h } = await adminClient
    .from('monitoring_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'rtdn_error')
    .gte('created_at', minus24h);

  // Sync failures in the past 1 hour
  const { count: syncFailures1h } = await adminClient
    .from('monitoring_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'sync_failure')
    .gte('created_at', minus1h);

  // Most recent event timestamp
  const { data: lastEvent } = await adminClient
    .from('monitoring_events')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // ── 3. Compute derived stats ───────────────────────────────────────────────
  const t1h = total1h ?? 0;
  const authFail = authFailures1h ?? 0;
  const syncFail = syncFailures1h ?? 0;

  const authFailureRate1h = t1h > 0 ? Math.round((authFail / t1h) * 1000) / 10 : 0;

  // Sync success rate: approximation based on sync failure count vs total events
  const syncSuccessRate1h = syncFail === 0 ? 100 : Math.max(
    0,
    Math.round(((t1h - syncFail) / Math.max(t1h, 1)) * 1000) / 10,
  );

  // Uptime: if no critical events in the past hour → 100%, otherwise degrade
  const { count: criticalCount1h } = await adminClient
    .from('monitoring_events')
    .select('*', { count: 'exact', head: true })
    .eq('severity', 'critical')
    .gte('created_at', minus1h);

  const criticals = criticalCount1h ?? 0;
  const uptimePct = criticals === 0
    ? 100
    : Math.max(0, Math.round((1 - criticals / Math.max(t1h, 1)) * 1000) / 10);

  return json({
    uptime_pct: uptimePct,
    auth_failure_rate_1h: authFailureRate1h,
    billing_failure_count_24h: billingFailures24h ?? 0,
    rtdn_error_count_24h: rtdnErrors24h ?? 0,
    sync_success_rate_1h: syncSuccessRate1h,
    sync_failure_count_1h: syncFail,
    total_events_24h: total24h ?? 0,
    last_event_at: lastEvent?.created_at ?? null,
  }, 200);
});
