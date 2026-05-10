import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../storage', () => ({
  removeStore: vi.fn().mockResolvedValue(undefined),
}));

// Mock the Supabase client module before importing the store
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      resend: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
}));

import { supabase } from '../../lib/supabase';
import { removeStore } from '../../storage';
import useAuthStore from '../useAuthStore';

const mockSignUp = vi.mocked(supabase.auth.signUp);
const mockSignIn = vi.mocked(supabase.auth.signInWithPassword);
const mockSignOut = vi.mocked(supabase.auth.signOut);
const mockResend = vi.mocked(supabase.auth.resend);
const mockResetPasswordForEmail = vi.mocked(supabase.auth.resetPasswordForEmail);
const mockUpdateUser = vi.mocked(supabase.auth.updateUser);

const fakeSession = {
  user: { id: 'user-123', email: 'user@example.com' },
  access_token: 'token',
  refresh_token: 'refresh',
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  useAuthStore.setState({
    session: null,
    loading: false,
    error: null,
    info: null,
    failedAttempts: 0,
    lockedUntil: null,
    resendCount: 0,
    resendCooldownUntil: null,
    verificationError: null,
    recoveryMode: false,
    resetError: null,
  });
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

describe('useAuthStore.resendVerification', () => {
  it('sends verification email and sets info message', async () => {
    mockResend.mockResolvedValue({ data: {}, error: null } as never);
    await useAuthStore.getState().resendVerification('user@example.com');
    expect(useAuthStore.getState().info).toMatch(/check your inbox/i);
    expect(useAuthStore.getState().error).toBeNull();
    expect(mockResend).toHaveBeenCalledWith({ type: 'signup', email: 'user@example.com' });
  });

  it('increments resendCount on success', async () => {
    mockResend.mockResolvedValue({ data: {}, error: null } as never);
    await useAuthStore.getState().resendVerification('user@example.com');
    expect(useAuthStore.getState().resendCount).toBe(1);
  });

  it('blocks resend when count reaches threshold and sets cooldown', async () => {
    useAuthStore.setState({ resendCount: 3 });
    await useAuthStore.getState().resendVerification('user@example.com');
    expect(useAuthStore.getState().error).toMatch(/too many resend/i);
    expect(useAuthStore.getState().resendCooldownUntil).not.toBeNull();
    expect(mockResend).not.toHaveBeenCalled();
  });

  it('blocks resend when cooldown is active', async () => {
    useAuthStore.setState({ resendCooldownUntil: Date.now() + 60_000 });
    await useAuthStore.getState().resendVerification('user@example.com');
    expect(useAuthStore.getState().error).toMatch(/too many resend/i);
    expect(mockResend).not.toHaveBeenCalled();
  });

  it('passes Supabase rate-limit error through as friendly message', async () => {
    mockResend.mockResolvedValue({ data: null, error: { message: 'Email rate limit exceeded' } } as never);
    await useAuthStore.getState().resendVerification('user@example.com');
    expect(useAuthStore.getState().error).toMatch(/too many resend/i);
  });

  it('surfaces non-rate-limit Supabase errors', async () => {
    mockResend.mockResolvedValue({ data: null, error: { message: 'Something went wrong' } } as never);
    await useAuthStore.getState().resendVerification('user@example.com');
    expect(useAuthStore.getState().error).toBe('Something went wrong');
  });
});

describe('useAuthStore.initAuth — URL error detection', () => {
  it('sets verificationError when URL has otp_expired error code', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as never);
    vi.stubGlobal('location', {
      search: '?error_code=otp_expired&error=access_denied&error_description=Email+link+is+invalid+or+has+expired',
      pathname: '/',
      href: 'http://localhost/',
    });

    await useAuthStore.getState().initAuth();

    expect(useAuthStore.getState().verificationError).toMatch(/expired/i);
    vi.unstubAllGlobals();
  });

  it('sets verificationError for any access_denied error', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as never);
    vi.stubGlobal('location', {
      search: '?error=access_denied&error_description=Verification+failed',
      pathname: '/',
      href: 'http://localhost/',
    });

    await useAuthStore.getState().initAuth();

    expect(useAuthStore.getState().verificationError).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it('does not set verificationError when URL has no error params', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as never);
    vi.stubGlobal('location', { search: '', pathname: '/', href: 'http://localhost/' });

    await useAuthStore.getState().initAuth();

    expect(useAuthStore.getState().verificationError).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('useAuthStore.requestPasswordReset', () => {
  it('calls resetPasswordForEmail with email and current origin', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null } as never);
    await useAuthStore.getState().requestPasswordReset('user@example.com');
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: window.location.origin,
    });
  });

  it('sets generic info message even when Supabase returns an error', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: { message: 'User not found' } } as never);
    await useAuthStore.getState().requestPasswordReset('nobody@example.com');
    expect(useAuthStore.getState().info).toMatch(/if an account/i);
    expect(useAuthStore.getState().error).toBeNull();
    expect(sessionStorage.getItem('summa_reset_pending')).toBeNull();
  });

  it('sets the summa_reset_pending sessionStorage flag', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null } as never);
    await useAuthStore.getState().requestPasswordReset('user@example.com');
    expect(sessionStorage.getItem('summa_reset_pending')).toBe('1');
  });
});

