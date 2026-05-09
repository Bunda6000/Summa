import { useState, useLayoutEffect, useRef } from 'react';
import { animatePixelsFromEdges, prefersReducedMotion } from '../../lib/pixelAnimation';
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
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const rafId = requestAnimationFrame(() => {
      if (!innerRef.current) return;
      const inner = innerRef.current;
      const rect = inner.getBoundingClientRect();
      inner.style.opacity = '0';
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9997;';
      document.body.appendChild(container);
      animatePixelsFromEdges(rect, container).then(() => {
        document.body.removeChild(container);
        if (innerRef.current) {
          innerRef.current.style.transition = 'opacity 0.15s';
          innerRef.current.style.opacity = '1';
        }
      });
    });
    return () => cancelAnimationFrame(rafId);
  }, []);

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
      <div ref={innerRef} className={styles.inner} style={{ maxWidth: 440, margin: '0 auto' }}>
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
