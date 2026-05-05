import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '../../lib/supabase';
import useSubscriptionStore from '../useSubscriptionStore';

const mockFrom = vi.mocked(supabase.from);

function mockQuery(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  mockFrom.mockReturnValue(chain as never);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  useSubscriptionStore.setState({
    tier: 'free',
    loading: false,
    rawStatus: null,
    currentPeriodEnd: null,
    gracePeriodEnd: null,
  });
});

const FUTURE = '2099-01-01T00:00:00Z';
const PAST = '2020-01-01T00:00:00Z';

describe('useSubscriptionStore.initSubscription', () => {
  it('sets tier to free when no subscription row exists', async () => {
    mockQuery({ data: null, error: null });
    await useSubscriptionStore.getState().initSubscription('user-1');
    expect(useSubscriptionStore.getState().tier).toBe('free');
    expect(useSubscriptionStore.getState().loading).toBe(false);
  });

  it('sets tier to active for active subscription with future period_end', async () => {
    mockQuery({ data: { status: 'active', current_period_end: FUTURE, grace_period_end: null }, error: null });
    await useSubscriptionStore.getState().initSubscription('user-1');
    expect(useSubscriptionStore.getState().tier).toBe('active');
  });

  it('sets tier to grace_period when period ended but grace has not', async () => {
    mockQuery({ data: { status: 'active', current_period_end: PAST, grace_period_end: FUTURE }, error: null });
    await useSubscriptionStore.getState().initSubscription('user-1');
    expect(useSubscriptionStore.getState().tier).toBe('grace_period');
  });

  it('sets tier to expired when both dates are in the past', async () => {
    mockQuery({ data: { status: 'active', current_period_end: PAST, grace_period_end: PAST }, error: null });
    await useSubscriptionStore.getState().initSubscription('user-1');
    expect(useSubscriptionStore.getState().tier).toBe('expired');
  });

  it('sets tier to canceled when status is canceled', async () => {
    mockQuery({ data: { status: 'canceled', current_period_end: FUTURE, grace_period_end: null }, error: null });
    await useSubscriptionStore.getState().initSubscription('user-1');
    expect(useSubscriptionStore.getState().tier).toBe('canceled');
  });

  it('keeps loading false on Supabase error', async () => {
    mockQuery({ data: null, error: { message: 'Network error' } });
    await useSubscriptionStore.getState().initSubscription('user-1');
    expect(useSubscriptionStore.getState().loading).toBe(false);
    expect(useSubscriptionStore.getState().tier).toBe('free');
  });
});

describe('useSubscriptionStore.resetSubscription', () => {
  it('resets to default free state', async () => {
    mockQuery({ data: { status: 'active', current_period_end: FUTURE, grace_period_end: null }, error: null });
    await useSubscriptionStore.getState().initSubscription('user-1');
    expect(useSubscriptionStore.getState().tier).toBe('active');

    useSubscriptionStore.getState().resetSubscription();
    expect(useSubscriptionStore.getState().tier).toBe('free');
    expect(useSubscriptionStore.getState().rawStatus).toBeNull();
  });
});
