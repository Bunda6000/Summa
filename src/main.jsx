import React from 'react';
import ReactDOM from 'react-dom/client';
import BudgetApp from './App';
import useBudgetStore from './store/useBudgetStore';

// Subscribe to dark state changes and sync <html> theme classes
useBudgetStore.subscribe(
  state => state.dark,
  dark => {
    document.documentElement.classList.toggle('theme-dark', dark);
    document.documentElement.classList.toggle('theme-light', !dark);
  }
  // Note: fireImmediately is NOT needed here — initStore() handles the initial sync
);

useBudgetStore.getState().initStore().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BudgetApp />
    </React.StrictMode>
  );
});
