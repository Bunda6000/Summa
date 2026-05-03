import { useState, useEffect } from 'react';
import useProfileStore from '../../profile/useProfileStore';
import useAuthStore from '../../auth/useAuthStore';
import styles from './AccountModal.module.css';

interface Props {
  onClose: () => void;
}

export default function AccountModal({ onClose }: Props) {
  const { session } = useAuthStore();
  const { profile, loading, saving, error, loadProfile, updateDisplayName } = useProfileStore();

  const [displayName, setDisplayName] = useState('');

  const userId = session?.user.id ?? '';
  const email = session?.user.email ?? '';

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
