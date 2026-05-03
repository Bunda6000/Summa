import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Supabase client module before importing the store
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
  },
}));

import { supabase } from '../../lib/supabase';
import useAuthStore from '../useAuthStore';

const mockSignUp = vi.mocked(supabase.auth.signUp);
const mockSignIn = vi.mocked(supabase.auth.signInWithPassword);
const mockSignOut = vi.mocked(supabase.auth.signOut);

const fakeSession = {
  user: { id: 'user-123', email: 'user@example.com' },
  access_token: 'token',
  refresh_token: 'refresh',
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ session: null, loading: false, error: null, info: null, failedAttempts: 0, lockedUntil: null });
});

describe('useAuthStore.signUp', () => {
  it('sets session on successful sign-up', async () => {
    mockSignUp.mockResolvedValue({ data: { session: fakeSession, user: fakeSession.user }, error: null } as never);
    await useAuthStore.getState().signUp('user@example.com', 'Str0ng!pass');
    expect(useAuthStore.getState().session).toEqual(fakeSession);
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('sets error on duplicate email', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'User already registered' } } as never);
    await useAuthStore.getState().signUp('existing@example.com', 'Str0ng!pass');
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().error).toMatch(/already registered/i);
  });

  it('sets info message when email confirmation is required', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null, user: { id: 'u1' } }, error: null } as never);
    await useAuthStore.getState().signUp('confirm@example.com', 'Str0ng!pass');
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().error).toBeNull();
    expect(useAuthStore.getState().info).toMatch(/check your email/i);
  });
});

describe('useAuthStore.signIn', () => {
  it('sets session on valid credentials', async () => {
    mockSignIn.mockResolvedValue({ data: { session: fakeSession, user: fakeSession.user }, error: null } as never);
    await useAuthStore.getState().signIn('user@example.com', 'Str0ng!pass');
    expect(useAuthStore.getState().session).toEqual(fakeSession);
    expect(useAuthStore.getState().failedAttempts).toBe(0);
  });

  it('increments failedAttempts on wrong credentials', async () => {
    mockSignIn.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'Invalid login credentials' } } as never);
    await useAuthStore.getState().signIn('user@example.com', 'wrongpassword');
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().failedAttempts).toBe(1);
  });

  it('sets lockedUntil after 5 failed attempts', async () => {
    mockSignIn.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'Invalid login credentials' } } as never);
    useAuthStore.setState({ failedAttempts: 4 });
    await useAuthStore.getState().signIn('user@example.com', 'wrong');
    expect(useAuthStore.getState().failedAttempts).toBe(5);
    expect(useAuthStore.getState().lockedUntil).not.toBeNull();
  });

  it('resets failedAttempts on successful sign-in', async () => {
    mockSignIn.mockResolvedValue({ data: { session: fakeSession, user: fakeSession.user }, error: null } as never);
    useAuthStore.setState({ failedAttempts: 3 });
    await useAuthStore.getState().signIn('user@example.com', 'Str0ng!pass');
    expect(useAuthStore.getState().failedAttempts).toBe(0);
    expect(useAuthStore.getState().lockedUntil).toBeNull();
  });

  it('surfaces rate-limit error from Supabase', async () => {
    mockSignIn.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'Email rate limit exceeded' } } as never);
    await useAuthStore.getState().signIn('user@example.com', 'Str0ng!pass');
    expect(useAuthStore.getState().error).toMatch(/too many attempts/i);
  });
});

describe('useAuthStore.signOut', () => {
  it('clears session on sign-out', async () => {
    mockSignOut.mockResolvedValue({ error: null } as never);
    useAuthStore.setState({ session: fakeSession as never });
    await useAuthStore.getState().signOut();
    expect(useAuthStore.getState().session).toBeNull();
    expect(mockSignOut).toHaveBeenCalled();
  });
});
