import { useState, useEffect } from 'react';
import useProfileStore from '../../profile/useProfileStore';
import useAuthStore from '../../auth/useAuthStore';
import useBillingStore from '../../store/useBillingStore';
import useSubscriptionStore from '../../subscription/useSubscriptionStore';
import ConfirmDialog from './ConfirmDialog';
import styles from './AccountModal.module.css';

interface Props {
  onClose: () => void;
  onOpenBilling?: () => void;
}

export default function AccountModal({ onClose, onOpenBilling }: Props) {
  const { session, resendVerification, loading: authLoading, error: authError, info: authInfo } = useAuthStore();
  const { profile, loading, saving, error, loadProfile, updateDisplayName } = useProfileStore();
  const { status: billingStatus, error: billingError, purchase, openManageSubscription, clearError } = useBillingStore();
  const { rawStatus, currentPeriodEnd } = useSubscriptionStore();

  const [displayName, setDisplayName] = useState('');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [downgradeDialogOpen, setDowngradeDialogOpen] = useState(false);

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

  const handleManageSubscription = async () => {
    await openManageSubscription();
  };

  const planLabel = profile?.plan === 'paid' ? 'Paid' : 'Free';
  const statusLabel =
    profile?.subscription_status === 'active'
      ? 'Active'
      : profile?.subscription_status === 'cancelled'
      ? 'Cancelled'
      : 'Past Due';

  const isPaidPlan = profile?.plan === 'paid';
  const isActiveSubscription = profile?.subscription_status === 'active';
  const isPendingCancellation = isPaidPlan && rawStatus === 'canceled';

  const expiryDateStr = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

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
              <span className={`${styles.chip} ${profile?.plan === 'paid' ? styles.chipPaid : styles.chipFree}`}>
                {planLabel}
              </span>
            </div>

            {/* Subscription status */}
            <div className={styles.field}>
              <span className={styles.label}>Subscription status</span>
              <span className={styles.value}>{statusLabel}</span>
            </div>

            {/* Pending cancellation notice */}
            {isPendingCancellation && expiryDateStr && (
              <div className={styles.field}>
                <p className={styles.hint}>Access ends on {expiryDateStr}.</p>
              </div>
            )}

            {/* Upgrade — guarded by email verification and billing state */}
            {profile?.plan === 'free' && (
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

            {/* Manage Subscription — only shown for paid users */}
            {isPaidPlan && (
              <div className={styles.field}>
                <button
                  className={styles.manageSubBtn}
                  onClick={handleManageSubscription}
                >
                  Manage Subscription
                </button>
              </div>
            )}

            {/* Change plan / downgrade via Google Play — only shown for paid users */}
            {isPaidPlan && (
              <div className={styles.field}>
                <button
                  className={styles.manageSubBtn}
                  onClick={() => setDowngradeDialogOpen(true)}
                >
                  Change plan in Google Play
                </button>
              </div>
            )}

            {/* Cancel Subscription — only for active paid subscribers without pending cancellation */}
            {isPaidPlan && isActiveSubscription && !isPendingCancellation && (
              <div className={styles.field}>
                <button
                  className={styles.manageSubBtn}
                  onClick={() => setCancelDialogOpen(true)}
                >
                  Cancel Subscription
                </button>
              </div>
            )}

            {/* Billing & Receipts — available to all users */}
            {onOpenBilling && (
              <div className={styles.field}>
                <button
                  className={styles.manageSubBtn}
                  onClick={onOpenBilling}
                >
                  Billing &amp; Receipts
                </button>
              </div>
            )}

            {/* Billing error / cancellation message */}
            {billingError && (
              <p className={styles.errorMsg}>{billingError}</p>
            )}

            {error && <p className={styles.errorMsg}>{error}</p>}

            <button
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      </div>

      {cancelDialogOpen && (
        <ConfirmDialog
          title="Cancel Subscription?"
          message="Your subscription will remain active until the end of the billing period. To cancel, you'll be taken to Google Play."
          confirmLabel="Go to Google Play"
          onConfirm={async () => {
            setCancelDialogOpen(false);
            await openManageSubscription();
          }}
          onCancel={() => setCancelDialogOpen(false)}
        />
      )}

      {downgradeDialogOpen && (
        <ConfirmDialog
          title="Change Plan?"
          message="To change your plan, you'll be taken to Google Play."
          confirmLabel="Go to Google Play"
          onConfirm={async () => {
            setDowngradeDialogOpen(false);
            await openManageSubscription();
          }}
          onCancel={() => setDowngradeDialogOpen(false)}
        />
      )}
    </div>
  );
}
