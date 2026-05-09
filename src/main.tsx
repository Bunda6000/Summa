import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import BudgetApp from './App';
import useBudgetStore from './store/useBudgetStore';
import useAuthStore from './auth/useAuthStore';
import useSubscriptionStore from './subscription/useSubscriptionStore';
import AuthScreen from './components/auth/AuthScreen';
import MigrationScreen from './components/migration/MigrationScreen';
import { detectLegacyData } from './migration/migrateLocalData';
import type { AppData } from './types';

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
  const [migrationPending, setMigrationPending] = useState(false);
  const [legacyData, setLegacyData] = useState<AppData | null>(null);
  const migrationChecked = useRef(false);

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
      migrationChecked.current = false;  // reset on sign-out for fresh sign-in
      return;
    }
    if (migrationChecked.current) return;
    migrationChecked.current = true;
    detectLegacyData().then(data => {
      if (data) {
        setLegacyData(data);
        setMigrationPending(true);
      }
    });
  }, [session]);

  useEffect(() => {
    if (!session) {
      resetStore();
      resetSubscription();
      return;
    }
    if (migrationPending) return;
    initStore(session.user.id);
    initSubscription(session.user.id);
  }, [session, migrationPending, initStore, resetStore, initSubscription, resetSubscription]);

  // _winner already persisted by runMigration; initStore re-hydrates from local storage
  const handleMigrationComplete = (_winner: AppData) => {
    setMigrationPending(false);
    setLegacyData(null);
  };

  const handleMigrationSkip = () => {
    setMigrationPending(false);
    setLegacyData(null);
  };

  if (!authReady) return null;
  if (!session) return <AuthScreen />;
  if (migrationPending && legacyData) {
    return (
      <MigrationScreen
        userId={session.user.id}
        legacyData={legacyData}
        onComplete={handleMigrationComplete}
        onSkip={handleMigrationSkip}
      />
    );
  }
  if (!initialized) return null;
  return <BudgetApp />;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
