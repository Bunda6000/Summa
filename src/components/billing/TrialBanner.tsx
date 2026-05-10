import useSubscriptionStore from "../../subscription/useSubscriptionStore";
import useBillingStore from "../../store/useBillingStore";
import styles from "./TrialBanner.module.css";

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

function daysRemaining(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  userId: string;
}

/**
 * Renders a persistent info banner when the user is in an active free trial.
 * Shows trial start/end dates, days remaining, and a Subscribe Now button
 * that triggers the same Google Play purchase flow as the Upgrade button.
 *
 * Returns null when the user is not in a trial.
 */
export default function TrialBanner({ userId }: Props) {
  const rawStatus = useSubscriptionStore((state) => state.rawStatus);
  const trialEndsAt = useSubscriptionStore((state) => state.trialEndsAt);
  const trialStartedAt = useSubscriptionStore((state) => state.trialStartedAt);
  const purchase = useBillingStore((state) => state.purchase);
  const billingStatus = useBillingStore((state) => state.status);

  if (rawStatus !== "trial") return null;

  const days = trialEndsAt ? daysRemaining(trialEndsAt) : null;
  const daysLabel =
    days === null
      ? "Your free trial is active."
      : days === 1
        ? "1 day remaining in your free trial."
        : `${days} days remaining in your free trial.`;

  return (
    <div role="alert" className={styles.banner}>
      <div className={styles.inner}>
        <span className={styles.icon} aria-hidden="true">
          🎁
        </span>
        <div className={styles.text}>
          <p className={styles.headline}>Free trial active</p>
          <p className={styles.body}>
            {daysLabel}
            {trialStartedAt && trialEndsAt
              ? ` Started ${fmtDate(trialStartedAt)} · Ends ${fmtDate(trialEndsAt)}.`
              : trialEndsAt
                ? ` Ends ${fmtDate(trialEndsAt)}.`
                : ""}
          </p>
        </div>
        <button
          className={styles.subscribeBtn}
          onClick={() => purchase(userId)}
          disabled={billingStatus === "purchasing"}
        >
          {billingStatus === "purchasing" ? "Processing…" : "Subscribe Now"}
        </button>
      </div>
    </div>
  );
}
