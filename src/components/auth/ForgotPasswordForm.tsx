import { useState } from 'react';
import useAuthStore from '../../auth/useAuthStore';
import { validateEmail } from '../../auth/validation';
import styles from './AuthForms.module.css';

interface Props {
  onSwitchToSignIn: () => void;
}

export default function ForgotPasswordForm({ onSwitchToSignIn }: Props) {
  const { requestPasswordReset, loading, info } = useAuthStore();
  const [email, setEmail] = useState('');
  const [emailErr, setEmailErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(email);
    setEmailErr(err);
    if (err) return;
    await requestPasswordReset(email);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <h1 className={styles.title}>Forgot password?</h1>

      <p className={styles.hint}>
        Enter your email — we&apos;ll send a reset link if an account exists.
      </p>

      <div className={styles.field}>
        <label htmlFor="forgot-email" className={styles.label}>Email</label>
        <input
          id="forgot-email"
          aria-label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={e => { setEmail(e.target.value); setEmailErr(null); }}
          className={`${styles.input} ${emailErr ? styles.inputError : ''}`}
        />
        {emailErr && <span role="alert" className={styles.errorMsg}>{emailErr}</span>}
      </div>

      {info && <p role="status" className={styles.infoMsg}>{info}</p>}

      <button type="submit" disabled={loading} className={styles.btnPrimary}>
        {loading ? 'Sending…' : 'Send reset link'}
      </button>

      <p className={styles.switchText}>
        <button type="button" onClick={onSwitchToSignIn} className={styles.switchLink}>
          Back to sign in
        </button>
      </p>
    </form>
  );
}
