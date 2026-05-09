import { useState, useEffect } from 'react';
import useProfileStore from '../../profile/useProfileStore';
import useAuthStore from '../../auth/useAuthStore';
import useBillingStore from '../../store/useBillingStore';
import useBudgetStore from '../../store/useBudgetStore';
import styles from './AccountModal.module.css';
import { detectLegacyData } from '../../migration/migrateLocalData';
import MigrationPanel from '../migration/MigrationPanel';
import type { AppData } from '../../types';

interface Props {
  onClose: () => void;
  onOpenBilling?: () => void;
}

export default function AccountModal({ onClose, onOpenBilling }: Props) {
  const { session, resendVerification, loading: authLoading, error: authError, info: authInfo } = useAuthStore();
  const { profile, loading, saving, error, loadProfile, updateDisplayName } = useProfileStore();
  const { status: billingStatus, error: billingError, purchase, openManageSubscription, clearError } = useBillingStore();

  const [displayName, setDisplayName] = useState('');
  const [migrateLegacy, setMigrateLegacy] = useState<AppData | null>(null);
  const [showMigrationPanel, setShowMigrationPanel] = useState(false);

  useEffect(() => {
    detectLegacyData().then(setMigrateLegacy);
  }, []);

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

            {migrateLegacy && !showMigrationPanel && (
              <section style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Offline Data</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                  You have local data that hasn't been imported yet.
                </p>
                <button
                  onClick={() => setShowMigrationPanel(true)}
                  style={{ fontSize: 13, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Migrate offline data →
                </button>
              </section>
            )}
            {migrateLegacy && showMigrationPanel && (
              <section style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <MigrationPanel
                  userId={userId}
                  legacyData={migrateLegacy}
                  onComplete={async () => {
                    setMigrateLegacy(null);
                    setShowMigrationPanel(false);
                    useBudgetStore.getState().resetStore();
                    if (userId) await useBudgetStore.getState().initStore(userId);
                  }}
                  onSkip={() => setShowMigrationPanel(false)}
                />
              </section>
            )}

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
            {profile?.plan === 'paid' && (
              <div className={styles.field}>
                <button
                  className={styles.manageSubBtn}
                  onClick={handleManageSubscription}
                >
                  Manage Subscription
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
    </div>
  );
}
