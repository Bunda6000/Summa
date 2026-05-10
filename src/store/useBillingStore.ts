import { create } from 'zustand';
import {
  purchaseSubscription,
  getActivePurchases,
  openManageSubscription as billingOpenManage,
  type BillingError,
} from '../lib/billing';
import { supabase } from '../lib/supabase';
import useProfileStore from '../profile/useProfileStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BillingStatus = 'idle' | 'purchasing' | 'restoring' | 'success' | 'error';

interface BillingState {
  status: BillingStatus;
  error: string | null;

  purchase: (userId: string) => Promise<void>;
  restorePurchases: (userId: string) => Promise<void>;
  openManageSubscription: () => Promise<void>;
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function verifyToken(token: string, productId: string, orderId: string, userId: string) {
  return supabase.functions.invoke('verify-play-purchase', {
    body: { token, productId, orderId, userId },
  });
}

function mapBillingError(err: unknown): string {
  const code = (err as BillingError).code;
  if (code === 'USER_CANCELED') return 'Purchase canceled.';
  if (code === 'UNAVAILABLE') return 'Google Play Billing is not available on this device.';
  if (code === 'PAYMENT_ERROR') {
    return (err as Error).message ?? 'Payment failed. Please try again.';
  }
  return (err as Error).message ?? 'Something went wrong. Please try again.';
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const useBillingStore = create<BillingState>((set) => ({
  status: 'idle',
  error: null,

  purchase: async (userId) => {
    set({ status: 'purchasing', error: null });

    let result;
    try {
      result = await purchaseSubscription();
    } catch (err) {
      const code = (err as BillingError).code;
      const message = mapBillingError(err);
      // Cancellations return to idle (not an error state) so the Upgrade
      // button remains visible and usable.
      set({ status: code === 'USER_CANCELED' ? 'idle' : 'error', error: message });
      return;
    }

    const { error: fnError } = await verifyToken(
      result.token,
      result.productId,
      result.orderId,
      userId,
    );

    if (fnError) {
      set({
        status: 'error',
        error: 'Subscription verification failed. Please contact support if this persists.',
      });
      return;
    }

    await useProfileStore.getState().loadProfile(userId);
    set({ status: 'success', error: null });
  },

  restorePurchases: async (userId) => {
    set({ status: 'restoring', error: null });

    let purchases;
    try {
      purchases = await getActivePurchases();
    } catch {
      set({ status: 'idle', error: null });
      return;
    }

    if (purchases.length === 0) {
      set({ status: 'idle' });
      return;
    }

    // Re-verify the first active purchase (a user can only have one active
    // subscription at a time for this product).
    const [active] = purchases;
    const { error: fnError } = await verifyToken(
      active.token,
      active.productId,
      active.orderId,
      userId,
    );

    if (fnError) {
      // Silent failure — don't surface restore errors to the user since they
      // didn't explicitly trigger this action.
      set({ status: 'idle' });
      return;
    }

    await useProfileStore.getState().loadProfile(userId);
    set({ status: 'idle', error: null });
  },

  openManageSubscription: async () => {
    try {
      await billingOpenManage();
    } catch {
      // Ignore — the OS handles the navigation.
    }
  },

  clearError: () => set({ status: 'idle', error: null }),
}));

export default useBillingStore;