describe('useAuthStore.updatePassword', () => {
  it('calls updateUser with the new password', async () => {
    mockUpdateUser.mockResolvedValue({ data: {}, error: null } as never);
    useAuthStore.setState({ recoveryMode: true });
    await useAuthStore.getState().updatePassword('NewPass1!');
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'NewPass1!' });
  });

  it('clears recoveryMode on success', async () => {
    mockUpdateUser.mockResolvedValue({ data: {}, error: null } as never);
    useAuthStore.setState({ recoveryMode: true });
    await useAuthStore.getState().updatePassword('NewPass1!');
    expect(useAuthStore.getState().recoveryMode).toBe(false);
  });

  it('surfaces error and keeps recoveryMode on failure', async () => {
    mockUpdateUser.mockResolvedValue({ data: {}, error: { message: 'Password too weak' } } as never);
    useAuthStore.setState({ recoveryMode: true });
    await useAuthStore.getState().updatePassword('weak');
    expect(useAuthStore.getState().error).toMatch(/password too weak/i);
    expect(useAuthStore.getState().recoveryMode).toBe(true);
  });
});

describe('useAuthStore.initAuth — reset error detection', () => {
  it('sets resetError when URL has otp_expired and summa_reset_pending flag', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as never);
    sessionStorage.setItem('summa_reset_pending', '1');
    vi.stubGlobal('location', {
      search: '?error_code=otp_expired&error=access_denied',
      pathname: '/',
      href: 'http://localhost/',
    });

    await useAuthStore.getState().initAuth();

    expect(useAuthStore.getState().resetError).toMatch(/expired/i);
    expect(useAuthStore.getState().verificationError).toBeNull();
    expect(sessionStorage.getItem('summa_reset_pending')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('sets verificationError (not resetError) when otp_expired without the sessionStorage flag', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as never);
    sessionStorage.removeItem('summa_reset_pending');
    vi.stubGlobal('location', {
      search: '?error_code=otp_expired',
      pathname: '/',
      href: 'http://localhost/',
    });

    await useAuthStore.getState().initAuth();

    expect(useAuthStore.getState().verificationError).toMatch(/expired/i);
    expect(useAuthStore.getState().resetError).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('useAuthStore.initAuth — PASSWORD_RECOVERY event', () => {
  it('sets recoveryMode when PASSWORD_RECOVERY fires via onAuthStateChange', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as never);
    vi.stubGlobal('location', { search: '', pathname: '/', href: 'http://localhost/' });

    let capturedCallback: ((event: string, session: unknown) => void) | null = null;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((cb) => {
      capturedCallback = cb as never;
      return { data: { subscription: { unsubscribe: vi.fn() } } } as never;
    });

    await useAuthStore.getState().initAuth();
    capturedCallback!('PASSWORD_RECOVERY', null);

    expect(useAuthStore.getState().recoveryMode).toBe(true);
    vi.unstubAllGlobals();
  });
});
