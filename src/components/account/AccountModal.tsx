import { useState, useEffect } from 'react';
import useProfileStore from '../../profile/useProfileStore';
import useAuthStore from '../../auth/useAuthStore';
import SupportPanel from './SupportPanel';
import styles from './AccountModal.module.css';

interface Props {
  onClose: () => void;
}

export default function AccountModal({ onClose }: Props) {
  const { session, resendVerification, loading: authLoading, error: authError, info: authInfo } = useAuthStore();
  const { profile, loading, saving, error, loadProfile, updateDisplayName } = useProfileStore();

  const [displayName, setDisplayName] = useState('');

  const userId = session?.user.id ?? '';
  const email = session?.user.email ?? '';
  const isEmailVerified = !!session?.user.email_confirmed_at;

  useEffect(() => {
    if (userId) loadProfile(userId);
  }, [userId, loadProfile]);

  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name);
  }, [profile?.display_name]);

  const handleSave = async () => {
    if (!userId) return;
    await updateDisplayName(userId, displayName);
  };

  const handleResend = async () => {
    if (email) await resendVerification(email);
  };

  const planLabel = profile?.plan === 'paid' ? 'Paid' : 'Free';
  const statusLabel =
    profile?.subscription_status === "active"
      ? "Active"
      : profile?.subscription_status === "cancelled"
        ? "Cancelled"
        : "Past Due";

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Account">
      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.title}>Account</h2>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className={styles.loading}>Loading…</p>
        ) : (
          <>
            {/* Email verification banner */}
            {!isEmailVerified && (
              <div role="alert" className={styles.verifyBanner}>
                <p className={styles.verifyBannerText}>
                  Verify your email address to unlock all features.
                </p>
                {authInfo && <p className={styles.verifySuccess}>{authInfo}</p>}
                {authError && <p className={styles.verifyError}>{authError}</p>}
                <button
                  className={styles.resendBtn}
                  onClick={handleResend}
                  disabled={authLoading}
                >
                  {authLoading ? "Sending…" : "Resend verification email"}
                </button>
              </div>
            )}

            {/* Email — read only */}
            <div className={styles.field}>
              <span className={styles.label}>Email</span>
              <span className={styles.value}>{email}</span>
              <span className={styles.hint}>
                To change your email, re-verification is required — please contact support.
              </span>
            </div>

            {/* Display name — editable */}
            <div className={styles.field}>
              <label htmlFor="display-name" className={styles.label}>
                Display name
              </label>
              <input
                id="display-name"
                aria-label="Display name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={styles.input}
                disabled={saving}
              />
            </div>

            {/* Plan */}
            <div className={styles.field}>
              <span className={styles.label}>Plan</span>
              <span
                className={`${styles.chip} ${profile?.plan === "paid" ? styles.chipPaid : isTrial ? styles.chipTrial : styles.chipFree}`}
              >
                {planLabel}
              </span>
            </div>

            {/* Trial dates — only shown during active trial */}
            {isTrial && (
              <>
                {trialStartedAt && (
                  <div className={styles.field}>
                    <span className={styles.label}>Trial started</span>
                    <span className={styles.value}>
                      {fmtDate(trialStartedAt)}
                    </span>
                  </div>
                )}
                {trialEndsAt && (
                  <div className={styles.field}>
                    <span className={styles.label}>Trial ends</span>
                    <span className={styles.value}>{fmtDate(trialEndsAt)}</span>
                  </div>
                )}
              </>
            )}

            {/* Subscription status — only for non-trial users */}
            {!isTrial && (
              <div className={styles.field}>
                <span className={styles.label}>Subscription status</span>
                <span className={styles.value}>{statusLabel}</span>
              </div>
            )}

            {/* Trial: Subscribe Now to convert before trial ends */}
            {isTrial && (
              <div className={styles.field}>
                <button
                  className={styles.upgradeBtn}
                  onClick={handleUpgrade}
                  disabled={!isEmailVerified || billingStatus === "purchasing"}
                  title={
                    !isEmailVerified
                      ? "Verify your email to subscribe"
                      : undefined
                  }
                >
                  {billingStatus === "purchasing"
                    ? "Processing…"
                    : "Subscribe Now"}
                </button>
              </div>
            )}

            {/* Billing support — inline CTA near billing info */}
            <SupportPanel variant="billing" />

            {/* Upgrade — guarded by email verification */}
            {profile?.plan === 'free' && (
              <div className={styles.field}>
                <button
                  className={styles.upgradeBtn}
                  disabled={!isEmailVerified}
                  title={!isEmailVerified ? 'Verify your email to upgrade' : undefined}
                >
                  Upgrade to Paid
                </button>
                {!isEmailVerified && (
                  <span className={styles.hint}>
                    Email verification required to start a trial.
                  </span>
                )}
              </div>
            )}

            {error && <p className={styles.errorMsg}>{error}</p>}

            <button
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>

            {/* General support section */}
            <hr className={styles.divider} />
            <p className={styles.sectionLabel}>Support</p>
            <SupportPanel />
          </>
        )}
      </div>
    </div>
  );
}
