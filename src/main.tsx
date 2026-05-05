import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import BudgetApp from './App';
import useBudgetStore from './store/useBudgetStore';
import useAuthStore from './auth/useAuthStore';
import useSubscriptionStore from './subscription/useSubscriptionStore';
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
  const { initSubscription, resetSubscription } = useSubscriptionStore();
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
      resetSubscription();
      return;
    }
    initStore(session.user.id);
    initSubscription(session.user.id);
  }, [session, initStore, resetStore, initSubscription, resetSubscription]);

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
