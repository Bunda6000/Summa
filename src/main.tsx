import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import BudgetApp from './App';
import useBudgetStore from './store/useBudgetStore';
import useAuthStore from './auth/useAuthStore';
import useSubscriptionStore from './subscription/useSubscriptionStore';
import AuthScreen from './components/auth/AuthScreen';
import MigrationScreen from './components/migration/MigrationScreen';
import MonitoringPage from './components/monitoring/MonitoringPage';
import { detectLegacyData } from './migration/migrateLocalData';
import type { AppData } from './types';

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS ?? '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

function isAdmin(email: string | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

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

  const isMonitoringRoute = typeof window !== 'undefined' && window.location.pathname === '/monitoring';

  if (!authReady) return null;

  // /monitoring is admin-only; show 404 for non-admins or unauthenticated users
  if (isMonitoringRoute) {
    if (!session || !isAdmin(session.user.email)) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)', fontFamily: 'sans-serif', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 48, fontWeight: 700 }}>404</span>
          <span style={{ fontSize: 14 }}>Page not found</span>
        </div>
      );
    }
    return <MonitoringPage />;
  }

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
