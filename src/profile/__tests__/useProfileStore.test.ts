import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(),
  },
}));

import { supabase } from '../../lib/supabase';
import useProfileStore, { type Profile } from '../useProfileStore';

const mockFrom = vi.mocked(supabase.from);

function mockChain(returnValue: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(returnValue),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
  };
  mockFrom.mockReturnValue(chain as never);
  return chain;
}

const fakeProfile: Profile = {
  user_id: 'user-123',
  display_name: 'Alice',
  plan: 'free',
  subscription_status: 'active',
};

beforeEach(() => {
  vi.clearAllMocks();
  useProfileStore.setState({
    profile: null,
    loading: false,
    saving: false,
    error: null,
  });
});

describe('useProfileStore.loadProfile', () => {
  it('loads profile and sets state', async () => {
    mockChain({ data: fakeProfile, error: null });
    await useProfileStore.getState().loadProfile('user-123');
    expect(useProfileStore.getState().profile).toEqual(fakeProfile);
    expect(useProfileStore.getState().loading).toBe(false);
    expect(useProfileStore.getState().error).toBeNull();
  });

  it('creates a default profile if none exists (null data)', async () => {
    // First call: select returns null (no profile yet)
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
    };
    const upsertChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { ...fakeProfile, display_name: null },
        error: null,
      }),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
    };
    mockFrom
      .mockReturnValueOnce(selectChain as never)
      .mockReturnValueOnce(upsertChain as never);

    await useProfileStore.getState().loadProfile('user-123');
    expect(useProfileStore.getState().profile).not.toBeNull();
    expect(useProfileStore.getState().profile?.plan).toBe('free');
  });

  it('sets error when load fails unexpectedly', async () => {
    mockChain({ data: null, error: { code: 'SOME_ERROR', message: 'DB error' } });
    await useProfileStore.getState().loadProfile('user-123');
    expect(useProfileStore.getState().profile).toBeNull();
    expect(useProfileStore.getState().error).toMatch(/failed to load/i);
  });
});

describe('useProfileStore.updateDisplayName', () => {
  it('updates display_name and reflects in state', async () => {
    useProfileStore.setState({ profile: { ...fakeProfile } });
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { ...fakeProfile, display_name: 'Bob' },
        error: null,
      }),
      upsert: vi.fn().mockReturnThis(),
    };
    mockFrom.mockReturnValue(updateChain as never);

    await useProfileStore.getState().updateDisplayName('user-123', 'Bob');
    expect(useProfileStore.getState().profile?.display_name).toBe('Bob');
    expect(useProfileStore.getState().saving).toBe(false);
    expect(useProfileStore.getState().error).toBeNull();
  });

  it('does not change plan even if server returns changed plan', async () => {
    useProfileStore.setState({ profile: { ...fakeProfile, plan: 'free' } });
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      // server reverts plan — returns 'free' regardless
      single: vi.fn().mockResolvedValue({
        data: { ...fakeProfile, display_name: 'Bob', plan: 'free' },
        error: null,
      }),
      upsert: vi.fn().mockReturnThis(),
    };
    mockFrom.mockReturnValue(updateChain as never);

    await useProfileStore.getState().updateDisplayName('user-123', 'Bob');
    expect(useProfileStore.getState().profile?.plan).toBe('free');
  });

  it('sets error on save failure', async () => {
    useProfileStore.setState({ profile: { ...fakeProfile } });
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } }),
      upsert: vi.fn().mockReturnThis(),
    };
    mockFrom.mockReturnValue(updateChain as never);

    await useProfileStore.getState().updateDisplayName('user-123', 'Bob');
    expect(useProfileStore.getState().error).toMatch(/failed to save/i);
    expect(useProfileStore.getState().saving).toBe(false);
  });
});
