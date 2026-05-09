import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const RESEND_THRESHOLD = 3;
const RESEND_COOLDOWN_MS = 5 * 60 * 1000;
const RATE_LIMIT_PHRASES = ['rate limit', 'too many', 'email rate limit'];

// Read URL error params at module load time — before Supabase's async _initialize()
// can call history.replaceState() and erase them.
let _initialResetError: string | null = null;
let _initialVerificationError: string | null = null;
if (typeof window !== 'undefined') {
  const _p = new URLSearchParams(window.location.search);
  const _code = _p.get('error_code');
  const _err = _p.get('error');
  if (_code === 'otp_expired' && sessionStorage.getItem('summa_reset_pending') === '1') {
    sessionStorage.removeItem('summa_reset_pending');
    _initialResetError = 'The password reset link has expired. Please request a new one.';
  } else if (_code === 'otp_expired' || _code === 'otp_disabled') {
    _initialVerificationError = 'The verification link has expired. Please request a new one.';
  } else if (_err === 'access_denied') {
    const desc = _p.get('error_description') ?? 'Verification failed.';
    _initialVerificationError = desc.replace(/\+/g, ' ');
  }
}

interface AuthState {
  session: Session | null;
  loading: boolean;
  error: string | null;
  info: string | null;
  failedAttempts: number;
  lockedUntil: number | null;
  resendCount: number;
  resendCooldownUntil: number | null;
  verificationError: string | null;
  recoveryMode: boolean;
  resetError: string | null;

  initAuth: () => Promise<() => void>;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  clearError: () => void;
  clearVerificationError: () => void;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  clearResetError: () => void;
}

const isRateLimitError = (msg: string) =>
  RATE_LIMIT_PHRASES.some(p => msg.toLowerCase().includes(p));

const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  loading: false,
  error: null,
  info: null,
  failedAttempts: 0,
  lockedUntil: null,
  resendCount: 0,
  resendCooldownUntil: null,
  // Primary: set from module-level URL capture before Supabase can erase params.
  // Also detected in initAuth as fallback for test environments.
  verificationError: _initialVerificationError,
  recoveryMode: false,
  resetError: _initialResetError,

  initAuth: async () => {
    // Fallback URL detection — handles test environments where vi.stubGlobal
    // is applied after module load (module-level check runs with empty location).
    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get('error_code');
    const urlError = params.get('error');

    if (errorCode === 'otp_expired' && sessionStorage.getItem('summa_reset_pending') === '1') {
      sessionStorage.removeItem('summa_reset_pending');
      set({ resetError: 'The password reset link has expired. Please request a new one.' });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (errorCode === 'otp_expired' || errorCode === 'otp_disabled') {
      if (!_initialResetError) {
        set({ verificationError: 'The verification link has expired. Please request a new one.' });
      }
      window.history.replaceState({}, '', window.location.pathname);
    } else if (urlError === 'access_denied') {
      const desc = params.get('error_description') ?? 'Verification failed.';
      set({ verificationError: desc.replace(/\+/g, ' ') });
      window.history.replaceState({}, '', window.location.pathname);
    }

    const { data: { session } } = await supabase.auth.getSession();
    set({ session });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') {
        set({ recoveryMode: true, resetError: null, session });
      } else {
        set({ session });
      }
    });

    return () => subscription.unsubscribe();
  },

  signUp: async (email, password) => {
    set({ loading: true, error: null, info: null });
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      set({ loading: false, error: error.message });
      return;
    }
    if (!data.session && data.user) {
      set({ loading: false, info: 'Account created! Check your email to confirm your address before signing in.' });
      return;
    }
    set({ loading: false, session: data.session, error: null, info: null });
  },

  signIn: async (email, password) => {
    const { lockedUntil } = get();
    if (lockedUntil && Date.now() < lockedUntil) {
      set({ error: 'Too many attempts — temporarily blocked. Try again later.' });
      return;
    }

    set({ loading: true, error: null });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const msg = error.message;
      const newAttempts = get().failedAttempts + 1;

      if (isRateLimitError(msg)) {
        set({
          loading: false,
          error: 'Too many attempts — temporarily blocked. Please wait before trying again.',
          lockedUntil: Date.now() + LOCKOUT_DURATION_MS,
          failedAttempts: newAttempts,
        });
        return;
      }

      const nextLocked = newAttempts >= LOCKOUT_THRESHOLD ? Date.now() + LOCKOUT_DURATION_MS : null;
      set({
        loading: false,
        error: msg,
        failedAttempts: newAttempts,
        lockedUntil: nextLocked,
      });
      return;
    }

    set({ loading: false, session: data.session, error: null, failedAttempts: 0, lockedUntil: null });
  },

  signOut: async () => {
    set({ loading: true });
    await supabase.auth.signOut();
    set({ session: null, loading: false, error: null, failedAttempts: 0, lockedUntil: null });
  },

  deleteAccount: async () => {
    const { session } = get();
    if (!session) return;

    set({ loading: true, error: null });
    try {
      const { error } = await supabase.functions.invoke('delete-account', {
        body: { userId: session.user.id },
      });

      if (error) {
        set({ loading: false, error: error.message });
        return;
      }

      await supabase.auth.signOut();
      set({ session: null, loading: false, error: null, failedAttempts: 0, lockedUntil: null });
    } catch {
      set({ loading: false, error: 'Failed to delete account. Please try again.' });
    }
  },

  resendVerification: async (email) => {
    const { resendCount, resendCooldownUntil } = get();

    if (resendCooldownUntil && Date.now() < resendCooldownUntil) {
      set({ error: 'Too many resend requests. Please wait before trying again.' });
      return;
    }

    if (resendCount >= RESEND_THRESHOLD) {
      set({
        error: 'Too many resend requests. Please wait before trying again.',
        resendCooldownUntil: Date.now() + RESEND_COOLDOWN_MS,
      });
      return;
    }

    set({ loading: true, error: null, info: null });
    const { error } = await supabase.auth.resend({ type: 'signup', email });

    if (error) {
      if (isRateLimitError(error.message)) {
        set({
          loading: false,
          error: 'Too many resend requests. Please wait before trying again.',
          resendCooldownUntil: Date.now() + RESEND_COOLDOWN_MS,
        });
        return;
      }
      set({ loading: false, error: error.message, resendCount: resendCount + 1 });
      return;
    }

    set({ loading: false, info: 'Verification email sent! Check your inbox.', resendCount: resendCount + 1 });
  },

  requestPasswordReset: async (email) => {
    set({ loading: true, error: null, info: null });
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (!error) {
      sessionStorage.setItem('summa_reset_pending', '1');
    }
    set({ loading: false, info: 'If an account with that email exists, a reset link has been sent.' });
  },

  updatePassword: async (password) => {
    set({ loading: true, error: null });
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      set({ loading: false, error: error.message });
      return;
    }
    set({ loading: false, recoveryMode: false });
  },

  clearError: () => set({ error: null, info: null }),
  clearVerificationError: () => set({ verificationError: null }),
  clearResetError: () => set({ resetError: null }),
}));

export default useAuthStore;
