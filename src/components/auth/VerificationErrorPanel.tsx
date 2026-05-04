import { useState } from 'react';
import useAuthStore from '../../auth/useAuthStore';
import styles from './AuthForms.module.css';

interface Props {
  error: string;
  onDismiss: () => void;
}

export default function VerificationErrorPanel({ error, onDismiss }: Props) {
  const { resendVerification, loading, error: authError, info: authInfo } = useAuthStore();
  const [email, setEmail] = useState('');

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email) await resendVerification(email);
  };

  return (
    <form onSubmit={handleResend} className={styles.form} noValidate>
      <h1 className={styles.title}>Verification link expired</h1>

      <p className={styles.hint} style={{ fontSize: 14, color: 'var(--text2)' }}>
        {error}
      </p>

      <div className={styles.field}>
        <label htmlFor="resend-email" className={styles.label}>Email</label>
        <input
          id="resend-email"
          aria-label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className={styles.input}
          placeholder="your@email.com"
        />
      </div>

      {authInfo && <p role="status" className={styles.infoMsg}>{authInfo}</p>}
      {authError && <p role="alert" className={styles.serverError}>{authError}</p>}

      <button type="submit" disabled={loading || !email} className={styles.btnPrimary}>
        {loading ? 'Sending…' : 'Resend verification email'}
      </button>

      <p className={styles.switchText}>
        <button type="button" onClick={onDismiss} className={styles.switchLink}>
          Back to sign in
        </button>
      </p>
    </form>
  );
}
