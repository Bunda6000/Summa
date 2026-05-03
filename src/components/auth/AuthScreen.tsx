import { useState } from 'react';
import SignInForm from './SignInForm';
import SignUpForm from './SignUpForm';
import useAuthStore from '../../auth/useAuthStore';
import styles from './AuthScreen.module.css';

export default function AuthScreen() {
  const clearError = useAuthStore(state => state.clearError);
  const [view, setView] = useState<'signin' | 'signup'>('signin');

  const switchView = (next: 'signin' | 'signup') => {
    clearError();
    setView(next);
  };

  return (
    <div className={styles.root}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <h2 className={styles.logo}>Summa</h2>
          <p className={styles.tagline}>personal finance, clearly</p>
        </div>
        {view === 'signin' ? (
          <SignInForm onSwitchToSignUp={() => switchView('signup')} />
        ) : (
          <SignUpForm onSwitchToSignIn={() => switchView('signin')} />
        )}
      </div>
    </div>
  );
}
