// Supabase Edge Function — log-event
//
// Receives monitoring events from the client and persists them to
// the monitoring_events table using service_role (bypasses RLS).
//
// Auth: optional — events may arrive before or during auth failures.
//       If a JWT is present it is decoded to attach the user_id.
//
// Required environment variables:
//   SUPABASE_URL              — injected automatically
//   SUPABASE_SERVICE_ROLE_KEY — injected automatically
//   SUPABASE_ANON_KEY         — injected automatically

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_EVENT_TYPES = new Set([
  'auth_failure',
  'auth_lockout',
  'billing_failure',
  'rtdn_error',
  'sync_failure',
  'health_check',
]);

const ALLOWED_SEVERITIES = new Set(['info', 'warn', 'error', 'critical']);

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'key', 'authorization', 'bearer'];

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some(s => k.toLowerCase().includes(s))) {
      result[k] = '[REDACTED]';
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      result[k] = sanitize(v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  // ── 1. Parse body ──────────────────────────────────────────────────────────
  let body: {
    event_type?: unknown;
    severity?: unknown;
    message?: unknown;
    metadata?: unknown;
    user_id?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { event_type, severity, message, metadata, user_id } = body;

  // ── 2. Validate fields ─────────────────────────────────────────────────────
  if (typeof event_type !== 'string' || !ALLOWED_EVENT_TYPES.has(event_type)) {
    return json({ error: `Invalid event_type. Allowed: ${[...ALLOWED_EVENT_TYPES].join(', ')}` }, 400);
  }
  if (typeof severity !== 'string' || !ALLOWED_SEVERITIES.has(severity)) {
    return json({ error: `Invalid severity. Allowed: ${[...ALLOWED_SEVERITIES].join(', ')}` }, 400);
  }
  if (typeof message !== 'string' || !message.trim()) {
    return json({ error: 'message is required' }, 400);
  }

  // ── 3. Optionally resolve user_id from JWT ─────────────────────────────────
  let resolvedUserId: string | null = null;

  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader.startsWith('Bearer ')) {
    try {
      const anonClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await anonClient.auth.getUser();
      resolvedUserId = user?.id ?? null;
    } catch {
      // Non-fatal — proceed without user_id
    }
  }

  // Prefer the server-resolved user_id over the client-supplied one to
  // prevent spoofing; fall back to the client value if no JWT is present.
  const finalUserId =
    resolvedUserId ?? (typeof user_id === 'string' ? user_id : null);

  // ── 4. Sanitize metadata ───────────────────────────────────────────────────
  const sanitizedMetadata =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? sanitize(metadata as Record<string, unknown>)
      : null;

  // ── 5. Persist with service_role ───────────────────────────────────────────
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { error: insertError } = await adminClient.from('monitoring_events').insert({
    event_type,
    severity,
    message: message.trim(),
    metadata: sanitizedMetadata,
    user_id: finalUserId,
  });

  if (insertError) {
    console.error('log-event: insert failed:', insertError);
    return json({ error: 'Failed to persist event' }, 500);
  }

  return json({ ok: true }, 201);
});
