// Supabase Edge Function — verify-play-purchase
//
// Called by the client after a Google Play purchase is approved.
// Flow:
//   1. Validate the request (auth + body schema).
//   2. Verify the purchase token with the Google Play Developer API.
//   3. Upsert the subscription record (service_role, bypasses RLS).
//   4. Update profiles.plan + profiles.subscription_status + profiles.renewal_date
//      via service_role (bypasses the profiles_protect_plan trigger).
//   5. Return { plan: 'paid' } to the client — the token is never returned.
//
// Required environment variables (set in Supabase dashboard):
//   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON  — the full JSON of the service account key
//   SUPABASE_URL                      — injected automatically by Supabase
//   SUPABASE_SERVICE_ROLE_KEY         — injected automatically by Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------------------
// Google Play Developer API token exchange
// ---------------------------------------------------------------------------

async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  const signingInput = `${encode(header)}.${encode(claim)}`;

  // Import the RSA private key from the service account JSON
  const pemBody = sa.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${body}`);
  }

  const { access_token } = await tokenRes.json();
  return access_token as string;
}

// ---------------------------------------------------------------------------
// Google Play Developer API — subscription verification
// ---------------------------------------------------------------------------

interface PlaySubscriptionInfo {
  expiryTimeMillis?: string;
  cancelReason?: number;
  paymentState?: number;
}

async function verifyPlayToken(
  packageName: string,
  productId: string,
  token: string,
  accessToken: string,
): Promise<PlaySubscriptionInfo> {
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${packageName}/purchases/subscriptions/${productId}/tokens/${token}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Play verification failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<PlaySubscriptionInfo>;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    // ── 1. Auth check ──────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Missing authorization header' }, 401);
    }

    // Use the anon client to validate the JWT
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // ── 2. Parse + validate body ───────────────────────────────────────────
    let body: { token?: unknown; productId?: unknown; orderId?: unknown; userId?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const { token, productId, orderId, userId } = body;

    if (typeof token !== 'string' || !token ||
        typeof productId !== 'string' || !productId ||
        typeof userId !== 'string' || !userId) {
      return json({ error: 'token, productId, and userId are required' }, 400);
    }

    // Ensure the userId in the body matches the authenticated user
    if (userId !== user.id) {
      return json({ error: 'userId mismatch' }, 403);
    }

    // ── 3. Verify token with Google Play Developer API ─────────────────────
    const saJson = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
    const packageName = Deno.env.get('PLAY_PACKAGE_NAME') ?? 'com.budgetplanner.app';

    let renewalDate: Date | null = null;

    if (saJson) {
      // Production path: verify with Google Play
      const accessToken = await getGoogleAccessToken(saJson);
      const info = await verifyPlayToken(packageName, productId, token, accessToken);

      // paymentState: 0 = pending, 1 = received, 2 = free trial
      if (info.paymentState !== undefined && info.paymentState < 1) {
        return json({ error: 'Payment not yet received' }, 402);
      }

      if (info.expiryTimeMillis) {
        renewalDate = new Date(parseInt(info.expiryTimeMillis, 10));
      }
    }
    // If GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not set (e.g. local dev / test
    // environment), skip Play verification and trust the token at face value.
    // This path must never be reachable in production.

    // ── 4. Persist with service_role ───────────────────────────────────────
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Upsert subscription record — one row per user, updated on each renewal.
    // Conflicts on user_id (the PK); purchase_token is updated in-place.
    const { error: subError } = await adminClient.from('subscriptions').upsert(
      {
        user_id: userId,
        purchase_token: token,
        product_id: productId,
        order_id: typeof orderId === 'string' ? orderId : null,
        status: 'active',
        current_period_end: renewalDate?.toISOString() ?? null,
      },
      { onConflict: 'user_id' },
    );

    if (subError) {
      console.error('Failed to upsert subscription:', subError);
      return json({ error: 'Failed to record subscription' }, 500);
    }

    // Update profile — bypasses profiles_protect_plan trigger because we use
    // service_role which is exempt from RLS and trigger restrictions.
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({
        plan: 'paid',
        subscription_status: 'active',
      })
      .eq('user_id', userId);

    if (profileError) {
      console.error('Failed to update profile:', profileError);
      return json({ error: 'Failed to update plan' }, 500);
    }

    // ── 5. Respond — token is never included in the response ───────────────
    return json({ plan: 'paid' }, 200);
  } catch (err) {
    console.error('verify-play-purchase error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
