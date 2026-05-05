import { Capacitor, registerPlugin } from '@capacitor/core';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PLAY_PRODUCT_ID = 'budget_planner_paid_monthly';
export const PLAY_PACKAGE_NAME = 'com.budgetplanner.app';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PurchaseResult {
  token: string;
  productId: string;
  orderId: string;
}

export type BillingErrorCode =
  | 'USER_CANCELED'
  | 'PAYMENT_ERROR'
  | 'UNAVAILABLE'
  | 'UNKNOWN';

export class BillingError extends Error {
  constructor(
    public readonly code: BillingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BillingError';
  }
}

// ---------------------------------------------------------------------------
// Native plugin interface
//
// The Capacitor plugin named 'BudgetBilling' must be registered in the
// Android app's MainActivity. On web/desktop the stub below is used instead.
// The stub surfaces a 'UNAVAILABLE' error so the UI can show a meaningful
// message when running outside of Android.
// ---------------------------------------------------------------------------

interface BudgetBillingPlugin {
  purchase(options: { productId: string }): Promise<PurchaseResult>;
  getActivePurchases(): Promise<{ purchases: PurchaseResult[] }>;
  openManageSubscription(): Promise<void>;
}

const unavailableError = new BillingError(
  'UNAVAILABLE',
  'Google Play Billing is only available on Android.',
);

// Web implementation — used in browser / test environments.
// The production path goes through Android native code.
const webStub: BudgetBillingPlugin = {
  purchase: () => Promise.reject(unavailableError),
  getActivePurchases: () => Promise.resolve({ purchases: [] }),
  openManageSubscription: () => Promise.resolve(),
};

const BudgetBilling = registerPlugin<BudgetBillingPlugin>('BudgetBilling', {
  web: async () => webStub,
});

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

export function isBillingAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

// ---------------------------------------------------------------------------
// purchaseSubscription
//
// Opens the Google Play Billing flow. Resolves with the purchase result;
// rejects with a BillingError on cancellation or payment failure.
//
// The returned token must be sent immediately to the Edge Function for
// server-side verification — it must never be stored or logged client-side.
// ---------------------------------------------------------------------------

export async function purchaseSubscription(): Promise<PurchaseResult> {
  try {
    return await BudgetBilling.purchase({ productId: PLAY_PRODUCT_ID });
  } catch (err) {
    // Re-wrap any non-BillingError from the native side
    if (err instanceof BillingError) throw err;
    throw new BillingError('UNKNOWN', (err as Error).message ?? 'Unknown billing error');
  }
}

// ---------------------------------------------------------------------------
// getActivePurchases
//
// Returns any active subscription purchases owned by the current user.
// Used on app launch to silently restore a subscription after reinstall.
// ---------------------------------------------------------------------------

export async function getActivePurchases(): Promise<PurchaseResult[]> {
  const { purchases } = await BudgetBilling.getActivePurchases();
  return purchases;
}

// ---------------------------------------------------------------------------
// openManageSubscription
//
// Opens the Google Play subscription management page for this app.
// ---------------------------------------------------------------------------

export async function openManageSubscription(): Promise<void> {
  await BudgetBilling.openManageSubscription();
}
