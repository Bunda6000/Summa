import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import useSubscriptionStore from '../subscription/useSubscriptionStore';
import { shouldSync } from './syncHelpers';
import type { AppData } from '../types';

const DEBOUNCE_MS = 2000;
const RETRY_DELAYS_MS = [1000, 2000, 4000];
const MAX_RETRIES = RETRY_DELAYS_MS.length;

interface PendingPayload {
  userId: string;
  data: AppData;
}

interface SyncState {
  syncStatus: 'idle' | 'syncing' | 'error';
  syncError: string | null;
  lastSyncAt: string | null;
  pendingSync: boolean;

  scheduleSync: (userId: string, data: AppData) => void;
  flushPendingSync: () => Promise<void>;
  clearSyncError: () => void;
  cancelPendingSync: () => void;
}

let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
let _retryTimer: ReturnType<typeof setTimeout> | null = null;
let _retryCount = 0;
let _pendingPayload: PendingPayload | null = null;

async function performSync(payload: PendingPayload, attempt = 0): Promise<void> {
  const { error } = await supabase
    .from('user_data')
    .upsert({ user_id: payload.userId, data: payload.data });

  if (!error) {
    _retryCount = 0;
    _pendingPayload = null;
    useSyncStore.setState({ syncStatus: 'idle', syncError: null, lastSyncAt: new Date().toISOString(), pendingSync: false });
    return;
  }

  if (attempt < MAX_RETRIES - 1) {
    _retryTimer = setTimeout(() => performSync(payload, attempt + 1), RETRY_DELAYS_MS[attempt]);
  } else {
    _retryCount = 0;
    useSyncStore.setState({ syncStatus: 'error', syncError: error.message ?? 'Sync failed' });
  }
}

const useSyncStore = create<SyncState>()((set) => ({
  syncStatus: 'idle',
  syncError: null,
  lastSyncAt: null,
  pendingSync: false,

  scheduleSync: (userId, data) => {
    const tier = useSubscriptionStore.getState().tier;
    if (!shouldSync(tier)) return;

    _pendingPayload = { userId, data };

    if (_debounceTimer) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(async () => {
      _debounceTimer = null;

      if (!navigator.onLine) {
        set({ pendingSync: true });
        return;
      }

      set({ syncStatus: 'syncing' });
      await performSync({ userId, data });
    }, DEBOUNCE_MS);
  },

  flushPendingSync: async () => {
    if (!_pendingPayload) return;
    const payload = _pendingPayload;
    useSyncStore.setState({ syncStatus: 'syncing' });
    await performSync(payload);
  },

  clearSyncError: () => set({ syncStatus: 'idle', syncError: null }),

  cancelPendingSync: () => {
    if (_debounceTimer) { clearTimeout(_debounceTimer); _debounceTimer = null; }
    if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
    _pendingPayload = null;
    _retryCount = 0;
  },
}));

// Auto-flush queued changes when connectivity is restored.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (useSyncStore.getState().pendingSync) {
      useSyncStore.getState().flushPendingSync();
    }
  });
}

export default useSyncStore;
