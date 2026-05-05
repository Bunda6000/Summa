import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/billing');
vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
  },
}));
vi.mock('../../profile/useProfileStore', () => ({
  default: {
    getState: vi.fn(() => ({ loadProfile: vi.fn() })),
  },
}));

import * as billing from '../../lib/billing';
import { supabase } from '../../lib/supabase';
import useProfileStore from '../../profile/useProfileStore';
import useBillingStore from '../useBillingStore';

const fakePurchase = {
  token: 'goog-token-abc123',
  productId: 'budget_planner_paid_monthly',
  orderId: 'GPA.3303-7704-1235-67938',
};

beforeEach(() => {
  vi.clearAllMocks();
  useBillingStore.setState({ status: 'idle', error: null });
});

// ─── purchase() ──────────────────────────────────────────────────────────────

describe('purchase', () => {
  it('calls purchaseSubscription once', async () => {
    vi.mocked(billing.purchaseSubscription).mockResolvedValueOnce(fakePurchase);
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: {}, error: null });

    await useBillingStore.getState().purchase('uid-1');

    expect(billing.purchaseSubscription).toHaveBeenCalledOnce();
  });

  it('invokes verify-play-purchase with token + userId', async () => {
    vi.mocked(billing.purchaseSubscription).mockResolvedValueOnce(fakePurchase);
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: {}, error: null });

    await useBillingStore.getState().purchase('uid-1');

    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'verify-play-purchase',
      expect.objectContaining({
        body: expect.objectContaining({
          token: fakePurchase.token,
          productId: fakePurchase.productId,
          userId: 'uid-1',
        }),
      }),
    );
  });

  it('reloads the profile after a successful purchase', async () => {
    const loadProfile = vi.fn();
    vi.mocked(useProfileStore.getState).mockReturnValue({ loadProfile } as never);
    vi.mocked(billing.purchaseSubscription).mockResolvedValueOnce(fakePurchase);
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: {}, error: null });

    await useBillingStore.getState().purchase('uid-1');

    expect(loadProfile).toHaveBeenCalledWith('uid-1');
  });

  it('sets status to success after a completed purchase', async () => {
    vi.mocked(billing.purchaseSubscription).mockResolvedValueOnce(fakePurchase);
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: {}, error: null });

    await useBillingStore.getState().purchase('uid-1');

    expect(useBillingStore.getState().status).toBe('success');
    expect(useBillingStore.getState().error).toBeNull();
  });

  it('sets status idle + cancellation message when user dismisses the dialog', async () => {
    const err = Object.assign(new Error('Purchase canceled'), { code: 'USER_CANCELED' });
    vi.mocked(billing.purchaseSubscription).mockRejectedValueOnce(err);

    await useBillingStore.getState().purchase('uid-1');

    expect(useBillingStore.getState().status).toBe('idle');
    expect(useBillingStore.getState().error).toMatch(/cancel/i);
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('sets status error on payment failure', async () => {
    const err = Object.assign(new Error('Payment declined'), { code: 'PAYMENT_ERROR' });
    vi.mocked(billing.purchaseSubscription).mockRejectedValueOnce(err);

    await useBillingStore.getState().purchase('uid-1');

    expect(useBillingStore.getState().status).toBe('error');
    expect(useBillingStore.getState().error).not.toBeNull();
  });

  it('sets status error when backend verification fails', async () => {
    vi.mocked(billing.purchaseSubscription).mockResolvedValueOnce(fakePurchase);
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: { message: 'Invalid token' },
    });

    await useBillingStore.getState().purchase('uid-1');

    expect(useBillingStore.getState().status).toBe('error');
    expect(supabase.functions.invoke).toHaveBeenCalledOnce();
  });

  it('does not call verify edge function when purchase is canceled', async () => {
    const err = Object.assign(new Error('canceled'), { code: 'USER_CANCELED' });
    vi.mocked(billing.purchaseSubscription).mockRejectedValueOnce(err);

    await useBillingStore.getState().purchase('uid-1');

    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });
});

// ─── restorePurchases() ───────────────────────────────────────────────────────

describe('restorePurchases', () => {
  it('calls getActivePurchases', async () => {
    vi.mocked(billing.getActivePurchases).mockResolvedValueOnce([]);

    await useBillingStore.getState().restorePurchases('uid-1');

    expect(billing.getActivePurchases).toHaveBeenCalledOnce();
  });

  it('calls verify-play-purchase for each active purchase', async () => {
    vi.mocked(billing.getActivePurchases).mockResolvedValueOnce([fakePurchase]);
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: {}, error: null });

    await useBillingStore.getState().restorePurchases('uid-1');

    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'verify-play-purchase',
      expect.objectContaining({
        body: expect.objectContaining({ token: fakePurchase.token, userId: 'uid-1' }),
      }),
    );
  });

  it('does not call verify edge function when no active purchases exist', async () => {
    vi.mocked(billing.getActivePurchases).mockResolvedValueOnce([]);

    await useBillingStore.getState().restorePurchases('uid-1');

    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('reloads the profile after restore', async () => {
    const loadProfile = vi.fn();
    vi.mocked(useProfileStore.getState).mockReturnValue({ loadProfile } as never);
    vi.mocked(billing.getActivePurchases).mockResolvedValueOnce([fakePurchase]);
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: {}, error: null });

    await useBillingStore.getState().restorePurchases('uid-1');

    expect(loadProfile).toHaveBeenCalledWith('uid-1');
  });

  it('sets status idle and no error when restore succeeds', async () => {
    vi.mocked(billing.getActivePurchases).mockResolvedValueOnce([fakePurchase]);
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: {}, error: null });

    await useBillingStore.getState().restorePurchases('uid-1');

    expect(useBillingStore.getState().status).toBe('idle');
    expect(useBillingStore.getState().error).toBeNull();
  });
});

// ─── openManageSubscription() ─────────────────────────────────────────────────

describe('openManageSubscription', () => {
  it('delegates to billing.openManageSubscription', async () => {
    vi.mocked(billing.openManageSubscription).mockResolvedValueOnce(undefined);

    await useBillingStore.getState().openManageSubscription();

    expect(billing.openManageSubscription).toHaveBeenCalledOnce();
  });
});

// ─── clearError() ─────────────────────────────────────────────────────────────

describe('clearError', () => {
  it('resets error to null', () => {
    useBillingStore.setState({ status: 'error', error: 'Something went wrong' });

    useBillingStore.getState().clearError();

    expect(useBillingStore.getState().error).toBeNull();
    expect(useBillingStore.getState().status).toBe('idle');
  });
});
