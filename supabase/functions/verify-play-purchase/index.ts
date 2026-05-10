// Supabase Edge Function — verify-play-purchase
//
// Called by the client after a Google Play purchase (or trial) is approved.
// Flow:
//   1. Validate the request (auth + body schema).
//   2. Verify the purchase token with the Google Play Developer API.
//   3. Detect whether the purchase is a free trial (paymentState === 2) or
//      a paid subscription (paymentState === 1).
//   4. Upsert the subscription record (service_role, bypasses RLS).
//      - Trial:   status='trial',  trial_started_at=now, trial_ends_at=expiryTime
//      - Paid:    status='active', current_period_end=expiryTime
//   5. Update profiles.plan only for paid purchases (stays 'free' during trial).
//   6. Return { plan: 'paid' } for paid, { plan: 'trial' } for trial.
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
  // 0 = payment pending, 1 = payment received, 2 = free trial, 3 = deferred upgrade
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

    if (
      typeof token !== 'string' || !token ||
      typeof productId !== 'string' || !productId ||
      typeof userId !== 'string' || !userId
    ) {
      return json({ error: 'token, productId, and userId are required' }, 400);
    }

    if (userId !== user.id) {
      return json({ error: 'userId mismatch' }, 403);
    }

    // ── 3. Verify token with Google Play Developer API ─────────────────────
    const saJson = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
    const packageName = Deno.env.get('PLAY_PACKAGE_NAME') ?? 'com.budgetplanner.app';

    let expiryDate: Date | null = null;
    let isTrial = false;

    if (saJson) {
      const accessToken = await getGoogleAccessToken(saJson);
      const info = await verifyPlayToken(packageName, productId, token, accessToken);

      // paymentState 0 = payment still pending — reject
      if (info.paymentState === 0) {
        return json({ error: 'Payment not yet received' }, 402);
      }

      // paymentState 2 = free trial (no charge yet)
      isTrial = info.paymentState === 2;

      if (info.expiryTimeMillis) {
        expiryDate = new Date(parseInt(info.expiryTimeMillis, 10));
      }
    }
    // Without service account credentials (local dev / test), skip Play
    // verification and treat the purchase as a regular paid subscription.

    // ── 4. Persist with service_role ───────────────────────────────────────
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const now = new Date().toISOString();

    const subscriptionRow = isTrial
      ? {
          user_id: userId,
          status: 'trial',
          purchase_token: token,
          product_id: productId,
          order_id: typeof orderId === 'string' ? orderId : '',
          current_period_end: null,
          grace_period_end: null,
          trial_started_at: now,
          trial_ends_at: expiryDate?.toISOString() ?? null,
        }
      : {
          user_id: userId,
          status: 'active',
          purchase_token: token,
          product_id: productId,
          order_id: typeof orderId === 'string' ? orderId : '',
          current_period_end: expiryDate?.toISOString() ?? null,
          grace_period_end: null,
          trial_started_at: null,
          trial_ends_at: null,
        };

    const { error: subError } = await adminClient
      .from('subscriptions')
      .upsert(subscriptionRow, { onConflict: 'user_id' });

    if (subError) {
      console.error('Failed to upsert subscription:', subError);
      return json({ error: 'Failed to record subscription' }, 500);
    }

    // Record purchase history (idempotent on purchase_token)
    const { error: historyError } = await adminClient.from('purchase_history').upsert(
      {
        user_id: userId,
        order_id: typeof orderId === 'string' ? orderId : '',
        product_id: productId,
        purchase_token: token,
        status: 'purchased',
        purchased_at: now,
        expires_at: expiryDate?.toISOString() ?? null,
      },
      { onConflict: 'purchase_token' },
    );

    if (historyError) {
      console.warn('Failed to record purchase history:', historyError);
    }

    // ── 5. Update profile ──────────────────────────────────────────────────
    // During a trial, profiles.plan stays 'free' — the user hasn't paid yet.
    // Only paid purchases upgrade the plan.
    if (!isTrial) {
      const { error: profileError } = await adminClient
        .from('profiles')
        .update({
          plan: 'paid',
          subscription_status: 'active',
          renewal_date: expiryDate?.toISOString() ?? null,
        })
        .eq('user_id', userId);

      if (profileError) {
        console.error('Failed to update profile:', profileError);
        return json({ error: 'Failed to update plan' }, 500);
      }
    }

    // ── 6. Respond ─────────────────────────────────────────────────────────
    return json({ plan: isTrial ? 'trial' : 'paid' }, 200);
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
