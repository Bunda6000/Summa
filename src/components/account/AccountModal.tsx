import { useState, useEffect, type ChangeEvent } from 'react';
import useProfileStore from '../../profile/useProfileStore';
import useAuthStore from '../../auth/useAuthStore';
import useBillingStore from '../../store/useBillingStore';
import useSubscriptionStore from '../../subscription/useSubscriptionStore';
import useBudgetStore from '../../store/useBudgetStore';
import ConfirmDialog from './ConfirmDialog';
import { LEGAL_URLS } from '../../constants';
import styles from './AccountModal.module.css';
import { detectLegacyData } from '../../migration/migrateLocalData';
import MigrationPanel from '../migration/MigrationPanel';
import type { AppData } from '../../types';

interface Props {
  onClose: () => void;
  onOpenBilling?: () => void;
}

export default function AccountModal({ onClose, onOpenBilling }: Props) {
  const { session, signOut, resendVerification, deleteAccount, updateEmail, clearEmailStatus, loading: authLoading, error: authError, info: authInfo, emailSuccess, emailError } = useAuthStore();
  const { profile, loading, saving, error, loadProfile, updateDisplayName } = useProfileStore();
  const { status: billingStatus, error: billingError, purchase, openManageSubscription, clearError } = useBillingStore();

  const userId = session?.user.id ?? '';
  const email = session?.user.email ?? '';
  const isEmailVerified = !!session?.user.email_confirmed_at;

  const [emailInput, setEmailInput] = useState(email);
  const [displayName, setDisplayName] = useState('');
  const [migrateLegacy, setMigrateLegacy] = useState<AppData | null>(null);
  const [showMigrationPanel, setShowMigrationPanel] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [downgradeDialogOpen, setDowngradeDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (userId) loadProfile(userId);
  }, [userId, loadProfile]);

  useEffect(() => {
    detectLegacyData().then(data => setMigrateLegacy(data));
  }, []);

  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name);
  }, [profile?.display_name]);

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmailInput(e.target.value);
    if (emailSuccess || emailError) clearEmailStatus();
  };

  const handleUpdateEmail = async () => {
    const trimmed = emailInput.trim();
    if (!trimmed || trimmed === email) return;
    await updateEmail(trimmed);
  };

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

            {/* Email — editable */}
            <div className={styles.field}>
              <label htmlFor="email" className={styles.label}>Email</label>
              <input
                id="email"
                aria-label="Email"
                type="email"
                value={emailInput}
                onChange={handleEmailChange}
                className={styles.input}
                disabled={authLoading}
              />
              <span className={styles.hint}>
                A confirmation email will be sent to verify the new address.
              </span>
              {emailSuccess && <p className={styles.successMsg}>{emailSuccess}</p>}
              {emailError && <p className={styles.verifyError}>{emailError}</p>}
              <button
                className={styles.updateEmailBtn}
                onClick={handleUpdateEmail}
                disabled={authLoading || !emailInput.trim() || emailInput.trim() === email}
              >
                {authLoading ? 'Updating…' : 'Update Email'}
              </button>
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

            {/* Logout */}
            <button
              className={styles.logoutBtn}
              onClick={signOut}
            >
              Log Out
            </button>

            {/* Delete account — danger zone */}
            <div className={styles.dangerZone}>
              <button
                className={styles.deleteBtn}
                onClick={() => setDeleteDialogOpen(true)}
              >
                Delete Account
              </button>
            </div>

            {/* Legal links */}
            <p className={styles.legalText}>
              <a
                href={LEGAL_URLS.privacy}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.legalLink}
              >
                Privacy Policy
              </a>
              {' · '}
              <a
                href={LEGAL_URLS.terms}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.legalLink}
              >
                Terms of Service
              </a>
            </p>
          </>
        )}
      </div>

      {cancelDialogOpen && (
        <ConfirmDialog
          title="Cancel Subscription?"
          message="Your subscription will remain active until the end of the billing period. To cancel, you'll be taken to Google Play."
          confirmLabel="Go to Google Play"
          cancelLabel="Keep Subscription"
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
          cancelLabel="Keep Plan"
          onConfirm={async () => {
            setDowngradeDialogOpen(false);
            await openManageSubscription();
          }}
          onCancel={() => setDowngradeDialogOpen(false)}
        />
      )}

      {deleteDialogOpen && (
        <ConfirmDialog
          title="Delete Account?"
          message="This will permanently delete your account and all your data. This action cannot be undone."
          confirmLabel="Delete Forever"
          onConfirm={async () => {
            setDeleteDialogOpen(false);
            await deleteAccount();
            if (!useAuthStore.getState().error) onClose();
          }}
          onCancel={() => setDeleteDialogOpen(false)}
        />
      )}
    </div>
  );
}
