import { useState } from 'react';
import SignInForm from './SignInForm';
import SignUpForm from './SignUpForm';
import ForgotPasswordForm from './ForgotPasswordForm';
import ResetPasswordForm from './ResetPasswordForm';
import ResetErrorPanel from './ResetErrorPanel';
import VerificationErrorPanel from './VerificationErrorPanel';
import useAuthStore from '../../auth/useAuthStore';
import styles from './AuthScreen.module.css';

type View = 'signin' | 'signup' | 'forgot-password';

export default function AuthScreen() {
  const clearError = useAuthStore(state => state.clearError);
  const clearVerificationError = useAuthStore(state => state.clearVerificationError);
  const clearResetError = useAuthStore(state => state.clearResetError);
  const verificationError = useAuthStore(state => state.verificationError);
  const recoveryMode = useAuthStore(state => state.recoveryMode);
  const resetError = useAuthStore(state => state.resetError);
  const [view, setView] = useState<View>('signin');

  const switchView = (next: View) => {
    clearError();
    setView(next);
  };

  const handleDismissVerificationError = () => {
    clearError();
    clearVerificationError();
    setView('signin');
  };

  const handleDismissResetError = () => {
    clearError();
    clearResetError();
    setView('signin');
  };

  return (
    <div className={styles.root}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <h2 className={styles.logo}>Summa</h2>
          <p className={styles.tagline}>personal finance, clearly</p>
        </div>
        {resetError ? (
          <ResetErrorPanel error={resetError} onDismiss={handleDismissResetError} />
        ) : recoveryMode ? (
          <ResetPasswordForm />
        ) : verificationError ? (
          <VerificationErrorPanel
            error={verificationError}
            onDismiss={handleDismissVerificationError}
          />
        ) : view === 'forgot-password' ? (
          <ForgotPasswordForm onSwitchToSignIn={() => switchView('signin')} />
        ) : view === 'signin' ? (
          <SignInForm
            onSwitchToSignUp={() => switchView('signup')}
            onForgotPassword={() => switchView('forgot-password')}
          />
        ) : (
          <SignUpForm onSwitchToSignIn={() => switchView('signin')} />
        )}
      </div>
    </div>
  );
}
