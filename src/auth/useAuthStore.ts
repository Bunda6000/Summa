import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_PHRASES = ['rate limit', 'too many', 'email rate limit'];

interface AuthState {
  session: Session | null;
  loading: boolean;
  error: string | null;
  info: string | null;
  failedAttempts: number;
  lockedUntil: number | null;

  initAuth: () => Promise<() => void>;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
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

  initAuth: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    set({ session });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
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
      // Email confirmation is required — account created but not yet signed in.
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

  clearError: () => set({ error: null, info: null }),
}));

export default useAuthStore;
