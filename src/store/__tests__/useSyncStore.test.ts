import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../../subscription/useSubscriptionStore', () => ({
  default: {
    getState: vi.fn(),
  },
}));

import { supabase } from '../../lib/supabase';
import useSubscriptionStore from '../../subscription/useSubscriptionStore';
import useSyncStore from '../useSyncStore';
import { defaultData } from '../../constants';

function mockUpsert(result: { error: unknown }) {
  const chain = { upsert: vi.fn().mockResolvedValue(result) };
  vi.mocked(supabase.from).mockReturnValue(chain as never);
  return chain;
}

function setTier(tier: string) {
  vi.mocked(useSubscriptionStore.getState).mockReturnValue({ tier } as never);
}

const USER_ID = 'user-123';
const DATA = defaultData();

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
  useSyncStore.setState({ syncStatus: 'idle', syncError: null, lastSyncAt: null, pendingSync: false });
});

afterEach(() => {
  useSyncStore.getState().cancelPendingSync();
  vi.useRealTimers();
});

// ─── paid users ───────────────────────────────────────────────────────────────

describe('scheduleSync — paid users', () => {
  it('calls supabase upsert after debounce interval', async () => {
    const chain = mockUpsert({ error: null });
    setTier('active');

    useSyncStore.getState().scheduleSync(USER_ID, DATA);
    expect(chain.upsert).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();
    expect(chain.upsert).toHaveBeenCalledOnce();
  });

  it('upserts with userId and data payload', async () => {
    const chain = mockUpsert({ error: null });
    setTier('active');

    useSyncStore.getState().scheduleSync(USER_ID, DATA);
    await vi.runAllTimersAsync();

    expect(supabase.from).toHaveBeenCalledWith('user_data');
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, data: DATA }),
    );
  });

  it('debounces rapid calls — only one upsert for multiple saves', async () => {
    const chain = mockUpsert({ error: null });
    setTier('active');

    useSyncStore.getState().scheduleSync(USER_ID, DATA);
    useSyncStore.getState().scheduleSync(USER_ID, DATA);
    useSyncStore.getState().scheduleSync(USER_ID, DATA);

    await vi.runAllTimersAsync();
    expect(chain.upsert).toHaveBeenCalledOnce();
  });

  it('sets syncStatus to idle after successful sync', async () => {
    mockUpsert({ error: null });
    setTier('active');

    useSyncStore.getState().scheduleSync(USER_ID, DATA);
    await vi.runAllTimersAsync();

    expect(useSyncStore.getState().syncStatus).toBe('idle');
  });

  it('sets lastSyncAt after successful sync', async () => {
    mockUpsert({ error: null });
    setTier('active');

    useSyncStore.getState().scheduleSync(USER_ID, DATA);
    await vi.runAllTimersAsync();

    expect(useSyncStore.getState().lastSyncAt).not.toBeNull();
  });

  it('supports grace_period tier', async () => {
    const chain = mockUpsert({ error: null });
    setTier('grace_period');

    useSyncStore.getState().scheduleSync(USER_ID, DATA);
    await vi.runAllTimersAsync();

    expect(chain.upsert).toHaveBeenCalledOnce();
  });
});

// ─── free / expired / canceled users ─────────────────────────────────────────

describe('scheduleSync — non-paying users', () => {
  it.each(['free', 'expired', 'canceled'])(
    'does not call supabase for %s tier',
    async (tier) => {
      const chain = mockUpsert({ error: null });
      setTier(tier);

      useSyncStore.getState().scheduleSync(USER_ID, DATA);
      await vi.runAllTimersAsync();

      expect(chain.upsert).not.toHaveBeenCalled();
    },
  );
});

// ─── offline mode ─────────────────────────────────────────────────────────────

describe('offline mode', () => {
  it('marks pendingSync true when offline instead of calling supabase', async () => {
    const chain = mockUpsert({ error: null });
    setTier('active');
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    useSyncStore.getState().scheduleSync(USER_ID, DATA);
    await vi.runAllTimersAsync();

    expect(chain.upsert).not.toHaveBeenCalled();
    expect(useSyncStore.getState().pendingSync).toBe(true);
  });

  it('flushPendingSync syncs queued data when called online', async () => {
    const chain = mockUpsert({ error: null });
    setTier('active');
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    useSyncStore.getState().scheduleSync(USER_ID, DATA);
    await vi.runAllTimersAsync();
    expect(chain.upsert).not.toHaveBeenCalled();

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    await useSyncStore.getState().flushPendingSync();

    expect(chain.upsert).toHaveBeenCalledOnce();
    expect(useSyncStore.getState().pendingSync).toBe(false);
  });

  it('flushPendingSync does nothing when no sync is pending', async () => {
    const chain = mockUpsert({ error: null });
    setTier('active');

    await useSyncStore.getState().flushPendingSync();

    expect(chain.upsert).not.toHaveBeenCalled();
  });
});

// ─── retry logic ──────────────────────────────────────────────────────────────

describe('retry logic', () => {
  it('retries sync on failure and succeeds on second attempt', async () => {
    const chain = {
      upsert: vi.fn()
        .mockResolvedValueOnce({ error: { message: 'Network error' } })
        .mockResolvedValue({ error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(chain as never);
    setTier('active');

    useSyncStore.getState().scheduleSync(USER_ID, DATA);
    await vi.runAllTimersAsync();

    expect(chain.upsert.mock.calls.length).toBeGreaterThan(1);
    expect(useSyncStore.getState().syncStatus).toBe('idle');
    expect(useSyncStore.getState().syncError).toBeNull();
  });

  it('sets syncStatus to error after all retries are exhausted', async () => {
    mockUpsert({ error: { message: 'Persistent server failure' } });
    setTier('active');

    useSyncStore.getState().scheduleSync(USER_ID, DATA);
    await vi.runAllTimersAsync();

    expect(useSyncStore.getState().syncStatus).toBe('error');
    expect(useSyncStore.getState().syncError).not.toBeNull();
  });
});

// ─── clearSyncError ───────────────────────────────────────────────────────────

describe('clearSyncError', () => {
  it('resets error state to idle', () => {
    useSyncStore.setState({ syncStatus: 'error', syncError: 'Something went wrong' });

    useSyncStore.getState().clearSyncError();

    expect(useSyncStore.getState().syncStatus).toBe('idle');
    expect(useSyncStore.getState().syncError).toBeNull();
  });
});
