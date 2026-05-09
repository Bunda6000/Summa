import useSubscriptionStore from "../../subscription/useSubscriptionStore";
import useBillingStore from "../../store/useBillingStore";
import styles from "./GracePeriodBanner.module.css";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a persistent warning banner when the user's subscription is in
 * grace period. The user retains full paid access until grace_period_end
 * but is prompted to fix their payment method via Google Play.
 *
 * Returns null when the subscription is healthy (active, free, etc.).
 */
export default function GracePeriodBanner() {
  const rawStatus = useSubscriptionStore((state) => state.rawStatus);
  const gracePeriodEnd = useSubscriptionStore((state) => state.gracePeriodEnd);
  const openManageSubscription = useBillingStore(
    (state) => state.openManageSubscription,
  );

  if (rawStatus !== "grace_period") return null;

  return (
    <div role="alert" className={styles.banner}>
      <div className={styles.inner}>
        <span className={styles.icon} aria-hidden="true">
          ⚠️
        </span>
        <div className={styles.text}>
          <p className={styles.headline}>
            Payment issue — please update your billing details
          </p>
          <p className={styles.body}>
            {gracePeriodEnd
              ? `You still have full access until ${fmtDate(gracePeriodEnd)}. After that, your account will be downgraded to the free plan.`
              : "Google Play is retrying your payment. You still have full access during this grace period."}
          </p>
        </div>
        <button className={styles.fixBtn} onClick={openManageSubscription}>
          Fix Payment
        </button>
      </div>
    </div>
  );
}
