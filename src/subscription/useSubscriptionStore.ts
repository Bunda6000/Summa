import { create } from "zustand";
import { supabase } from "../lib/supabase";
import {
  computeAccessTier,
  type SubscriptionStatus,
  type SubscriptionTier,
} from "./featureFlags";

interface SubscriptionState {
  tier: SubscriptionTier;
  loading: boolean;
  rawStatus: SubscriptionStatus | null;
  currentPeriodEnd: string | null;
  gracePeriodEnd: string | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;

  initSubscription: (userId: string) => Promise<void>;
  resetSubscription: () => void;
}

const DEFAULT_STATE = {
  tier: "free" as SubscriptionTier,
  loading: false,
  rawStatus: null as SubscriptionStatus | null,
  currentPeriodEnd: null as string | null,
  gracePeriodEnd: null as string | null,
  trialStartedAt: null as string | null,
  trialEndsAt: null as string | null,
};

const useSubscriptionStore = create<SubscriptionState>((set) => ({
  ...DEFAULT_STATE,

  initSubscription: async (userId: string) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from("subscriptions")
      .select(
        "status, current_period_end, grace_period_end, trial_started_at, trial_ends_at",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.warn("[Summa] Subscription fetch failed:", error.message);
      set({ loading: false });
      return;
    }

    if (!data) {
      set({ ...DEFAULT_STATE });
      return;
    }

    const rawStatus = data.status as SubscriptionStatus;
    const currentPeriodEnd = data.current_period_end ?? null;
    const gracePeriodEnd = data.grace_period_end ?? null;
    const trialStartedAt = data.trial_started_at ?? null;
    const trialEndsAt = data.trial_ends_at ?? null;
    const tier = computeAccessTier(
      rawStatus,
      currentPeriodEnd,
      gracePeriodEnd,
      trialEndsAt,
    );

    set({
      tier,
      loading: false,
      rawStatus,
      currentPeriodEnd,
      gracePeriodEnd,
      trialStartedAt,
      trialEndsAt,
    });
  },

  resetSubscription: () => set({ ...DEFAULT_STATE }),
}));

export default useSubscriptionStore;
