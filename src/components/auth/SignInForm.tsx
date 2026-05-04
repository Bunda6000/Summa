import { useState } from 'react';
import useAuthStore from '../../auth/useAuthStore';
import { validateEmail } from '../../auth/validation';
import styles from './AuthForms.module.css';

interface Props {
  onSwitchToSignUp: () => void;
  onForgotPassword: () => void;
}

export default function SignInForm({ onSwitchToSignUp, onForgotPassword }: Props) {
  const { signIn, loading, error, lockedUntil } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailErr, setEmailErr] = useState<string | null>(null);

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const eErr = validateEmail(email);
    setEmailErr(eErr);
    if (eErr) return;
    await signIn(email, password);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <h1 className={styles.title}>Sign in, Please</h1>

      <div className={styles.field}>
        <label htmlFor="signin-email" className={styles.label}>Email</label>
        <input
          id="signin-email"
          aria-label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={e => { setEmail(e.target.value); setEmailErr(null); }}
          className={`${styles.input} ${emailErr ? styles.inputError : ''}`}
          disabled={isLocked}
        />
        {emailErr && <span role="alert" className={styles.errorMsg}>{emailErr}</span>}
      </div>

      <div className={styles.field}>
        <label htmlFor="signin-password" className={styles.label}>Password</label>
        <input
          id="signin-password"
          aria-label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className={styles.input}
          disabled={isLocked}
        />
        <button type="button" onClick={onForgotPassword} className={styles.switchLink}>
          Forgot password?
        </button>
      </div>

      {isLocked && (
        <p role="alert" className={styles.serverError}>
          Temporarily blocked due to too many failed attempts. Please wait before trying again.
        </p>
      )}
      {!isLocked && error && (
        <p role="alert" className={styles.serverError}>{error}</p>
      )}

      <button type="submit" disabled={loading || isLocked} className={styles.btnPrimary}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>

      <p className={styles.switchText}>
        Don&apos;t have an account?{' '}
        <button type="button" onClick={onSwitchToSignUp} className={styles.switchLink}>
          Create account
        </button>
      </p>
    </form>
  );
}
