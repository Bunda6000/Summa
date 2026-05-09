import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

import { supabase } from '../../lib/supabase';
import { logEvent, sanitizeMetadata } from '../logger';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── sanitizeMetadata ─────────────────────────────────────────────────────────

describe('sanitizeMetadata', () => {
  it('redacts password fields', () => {
    const result = sanitizeMetadata({ password: 'super-secret', email: 'a@b.com' });
    expect(result.password).toBe('[REDACTED]');
    expect(result.email).toBe('a@b.com');
  });

  it('redacts access_token fields', () => {
    const result = sanitizeMetadata({ access_token: 'tok_abc123', user: 'alice' });
    expect(result.access_token).toBe('[REDACTED]');
    expect(result.user).toBe('alice');
  });

  it('redacts refresh_token fields', () => {
    const result = sanitizeMetadata({ refresh_token: 'ref_xyz', attempts: 3 });
    expect(result.refresh_token).toBe('[REDACTED]');
    expect(result.attempts).toBe(3);
  });

  it('redacts fields containing "secret" in the key', () => {
    const result = sanitizeMetadata({ rtdn_secret: 'abc', ok: true });
    expect(result.rtdn_secret).toBe('[REDACTED]');
    expect(result.ok).toBe(true);
  });

  it('does not mutate the original object', () => {
    const original = { password: 'secret', count: 1 };
    sanitizeMetadata(original);
    expect(original.password).toBe('secret');
  });

  it('handles nested objects recursively', () => {
    const result = sanitizeMetadata({ user: { access_token: 'tok', id: 'u1' }, outer: 'ok' });
    expect((result.user as Record<string, unknown>).access_token).toBe('[REDACTED]');
    expect((result.user as Record<string, unknown>).id).toBe('u1');
    expect(result.outer).toBe('ok');
  });

  it('leaves arrays untouched (does not recurse into them)', () => {
    const result = sanitizeMetadata({ tags: ['a', 'b'], count: 2 });
    expect(result.tags).toEqual(['a', 'b']);
  });
});

// ─── logEvent — no sensitive data reaches console ─────────────────────────────

describe('logEvent — sensitive-data guardrails', () => {
  it('does not log passwords to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logEvent({
      event_type: 'auth_failure',
      severity: 'warn',
      message: 'Sign in failed',
      metadata: { password: 'P@ssw0rd!' },
    });
    for (const call of spy.mock.calls) {
      const str = call.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
      expect(str).not.toContain('P@ssw0rd!');
    }
    spy.mockRestore();
  });

  it('does not log tokens to console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logEvent({
      event_type: 'billing_failure',
      severity: 'error',
      message: 'Purchase failed',
      metadata: { access_token: 'secret-tok-123' },
    });
    for (const call of spy.mock.calls) {
      const str = call.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
      expect(str).not.toContain('secret-tok-123');
    }
    spy.mockRestore();
  });
});

// ─── logEvent — dispatch behaviour ───────────────────────────────────────────

describe('logEvent — dispatch', () => {
  it('calls supabase.functions.invoke with event_type and severity', async () => {
    logEvent({
      event_type: 'sync_failure',
      severity: 'error',
      message: 'Sync failed after all retries',
    });
    await Promise.resolve();

    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'log-event',
      expect.objectContaining({
        body: expect.objectContaining({
          event_type: 'sync_failure',
          severity: 'error',
          message: 'Sync failed after all retries',
        }),
      }),
    );
  });

  it('sanitizes metadata before sending to edge function', async () => {
    logEvent({
      event_type: 'auth_failure',
      severity: 'warn',
      message: 'Bad credentials',
      metadata: { password: 'hunter2', attempts: 3 },
    });
    await Promise.resolve();

    const call = vi.mocked(supabase.functions.invoke).mock.calls[0];
    const body = (call[1] as { body: Record<string, unknown> }).body;
    const meta = body.metadata as Record<string, unknown>;
    expect(meta.password).toBe('[REDACTED]');
    expect(meta.attempts).toBe(3);
  });

  it('does not throw when invoke rejects', async () => {
    vi.mocked(supabase.functions.invoke).mockRejectedValueOnce(new Error('Network error'));
    expect(() =>
      logEvent({ event_type: 'sync_failure', severity: 'error', message: 'Oops' }),
    ).not.toThrow();
    await Promise.resolve();
  });

  it('does not throw when invoke returns an error object', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: { message: 'Function error' } as never,
    });
    expect(() =>
      logEvent({ event_type: 'auth_lockout', severity: 'critical', message: 'Lockout' }),
    ).not.toThrow();
    await Promise.resolve();
  });

  it('includes user_id in the payload when provided', async () => {
    logEvent({
      event_type: 'auth_failure',
      severity: 'warn',
      message: 'Failed login',
      user_id: 'user-abc',
    });
    await Promise.resolve();

    const call = vi.mocked(supabase.functions.invoke).mock.calls[0];
    const body = (call[1] as { body: Record<string, unknown> }).body;
    expect(body.user_id).toBe('user-abc');
  });
});
