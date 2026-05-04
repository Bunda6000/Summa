import { useState } from 'react';
import useAuthStore from '../../auth/useAuthStore';
import { validatePassword } from '../../auth/validation';
import styles from './AuthForms.module.css';

export default function ResetPasswordForm() {
  const { updatePassword, loading, error } = useAuthStore();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordErr, setPasswordErr] = useState<string | null>(null);
  const [confirmErr, setConfirmErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pErr = validatePassword(password);
    setPasswordErr(pErr?.message ?? null);
    const cErr = password !== confirm ? 'Passwords do not match.' : null;
    setConfirmErr(cErr);
    if (pErr || cErr) return;
    await updatePassword(password);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <h1 className={styles.title}>Set new password</h1>

      <div className={styles.field}>
        <label htmlFor="reset-password" className={styles.label}>New password</label>
        <input
          id="reset-password"
          aria-label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={e => { setPassword(e.target.value); setPasswordErr(null); }}
          className={`${styles.input} ${passwordErr ? styles.inputError : ''}`}
        />
        {passwordErr && <span role="alert" className={styles.errorMsg}>{passwordErr}</span>}
      </div>

      <div className={styles.field}>
        <label htmlFor="reset-confirm" className={styles.label}>Confirm password</label>
        <input
          id="reset-confirm"
          aria-label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={e => { setConfirm(e.target.value); setConfirmErr(null); }}
          className={`${styles.input} ${confirmErr ? styles.inputError : ''}`}
        />
        {confirmErr && <span role="alert" className={styles.errorMsg}>{confirmErr}</span>}
      </div>

      {error && <p role="alert" className={styles.serverError}>{error}</p>}

      <button type="submit" disabled={loading} className={styles.btnPrimary}>
        {loading ? 'Updating…' : 'Update password'}
      </button>
    </form>
  );
}
