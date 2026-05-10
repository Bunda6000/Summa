// Supabase Edge Function — delete-account
//
// Permanently deletes the authenticated user and all their data.
// Cascade deletes defined in migrations handle: user_data, profiles,
// subscriptions, and purchase_history rows automatically.
//
// Required environment variables (injected automatically by Supabase):
//   SUPABASE_URL
//   SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Capacitor apps originate from capacitor://localhost; web deployments use the
// app domain. The JWT auth check is the real security gate — CORS is a
// browser-layer guard on top. Localhost is permitted so the web dev server
// and Vercel preview URLs can reach this function without manual config.
const STATIC_ORIGINS = new Set([
  'capacitor://localhost',
  'https://summaapp.com',
  Deno.env.get('APP_ORIGIN') ?? '',
].filter(Boolean));

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (STATIC_ORIGINS.has(origin)) return true;
  // Allow any localhost port (dev server, Vite, Storybook, etc.)
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = isAllowedOrigin(origin) ? origin! : 'capacitor://localhost';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const respond = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });

  try {
    // ── 1. Auth check ───────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return respond({ error: 'Missing authorization header' }, 401);
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return respond({ error: 'Unauthorized' }, 401);
    }

    // ── 2. Parse + validate body ────────────────────────────────────────────
    let body: { userId?: unknown };
    try {
      body = await req.json();
    } catch {
      return respond({ error: 'Invalid JSON body' }, 400);
    }

    const { userId } = body;
    if (typeof userId !== 'string' || !userId) {
      return respond({ error: 'userId is required' }, 400);
    }

    if (userId !== user.id) {
      return respond({ error: 'userId mismatch' }, 403);
    }

    // ── 3. Delete the user via service role ─────────────────────────────────
    // Cascade deletes in all migrations automatically remove: user_data,
    // profiles, subscriptions, and purchase_history for this user.
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Failed to delete user:', deleteError.message);
      return respond({ error: 'Failed to delete account' }, 500);
    }

    return respond({ success: true }, 200);
  } catch (err) {
    console.error('delete-account error:', err instanceof Error ? err.message : 'unknown');
    return respond({ error: 'Internal server error' }, 500);
  }
});
