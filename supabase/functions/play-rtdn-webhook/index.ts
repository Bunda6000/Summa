// Supabase Edge Function — play-rtdn-webhook
//
// Receives Google Play Real-time Developer Notifications (RTDN) via Cloud
// Pub/Sub push and updates the subscription / profile tables accordingly.
//
// Google Pub/Sub push message shape:
//   { message: { data: "<base64 DeveloperNotification JSON>", ... }, ... }
//
// Required environment variables:
//   RTDN_WEBHOOK_SECRET       — shared secret checked in the ?token= query param
//   SUPABASE_URL              — injected automatically by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — injected automatically by Supabase
//   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON — optional; used to re-verify the token
//   PLAY_PACKAGE_NAME         — optional; defaults to 'com.budgetplanner.app'

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Notification type constants (mirrors src/subscription/rtdn.ts)
// Duplicated here to avoid a cross-boundary import in the Deno environment.
// ---------------------------------------------------------------------------

const NT = {
  SUBSCRIPTION_RECOVERED: 1,
  SUBSCRIPTION_RENEWED: 2,
  SUBSCRIPTION_CANCELED: 3,
  SUBSCRIPTION_PURCHASED: 4,
  SUBSCRIPTION_ON_HOLD: 5,
  SUBSCRIPTION_IN_GRACE_PERIOD: 6,
  SUBSCRIPTION_RESTARTED: 7,
  SUBSCRIPTION_PRICE_CHANGE_CONFIRMED: 8,
  SUBSCRIPTION_DEFERRED: 9,
  SUBSCRIPTION_PAUSED: 10,
  SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED: 11,
  SUBSCRIPTION_REVOKED: 12,
  SUBSCRIPTION_EXPIRED: 13,
  SUBSCRIPTION_PENDING_PURCHASE_CANCELED: 20,
} as const;

interface RtdnUpdate {
  subscriptionStatus: "active" | "canceled" | "expired" | "grace_period" | null;
  profilePlan: "paid" | "free" | null;
  profileSubscriptionStatus: "active" | "cancelled" | "past_due" | null;
}

function getSubscriptionUpdate(notificationType: number): RtdnUpdate {
  switch (notificationType) {
    case NT.SUBSCRIPTION_RECOVERED:
    case NT.SUBSCRIPTION_RESTARTED:
    case NT.SUBSCRIPTION_RENEWED:
    case NT.SUBSCRIPTION_PURCHASED:
    case NT.SUBSCRIPTION_PRICE_CHANGE_CONFIRMED:
    case NT.SUBSCRIPTION_DEFERRED:
      return {
        subscriptionStatus: "active",
        profilePlan: "paid",
        profileSubscriptionStatus: "active",
      };

    case NT.SUBSCRIPTION_CANCELED:
    case NT.SUBSCRIPTION_PENDING_PURCHASE_CANCELED:
      return {
        subscriptionStatus: "canceled",
        profilePlan: null,
        profileSubscriptionStatus: "cancelled",
      };

    case NT.SUBSCRIPTION_ON_HOLD:
    case NT.SUBSCRIPTION_PAUSED:
    case NT.SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED:
      return {
        subscriptionStatus: "grace_period",
        profilePlan: null,
        profileSubscriptionStatus: "past_due",
      };

    case NT.SUBSCRIPTION_IN_GRACE_PERIOD:
      return {
        subscriptionStatus: "grace_period",
        profilePlan: "paid",
        profileSubscriptionStatus: "past_due",
      };

    case NT.SUBSCRIPTION_REVOKED:
    case NT.SUBSCRIPTION_EXPIRED:
      return {
        subscriptionStatus: "expired",
        profilePlan: "free",
        profileSubscriptionStatus: "active",
      };

    default:
      return {
        subscriptionStatus: null,
        profilePlan: null,
        profileSubscriptionStatus: null,
      };
  }
}

// ---------------------------------------------------------------------------
// Google Play — optional re-verification for renewals
// ---------------------------------------------------------------------------

