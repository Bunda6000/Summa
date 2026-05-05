import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import BudgetApp from './App';
import useBudgetStore from './store/useBudgetStore';
import useAuthStore from './auth/useAuthStore';
import useBillingStore from './store/useBillingStore';
import AuthScreen from './components/auth/AuthScreen';

useBudgetStore.subscribe(
  (state) => state.dark,
  (dark: boolean) => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }
);

function Root() {
  const { session, initAuth } = useAuthStore();
  const { initStore, resetStore, initialized } = useBudgetStore();
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    initAuth().then((unsubscribe) => {
      cleanup = unsubscribe;
      setAuthReady(true);
    });
    return () => cleanup?.();
  }, [initAuth]);

  useEffect(() => {
    if (!session) {
      resetStore();
      return;
    }
    initStore(session.user.id);
    // Silently restore an existing Play subscription on sign-in / reinstall.
    useBillingStore.getState().restorePurchases(session.user.id);
  }, [session, initStore, resetStore]);

  if (!authReady) return null;
  if (!session) return <AuthScreen />;
  if (!initialized) return null;
  return <BudgetApp />;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
