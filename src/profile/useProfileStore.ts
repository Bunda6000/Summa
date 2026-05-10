import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Profile {
  user_id: string;
  display_name: string | null;
  plan: 'free' | 'paid';
  subscription_status: 'active' | 'cancelled' | 'past_due';
}

interface ProfileState {
  profile: Profile | null;
  loading: boolean;
  saving: boolean;
  error: string | null;

  loadProfile: (userId: string) => Promise<void>;
  updateDisplayName: (userId: string, displayName: string) => Promise<void>;
  clearError: () => void;
}

const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  loading: false,
  saving: false,
  error: null,

  loadProfile: async (userId) => {
    set({ loading: true, error: null });

    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, display_name, plan, subscription_status')
      .eq('user_id', userId)
      .single();

    // PGRST116 = no row found — create default profile
    if (error && error.code === 'PGRST116') {
      const { data: created, error: createError } = await supabase
        .from('profiles')
        .upsert({ user_id: userId, display_name: null, plan: 'paid', subscription_status: 'active' })
        .select('user_id, display_name, plan, subscription_status')
        .single();

      if (createError) {
        set({ loading: false, error: 'Failed to load profile.' });
        return;
      }
      set({ loading: false, profile: created as Profile });
      return;
    }

    if (error) {
      set({ loading: false, error: 'Failed to load profile.' });
      return;
    }

    set({ loading: false, profile: data as Profile });
  },

  updateDisplayName: async (userId, displayName) => {
    set({ saving: true, error: null });

    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('user_id', userId)
      .select('user_id, display_name, plan, subscription_status')
      .single();

    if (error) {
      set({ saving: false, error: 'Failed to save profile.' });
      return;
    }

    set({ saving: false, profile: data as Profile });
  },

  clearError: () => set({ error: null }),
}));

export default useProfileStore;
