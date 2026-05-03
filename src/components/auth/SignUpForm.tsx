import { useState } from 'react';
import useAuthStore from '../../auth/useAuthStore';
import { validateEmail, validatePassword } from '../../auth/validation';
import styles from './AuthForms.module.css';

interface Props {
  onSwitchToSignIn: () => void;
}

export default function SignUpForm({ onSwitchToSignIn }: Props) {
  const { signUp, loading, error, info } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailErr(eErr);
    setPasswordErr(pErr?.message ?? null);
    if (eErr || pErr) return;
    await signUp(email, password);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <h1 className={styles.title}>Create account</h1>

      <div className={styles.field}>
        <label htmlFor="signup-email" className={styles.label}>Email</label>
        <input
          id="signup-email"
          aria-label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={e => { setEmail(e.target.value); setEmailErr(null); }}
          className={`${styles.input} ${emailErr ? styles.inputError : ''}`}
        />
        {emailErr && <span role="alert" className={styles.errorMsg}>{emailErr}</span>}
      </div>

      <div className={styles.field}>
        <label htmlFor="signup-password" className={styles.label}>Password</label>
        <input
          id="signup-password"
          aria-label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={e => { setPassword(e.target.value); setPasswordErr(null); }}
          className={`${styles.input} ${passwordErr ? styles.inputError : ''}`}
        />
        {passwordErr && <span role="alert" className={styles.errorMsg}>{passwordErr}</span>}
        <span className={styles.hint}>Min 8 characters, one uppercase letter, one number.</span>
      </div>

      {info && <p role="status" className={styles.infoMsg}>{info}</p>}
      {error && <p role="alert" className={styles.serverError}>{error}</p>}

      <button type="submit" disabled={loading} className={styles.btnPrimary}>
        {loading ? 'Creating…' : 'Create account'}
      </button>

      <p className={styles.switchText}>
        Already have an account?{' '}
        <button type="button" onClick={onSwitchToSignIn} className={styles.switchLink}>
          Sign in
        </button>
      </p>
    </form>
  );
}
