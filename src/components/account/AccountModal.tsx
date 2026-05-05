import { useState, useEffect } from 'react';
import useProfileStore from '../../profile/useProfileStore';
import useAuthStore from '../../auth/useAuthStore';
import useBillingStore from '../../store/useBillingStore';
import useSubscriptionStore from '../../subscription/useSubscriptionStore';
import ConfirmDialog from './ConfirmDialog';
import styles from './AccountModal.module.css';

interface Props {
  onClose: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AccountModal({ onClose }: Props) {
  const { session, resendVerification, loading: authLoading, error: authError, info: authInfo } = useAuthStore();
  const { profile, loading, saving, error, loadProfile, updateDisplayName } = useProfileStore();
  const { status: billingStatus, error: billingError, purchase, openManageSubscription, clearError } = useBillingStore();
  const { currentPeriodEnd } = useSubscriptionStore();

  const [displayName, setDisplayName] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(false);

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

  const handleUpgrade = async () => {
    if (!userId) return;
    clearError();
    await purchase(userId);
  };

  const handleCancelConfirmed = async () => {
    setShowCancelConfirm(false);
    await openManageSubscription();
  };

  const handleDowngradeConfirmed = async () => {
    setShowDowngradeConfirm(false);
    await openManageSubscription();
  };

  const planLabel = profile?.plan === 'paid' ? 'Paid' : 'Free';
  const statusLabel =
    profile?.subscription_status === 'active'
      ? 'Active'
      : profile?.subscription_status === 'cancelled'
      ? 'Cancelled'
      : 'Past Due';

  const isPaid = profile?.plan === 'paid';
  const isCancelled = profile?.subscription_status === 'cancelled';
  const hasPendingExpiry = isPaid && isCancelled && !!currentPeriodEnd;

  return (
    <>
      <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Account">
        <div className={styles.card}>
          <div className={styles.header}>
            <h2 className={styles.title}>Account</h2>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
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
                    {authLoading ? 'Sending…' : 'Resend verification email'}
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
                <span className={`${styles.chip} ${isPaid ? styles.chipPaid : styles.chipFree}`}>
                  {planLabel}
                </span>
              </div>

              {/* Subscription status */}
              <div className={styles.field}>
                <span className={styles.label}>Subscription status</span>
                <span className={styles.value}>{statusLabel}</span>
              </div>

              {/* Pending cancellation notice */}
              {hasPendingExpiry && (
                <p className={styles.cancelNotice}>
                  Access ends on {formatDate(currentPeriodEnd!)}. You can continue using paid features until then.
                </p>
              )}

              {/* Upgrade — free users only */}
              {!isPaid && (
                <div className={styles.field}>
                  <button
                    className={styles.upgradeBtn}
                    onClick={handleUpgrade}
                    disabled={!isEmailVerified || billingStatus === 'purchasing'}
                    title={!isEmailVerified ? 'Verify your email to upgrade' : undefined}
                  >
                    {billingStatus === 'purchasing' ? 'Processing…' : 'Upgrade to Paid'}
                  </button>
                  {!isEmailVerified && (
                    <span className={styles.hint}>Email verification required to purchase a subscription.</span>
                  )}
                </div>
              )}

              {/* Paid user actions */}
              {isPaid && (
                <>
                  {/* Manage Subscription (upgrade within Play Store, view plan details) */}
                  <div className={styles.field}>
                    <button className={styles.manageSubBtn} onClick={() => openManageSubscription()}>
                      Manage Subscription
                    </button>
                  </div>

                  {/* Downgrade notice — Google Play only */}
                  <div className={styles.field}>
                    <div className={styles.downgradeNote}>
                      <span>To change your plan, use Google Play.</span>
                      <button
                        className={styles.downgradeBtn}
                        onClick={() => setShowDowngradeConfirm(true)}
                      >
                        Change plan in Google Play
                      </button>
                    </div>
                  </div>

                  {/* Cancel Subscription */}
                  {!isCancelled && (
                    <div className={styles.field}>
                      <button
                        className={styles.cancelSubBtn}
                        onClick={() => setShowCancelConfirm(true)}
                      >
                        Cancel Subscription
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Billing error / cancellation message */}
              {billingError && <p className={styles.errorMsg}>{billingError}</p>}
              {error && <p className={styles.errorMsg}>{error}</p>}

              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cancel confirmation dialog */}
      {showCancelConfirm && (
        <ConfirmDialog
          title="Cancel Subscription?"
          message={
            currentPeriodEnd
              ? `Your access continues until ${formatDate(currentPeriodEnd)}. After that you'll be moved to the free plan.`
              : 'You will lose access to paid features at the end of your billing period.'
          }
          confirmLabel="Go to Google Play"
          onConfirm={handleCancelConfirmed}
          onCancel={() => setShowCancelConfirm(false)}
        />
      )}

      {/* Downgrade confirmation dialog */}
      {showDowngradeConfirm && (
        <ConfirmDialog
          title="Change Plan?"
          message="Google Play doesn't support in-app plan changes. You'll be taken to the Google Play subscription management page."
          confirmLabel="Go to Google Play"
          onConfirm={handleDowngradeConfirmed}
          onCancel={() => setShowDowngradeConfirm(false)}
        />
      )}
    </>
  );
}
