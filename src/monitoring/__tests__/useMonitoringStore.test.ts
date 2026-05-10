import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from '../../lib/supabase';
import useMonitoringStore from '../useMonitoringStore';

const mockHealth = {
  uptime_pct: 99.8,
  auth_failure_rate_1h: 2.5,
  billing_failure_count_24h: 0,
  rtdn_error_count_24h: 0,
  sync_success_rate_1h: 97.3,
  sync_failure_count_1h: 2,
  total_events_24h: 148,
  last_event_at: '2026-05-09T10:00:00Z',
};

function mockInvoke(result: { data?: unknown; error?: unknown }) {
  vi.mocked(supabase.functions.invoke).mockResolvedValue(result as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  useMonitoringStore.setState({
    health: null,
    loading: false,
    error: null,
    lastCheckedAt: null,
  });
});

// ─── initial state ────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('starts with null health data', () => {
    expect(useMonitoringStore.getState().health).toBeNull();
  });

  it('starts not loading', () => {
    expect(useMonitoringStore.getState().loading).toBe(false);
  });

  it('starts with no error', () => {
    expect(useMonitoringStore.getState().error).toBeNull();
  });

  it('has no lastCheckedAt timestamp', () => {
    expect(useMonitoringStore.getState().lastCheckedAt).toBeNull();
  });
});

// ─── fetchHealth — happy path ─────────────────────────────────────────────────

describe('fetchHealth — success', () => {
  it('sets loading to true while fetching', async () => {
    let capturedLoading = false;
    vi.mocked(supabase.functions.invoke).mockImplementationOnce(async () => {
      capturedLoading = useMonitoringStore.getState().loading;
      return { data: mockHealth, error: null };
    });

    await useMonitoringStore.getState().fetchHealth();
    expect(capturedLoading).toBe(true);
  });

  it('sets loading to false after fetching', async () => {
    mockInvoke({ data: mockHealth, error: null });
    await useMonitoringStore.getState().fetchHealth();
    expect(useMonitoringStore.getState().loading).toBe(false);
  });

  it('stores health data from the response', async () => {
    mockInvoke({ data: mockHealth, error: null });
    await useMonitoringStore.getState().fetchHealth();
    expect(useMonitoringStore.getState().health).toEqual(mockHealth);
  });

  it('clears any previous error on success', async () => {
    useMonitoringStore.setState({ error: 'Previous error' });
    mockInvoke({ data: mockHealth, error: null });
    await useMonitoringStore.getState().fetchHealth();
    expect(useMonitoringStore.getState().error).toBeNull();
  });

  it('sets lastCheckedAt to a recent ISO timestamp', async () => {
    mockInvoke({ data: mockHealth, error: null });
    const before = Date.now();
    await useMonitoringStore.getState().fetchHealth();
    const after = Date.now();
    const ts = useMonitoringStore.getState().lastCheckedAt;
    expect(ts).not.toBeNull();
    const parsed = new Date(ts!).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });

  it('calls supabase.functions.invoke with "health-check"', async () => {
    mockInvoke({ data: mockHealth, error: null });
    await useMonitoringStore.getState().fetchHealth();
    expect(supabase.functions.invoke).toHaveBeenCalledWith('health-check');
  });
});

// ─── fetchHealth — error path ─────────────────────────────────────────────────

describe('fetchHealth — error', () => {
  it('sets error message when invoke returns an error', async () => {
    mockInvoke({ data: null, error: { message: 'Unauthorized' } });
    await useMonitoringStore.getState().fetchHealth();
    expect(useMonitoringStore.getState().error).toMatch(/Unauthorized/i);
  });

  it('sets error message when invoke throws', async () => {
    vi.mocked(supabase.functions.invoke).mockRejectedValueOnce(new Error('Network failed'));
    await useMonitoringStore.getState().fetchHealth();
    expect(useMonitoringStore.getState().error).toBeTruthy();
  });

  it('leaves health as null on error if no prior data', async () => {
    mockInvoke({ data: null, error: { message: 'Server error' } });
    await useMonitoringStore.getState().fetchHealth();
    expect(useMonitoringStore.getState().health).toBeNull();
  });

  it('preserves previously loaded health data on subsequent error', async () => {
    useMonitoringStore.setState({ health: mockHealth as never });
    mockInvoke({ data: null, error: { message: 'Transient error' } });
    await useMonitoringStore.getState().fetchHealth();
    expect(useMonitoringStore.getState().health).toEqual(mockHealth);
  });

  it('sets loading to false even on error', async () => {
    mockInvoke({ data: null, error: { message: 'Oops' } });
    await useMonitoringStore.getState().fetchHealth();
    expect(useMonitoringStore.getState().loading).toBe(false);
  });
});

// ─── clearError ───────────────────────────────────────────────────────────────

describe('clearError', () => {
  it('resets error to null', () => {
    useMonitoringStore.setState({ error: 'Something went wrong' });
    useMonitoringStore.getState().clearError();
    expect(useMonitoringStore.getState().error).toBeNull();
  });
});
