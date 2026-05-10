import useSyncStore from '../store/useSyncStore';

export default function SyncStatusIndicator() {
  const { syncStatus, syncError, clearSyncError } = useSyncStore();

  if (syncStatus !== 'error') return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        background: 'var(--color-error, #c0392b)',
        color: '#fff',
        borderRadius: '0.5rem',
        padding: '0.5rem 1rem',
        fontSize: '0.85rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        zIndex: 9999,
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      }}
    >
      <span>Sync failed{syncError ? `: ${syncError}` : ''}. Will retry when online.</span>
      <button
        onClick={clearSyncError}
        aria-label="Dismiss sync error"
        style={{
          background: 'none',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '1rem',
          lineHeight: 1,
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
