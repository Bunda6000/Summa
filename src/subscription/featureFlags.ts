export type SubscriptionStatus =
  | "free"
  | "active"
  | "trial"
  | "grace_period"
  | "expired"
  | "canceled";

/** Computed access tier derived from raw DB row fields. */
export type SubscriptionTier =
  | "free"
  | "active"
  | "trial"
  | "grace_period"
  | "expired"
  | "canceled";

export type FeatureTier = "free" | "paid";

export type FeatureKey =
  | "budget_view"
  | "loans_view"
  | "dashboard_overview"
  | "cloud_sync";

export const FEATURE_FLAGS: Record<FeatureKey, FeatureTier> = {
  dashboard_overview: "free",
  budget_view: "paid",
  loans_view: "paid",
  cloud_sync: "paid",
};

/**
 * Derives the effective access tier from raw subscription DB fields.
 * Pure function — no side effects, easy to unit test.
 */
export function computeAccessTier(
  rawStatus: SubscriptionStatus | null,
  currentPeriodEnd: string | null,
  gracePeriodEnd: string | null,
  trialEndsAt: string | null = null,
  now: Date = new Date(),
): SubscriptionTier {
  if (!rawStatus || rawStatus === "free") return "free";
  if (rawStatus === "canceled") return "canceled";
  if (rawStatus === "expired") return "expired";

  if (rawStatus === "trial") {
    const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null;
    return trialEnd && trialEnd > now ? "trial" : "expired";
  }

  const periodEnd = currentPeriodEnd ? new Date(currentPeriodEnd) : null;
  const graceEnd = gracePeriodEnd ? new Date(gracePeriodEnd) : null;

  if (periodEnd && periodEnd > now) return "active";
  if (graceEnd && graceEnd > now) return "grace_period";
  return "expired";
}

/** Returns true if a user at the given tier may access the given feature. */
export function isFeatureAllowed(
  tier: SubscriptionTier,
  featureKey: FeatureKey,
): boolean {
  const featureTier = FEATURE_FLAGS[featureKey];
  if (featureTier === "free") return true;
  return tier === "active" || tier === "trial" || tier === "grace_period";
}
