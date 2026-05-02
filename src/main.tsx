import React from 'react';
import ReactDOM from 'react-dom/client';
import BudgetApp from './App';
import useBudgetStore from './store/useBudgetStore';

// Subscribe to dark state changes and sync <html> theme classes
useBudgetStore.subscribe(
  (state) => state.dark,
  (dark: boolean) => {
    document.documentElement.classList.toggle('theme-dark', dark);
    document.documentElement.classList.toggle('theme-light', !dark);
  }
  // Note: fireImmediately is NOT needed here — initStore() handles the initial sync
);

useBudgetStore.getState().initStore()
  .then(() => {
    ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
      <React.StrictMode>
        <BudgetApp />
      </React.StrictMode>
    );
  })
  .catch((err: unknown) => {
    console.error('App failed to initialize:', err);
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML =
        '<div style="color:#fff;background:#111;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif;padding:24px;text-align:center"><p>Failed to load Summa. Please restart the app.</p></div>';
    }
  });