async function getGoogleAccessToken(
  serviceAccountJson: string,
): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const signingInput = `${encode(header)}.${encode(claim)}`;
  const pemBody = sa.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const jwt = `${signingInput}.${btoa(
    String.fromCharCode(...new Uint8Array(signature)),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok)
    throw new Error(`Google token exchange failed: ${await tokenRes.text()}`);
  const { access_token } = await tokenRes.json();
  return access_token as string;
}

async function fetchPlaySubscription(
  packageName: string,
  productId: string,
  token: string,
  accessToken: string,
): Promise<{ expiryTimeMillis?: string } | null> {
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${packageName}/purchases/subscriptions/${productId}/tokens/${token}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: CORS_HEADERS });

  // ── 1. Authenticate via shared secret in query string ───────────────────
  const url = new URL(req.url);
  const secret = Deno.env.get("RTDN_WEBHOOK_SECRET");
  if (secret && url.searchParams.get("token") !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  // ── 2. Parse Pub/Sub push body ───────────────────────────────────────────
  let pubsubBody: { message?: { data?: string } };
  try {
    pubsubBody = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const rawData = pubsubBody?.message?.data;
  if (!rawData) return json({ error: "Missing message.data" }, 400);

  let notification: {
    packageName?: string;
    subscriptionNotification?: {
      notificationType?: number;
      purchaseToken?: string;
      subscriptionId?: string;
    };
  };

  try {
    notification = JSON.parse(atob(rawData));
  } catch {
    return json({ error: "Failed to decode message data" }, 400);
  }

  const subNote = notification.subscriptionNotification;
  if (!subNote) {
    // Could be a test notification or other type — acknowledge and ignore.
    return json({ ok: true }, 200);
  }

  const { notificationType, purchaseToken, subscriptionId } = subNote;

  if (!purchaseToken || notificationType === undefined) {
    return json({ error: "Missing notificationType or purchaseToken" }, 400);
  }

  // ── 3. Look up user by purchase token ────────────────────────────────────
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: sub, error: lookupError } = await adminClient
    .from("subscriptions")
    .select("user_id, current_period_end")
    .eq("purchase_token", purchaseToken)
    .maybeSingle();

  if (lookupError) {
    console.error("Subscription lookup failed:", lookupError);
    return json({ error: "DB lookup failed" }, 500);
  }

  if (!sub) {
    // Unknown token — acknowledge so Pub/Sub doesn't retry indefinitely.
    console.warn(
      `play-rtdn-webhook: unknown purchase_token (first seen via RTDN)`,
    );
    return json({ ok: true }, 200);
  }

  const userId = sub.user_id as string;

  // ── 4. Map notification type → DB update ─────────────────────────────────
  const update = getSubscriptionUpdate(notificationType);

  // ── 5. Optionally re-fetch expiry / grace end from Google Play ───────────
  //
  // For renewals / recoveries: fetch the new expiryTimeMillis → current_period_end.
  // For grace period entry:    fetch expiryTimeMillis → grace_period_end (Google
  //   Play sets expiryTimeMillis to the grace period deadline in this state).
  let newPeriodEnd: string | null = null;
  let newGracePeriodEnd: string | null = null;

  const isRenewalOrRecovery =
    notificationType === NT.SUBSCRIPTION_RENEWED ||
    notificationType === NT.SUBSCRIPTION_RECOVERED;
  const isGracePeriodEntry =
    notificationType === NT.SUBSCRIPTION_IN_GRACE_PERIOD;

  const saJson = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
  if (saJson && subscriptionId && (isRenewalOrRecovery || isGracePeriodEntry)) {
    try {
      const accessToken = await getGoogleAccessToken(saJson);
      const packageName =
        Deno.env.get("PLAY_PACKAGE_NAME") ?? "com.budgetplanner.app";
      const info = await fetchPlaySubscription(
        packageName,
        subscriptionId,
        purchaseToken,
        accessToken,
      );
      if (info?.expiryTimeMillis) {
        const expiryDate = new Date(
          parseInt(info.expiryTimeMillis, 10),
        ).toISOString();
        if (isRenewalOrRecovery) {
          newPeriodEnd = expiryDate;
        } else {
          // Grace period: expiryTimeMillis is when the grace window closes.
          newGracePeriodEnd = expiryDate;
        }
      }
    } catch (err) {
      console.warn("Failed to re-verify with Google Play:", err);
    }
  }

  // ── 6. Update subscriptions table ────────────────────────────────────────
  if (update.subscriptionStatus !== null) {
    const subUpdate: Record<string, unknown> = {
      status: update.subscriptionStatus,
    };

    if (newPeriodEnd) {
      subUpdate.current_period_end = newPeriodEnd;
    }

    if (newGracePeriodEnd) {
      subUpdate.grace_period_end = newGracePeriodEnd;
    }

    // Clear grace_period_end when the subscription recovers or definitively expires.
    const shouldClearGrace =
      isRenewalOrRecovery ||
      notificationType === NT.SUBSCRIPTION_EXPIRED ||
      notificationType === NT.SUBSCRIPTION_REVOKED;
    if (shouldClearGrace) {
      subUpdate.grace_period_end = null;
    }

    const { error: subErr } = await adminClient
      .from("subscriptions")
      .update(subUpdate)
      .eq("user_id", userId);

    if (subErr) {
      console.error("Failed to update subscription:", subErr);
      return json({ error: "Failed to update subscription" }, 500);
    }
  }

  // ── 7. Update profiles table ─────────────────────────────────────────────
  const profileUpdate: Record<string, unknown> = {};
  if (update.profilePlan !== null) profileUpdate.plan = update.profilePlan;
  if (update.profileSubscriptionStatus !== null)
    profileUpdate.subscription_status = update.profileSubscriptionStatus;

  if (Object.keys(profileUpdate).length > 0) {
    const { error: profileErr } = await adminClient
      .from("profiles")
      .update(profileUpdate)
      .eq("user_id", userId);

    if (profileErr) {
      console.error("Failed to update profile:", profileErr);
      return json({ error: "Failed to update profile" }, 500);
    }
  }

  return json({ ok: true }, 200);
});
