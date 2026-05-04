import { useState } from 'react';
import useAuthStore from '../../auth/useAuthStore';
import { validateEmail } from '../../auth/validation';
import styles from './AuthForms.module.css';

interface Props {
  error: string;
  onDismiss: () => void;
}

export default function ResetErrorPanel({ error, onDismiss }: Props) {
  const { requestPasswordReset, clearResetError, loading, info: authInfo } = useAuthStore();
  const [email, setEmail] = useState('');
  const [emailErr, setEmailErr] = useState<string | null>(null);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(email);
    setEmailErr(err);
    if (err) return;
    await requestPasswordReset(email);
  };

  const handleDismiss = () => {
    clearResetError();
    onDismiss();
  };

  return (
    <form onSubmit={handleResend} className={styles.form} noValidate>
      <h1 className={styles.title}>Reset link expired</h1>

      <p className={styles.hint} style={{ fontSize: 14, color: 'var(--text2)' }}>
        {error}
      </p>

      <div className={styles.field}>
        <label htmlFor="reset-error-email" className={styles.label}>Email</label>
        <input
          id="reset-error-email"
          aria-label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={e => { setEmail(e.target.value); setEmailErr(null); }}
          className={`${styles.input} ${emailErr ? styles.inputError : ''}`}
          placeholder="your@email.com"
        />
        {emailErr && <span role="alert" className={styles.errorMsg}>{emailErr}</span>}
      </div>

      {authInfo && <p role="status" className={styles.infoMsg}>{authInfo}</p>}

      <button type="submit" disabled={loading} className={styles.btnPrimary}>
        {loading ? 'Sending…' : 'Send new reset link'}
      </button>

      <p className={styles.switchText}>
        <button type="button" onClick={handleDismiss} className={styles.switchLink}>
          Back to sign in
        </button>
      </p>
    </form>
  );
}
