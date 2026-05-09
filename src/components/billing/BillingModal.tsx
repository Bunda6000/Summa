import { useEffect, useLayoutEffect, useRef } from "react";
import { animatePixelsFromPoint, getLastButtonRect, prefersReducedMotion, isMobile } from "../../lib/pixelAnimation";
import useProfileStore from "../../profile/useProfileStore";
import useAuthStore from "../../auth/useAuthStore";
import useSubscriptionStore from "../../subscription/useSubscriptionStore";
import useReceiptsStore from "../../store/useReceiptsStore";
import styles from "./BillingModal.module.css";

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

function statusLabel(raw: string | null): string {
  if (raw === "active") return "Active";
  if (raw === "grace_period") return "Grace Period";
  if (raw === "expired") return "Expired";
  if (raw === "canceled") return "Canceled";
  return "";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BillingModal({ onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const triggerRect = getLastButtonRect();
    if (!triggerRect || prefersReducedMotion() || isMobile()) return;
    const rafId = requestAnimationFrame(() => {
      if (!cardRef.current) return;
      const card = cardRef.current;
      const rect = card.getBoundingClientRect();
      card.style.opacity = '0';
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9997;';
      document.body.appendChild(container);
      const cx = triggerRect.left + triggerRect.width / 2;
      const cy = triggerRect.top + triggerRect.height / 2;
      animatePixelsFromPoint(cx, cy, rect, container).then(() => {
        document.body.removeChild(container);
        if (cardRef.current) {
          cardRef.current.style.transition = 'opacity 0.1s';
          cardRef.current.style.opacity = '1';
        }
      });
    });
    return () => cancelAnimationFrame(rafId);
  }, []);

  const { session } = useAuthStore();
  const { profile } = useProfileStore();
  const { rawStatus, currentPeriodEnd } = useSubscriptionStore();
  const { records, loading, error, loadReceipts, openPlayReceipt, retry } =
    useReceiptsStore();

  const userId = session?.user.id ?? "";
  const email = session?.user.email ?? "";

  useEffect(() => {
    if (userId) loadReceipts(userId);
  }, [userId, loadReceipts]);

  const isPaid = profile?.plan === "paid";
  const hasHistory = records.length > 0;
  const showEmptyState = !isPaid && !hasHistory && !loading && !error;
  const renewalDate = profile?.renewal_date ?? currentPeriodEnd ?? null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Billing"
    >
      <div ref={cardRef} className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Billing &amp; Receipts</h2>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* ── Free-user empty state ── */}
        {showEmptyState && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🧾</div>
            <p className={styles.emptyText}>
              No billing information available.
            </p>
            <p className={styles.emptyHint}>
              Upgrade to a paid plan to see your subscription details and
              receipt history here.
            </p>
          </div>
        )}

        {/* ── Billing summary (paid or has history) ── */}
        {(isPaid || hasHistory) && !error && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Subscription</h3>

            <div className={styles.field}>
              <span className={styles.label}>Plan</span>
              <span
                className={`${styles.chip} ${isPaid ? styles.chipPaid : styles.chipFree}`}
              >
                {isPaid ? "Paid" : "Free"}
              </span>
            </div>

            {rawStatus && (
              <div className={styles.field}>
                <span className={styles.label}>Status</span>
                <span
                  className={`${styles.statusChip} ${styles[`status_${rawStatus}`] ?? ""}`}
                >
                  {statusLabel(rawStatus)}
                </span>
              </div>
            )}

            <div className={styles.field}>
              <span className={styles.label}>Billing email</span>
              <span className={styles.value}>{email}</span>
            </div>

            {renewalDate && (
              <div className={styles.field}>
                <span className={styles.label}>Renewal date</span>
                <span className={styles.value}>{fmtDate(renewalDate)}</span>
              </div>
            )}
          </section>
        )}

        {/* ── Error state ── */}
        {error && (
          <div role="alert" className={styles.errorBox}>
            <p className={styles.errorText}>{error}</p>
            <button className={styles.retryBtn} onClick={retry}>
              Retry
            </button>
          </div>
        )}

        {/* ── Receipts section ── */}
        {!error && (isPaid || hasHistory) && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Payment history</h3>

            {loading && <p className={styles.loadingText}>Loading receipts…</p>}

            {!loading && records.length === 0 && (
              <p className={styles.emptyReceipts}>No payment records yet.</p>
            )}

            {!loading && records.length > 0 && (
              <div className={styles.receiptList}>
                {records.map((r) => (
                  <button
                    key={r.id}
                    className={styles.receiptRow}
                    onClick={() => openPlayReceipt(r.orderId)}
                    title="Open in Google Play"
                  >
                    <div className={styles.receiptMain}>
                      <span className={styles.receiptOrderId}>{r.orderId}</span>
                      <span className={styles.receiptDate}>
                        {fmtDate(r.purchasedAt)}
                      </span>
                    </div>
                    <span
                      className={`${styles.receiptStatus} ${r.status === "refunded" ? styles.receiptRefunded : styles.receiptPurchased}`}
                    >
                      {r.status}
                    </span>
                    <span className={styles.receiptArrow}>↗</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
