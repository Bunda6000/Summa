// Supabase Edge Function — check-alerts
//
// Scans monitoring_events against alert_config thresholds and sends
// email alerts via Resend when thresholds are exceeded.
//
// Invoked by pg_cron every 15 minutes with service_role authorization.
//
// Required environment variables:
//   RESEND_API_KEY            — Resend API key for sending emails
//   ALERT_EMAIL_TO            — destination email address (product owner)
//   ALERT_EMAIL_FROM          — sender address (must be verified in Resend)
//   SUPABASE_URL              — injected automatically
//   SUPABASE_SERVICE_ROLE_KEY — injected automatically

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

interface AlertConfig {
  event_type: string;
  threshold_count: number;
  window_minutes: number;
  enabled: boolean;
}

async function sendAlert(params: {
  resendApiKey: string;
  to: string;
  from: string;
  eventType: string;
  count: number;
  threshold: number;
  windowMinutes: number;
}): Promise<void> {
  const subject = `[Budget Planner Alert] ${params.eventType} threshold exceeded`;
  const body = [
    `<h2>Alert: ${params.eventType}</h2>`,
    `<p><strong>${params.count}</strong> events recorded in the last `,
    `<strong>${params.windowMinutes} minutes</strong>, `,
    `exceeding the threshold of <strong>${params.threshold}</strong>.</p>`,
    `<p>Check the <a href="${Deno.env.get('APP_URL') ?? 'https://summa.app'}/monitoring">`,
    `monitoring dashboard</a> for details.</p>`,
    `<hr/>`,
    `<p style="color:#888;font-size:12px;">Sent at ${new Date().toUTCString()} by Summa alert system</p>`,
  ].join('');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject,
      html: body,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend API error (${res.status}): ${text}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  // ── 1. Verify this came from service_role (cron job) ──────────────────────
  const authHeader = req.headers.get('authorization') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== serviceRoleKey) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const alertTo = Deno.env.get('ALERT_EMAIL_TO');
  const alertFrom = Deno.env.get('ALERT_EMAIL_FROM') ?? 'alerts@summa.app';

  if (!resendApiKey || !alertTo) {
    console.error('check-alerts: RESEND_API_KEY or ALERT_EMAIL_TO not configured');
    return json({ error: 'Alert delivery not configured' }, 500);
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey,
  );

  // ── 2. Load alert configurations ──────────────────────────────────────────
  const { data: configs, error: configError } = await adminClient
    .from('alert_config')
    .select('event_type, threshold_count, window_minutes, enabled')
    .eq('enabled', true);

  if (configError) {
    console.error('check-alerts: failed to load alert_config:', configError);
    return json({ error: 'Failed to load alert config' }, 500);
  }

  const alertConfigs = (configs ?? []) as AlertConfig[];
  const triggered: string[] = [];
  const errors: string[] = [];

  // ── 3. Check each threshold ────────────────────────────────────────────────
  for (const config of alertConfigs) {
    const windowStart = new Date(
      Date.now() - config.window_minutes * 60 * 1000,
    ).toISOString();

    const { count, error: countError } = await adminClient
      .from('monitoring_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', config.event_type)
      .gte('created_at', windowStart);

    if (countError) {
      console.error(`check-alerts: count failed for ${config.event_type}:`, countError);
      continue;
    }

    const eventCount = count ?? 0;
    if (eventCount >= config.threshold_count) {
      try {
        await sendAlert({
          resendApiKey,
          to: alertTo,
          from: alertFrom,
          eventType: config.event_type,
          count: eventCount,
          threshold: config.threshold_count,
          windowMinutes: config.window_minutes,
        });
        triggered.push(config.event_type);
        console.log(`check-alerts: alert sent for ${config.event_type} (count=${eventCount})`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`check-alerts: failed to send alert for ${config.event_type}:`, msg);
        errors.push(`${config.event_type}: ${msg}`);
      }
    }
  }

  return json({ triggered, errors, checked: alertConfigs.length }, 200);
});
