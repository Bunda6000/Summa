import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface HealthData {
  uptime_pct: number;
  auth_failure_rate_1h: number;
  billing_failure_count_24h: number;
  rtdn_error_count_24h: number;
  sync_success_rate_1h: number;
  sync_failure_count_1h: number;
  total_events_24h: number;
  last_event_at: string | null;
}

interface MonitoringState {
  health: HealthData | null;
  loading: boolean;
  error: string | null;
  lastCheckedAt: string | null;

  fetchHealth: () => Promise<void>;
  clearError: () => void;
}

const useMonitoringStore = create<MonitoringState>()((set, get) => ({
  health: null,
  loading: false,
  error: null,
  lastCheckedAt: null,

  fetchHealth: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.functions.invoke('health-check');

      if (error) {
        set({
          loading: false,
          error: error.message ?? 'Failed to load health data',
        });
        return;
      }

      set({
        health: data as HealthData,
        loading: false,
        error: null,
        lastCheckedAt: new Date().toISOString(),
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load health data',
      });
    }
  },

  clearError: () => set({ error: null }),
}));

export default useMonitoringStore;
