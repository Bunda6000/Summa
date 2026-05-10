import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      getUser: vi.fn(),
      resend: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    functions: { invoke: vi.fn() },
  },
}));

import { supabase } from '../../lib/supabase';
import useAuthStore from '../useAuthStore';

const SENSITIVE_PATTERNS = [
  /password/i,
  /access_token/i,
  /refresh_token/i,
  /bearer\s+\S+/i,
];

function containsSensitiveData(args: unknown[]): boolean {
  const serialised = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  return SENSITIVE_PATTERNS.some(p => p.test(serialised));
}

describe('Secure logging — no sensitive data in console output', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

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

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('does not log the plaintext password during sign-up failure', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'User already registered' },
    } as never);

    await useAuthStore.getState().signUp('user@example.com', 'SuperSecret1!');

    const allCalls = [
      ...consoleSpy.mock.calls,
      ...consoleWarnSpy.mock.calls,
      ...consoleErrorSpy.mock.calls,
    ];

    for (const call of allCalls) {
      expect(containsSensitiveData(call)).toBe(false);
    }
  });

  it('does not log the plaintext password during sign-in failure', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    } as never);

    await useAuthStore.getState().signIn('user@example.com', 'SuperSecret1!');

    const allCalls = [
      ...consoleSpy.mock.calls,
      ...consoleWarnSpy.mock.calls,
      ...consoleErrorSpy.mock.calls,
    ];

    for (const call of allCalls) {
      expect(containsSensitiveData(call)).toBe(false);
    }
  });

  it('does not log auth tokens when a session is set', async () => {
    const fakeSession = {
      user: { id: 'u1', email: 'u@example.com' },
      access_token: 'secret-access-token',
      refresh_token: 'secret-refresh-token',
    };

    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { session: fakeSession, user: fakeSession.user },
      error: null,
    } as never);

    await useAuthStore.getState().signIn('u@example.com', 'Correct1!');

    const allCalls = [
      ...consoleSpy.mock.calls,
      ...consoleWarnSpy.mock.calls,
      ...consoleErrorSpy.mock.calls,
    ];

    for (const call of allCalls) {
      expect(containsSensitiveData(call)).toBe(false);
    }
  });
});
