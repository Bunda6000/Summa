import { test, expect, Page } from '@playwright/test';

// Inject billing stub that simulates a trial purchase (paymentState=2).
// The backend verify-play-purchase function reads the real Google Play API;
// in E2E we stub the client-side billing plugin and rely on the test Supabase
// edge function being pointed at a stub that returns paymentState=2.
async function injectTrialBillingStub(page: Page) {
  await page.addInitScript(() => {
    // @ts-expect-error window extension for testing
    window.__billingBehaviour = 'trial';

    // @ts-expect-error
    window.__billingStub = {
      isBillingAvailable: () => true,
      purchaseSubscription: () =>
        Promise.resolve({
          token: 'stub-trial-token-e2e',
          productId: 'budget_planner_paid_monthly',
          orderId: 'GPA.stub-trial-order',
        }),
      getActivePurchases: () =>
        Promise.resolve([
          {
            token: 'stub-trial-token-e2e',
            productId: 'budget_planner_paid_monthly',
            orderId: 'GPA.stub-trial-order',
          },
        ]),
      openManageSubscription: () => Promise.resolve(),
      PLAY_PRODUCT_ID: 'budget_planner_paid_monthly',
    };
  });
}

async function injectPaidBillingStub(page: Page) {
  await page.addInitScript(() => {
    // @ts-expect-error window extension for testing
    window.__billingBehaviour = 'success';

    // @ts-expect-error
    window.__billingStub = {
      isBillingAvailable: () => true,
      purchaseSubscription: () =>
        Promise.resolve({
          token: 'stub-token-e2e',
          productId: 'budget_planner_paid_monthly',
          orderId: 'GPA.stub-order',
        }),
      getActivePurchases: () => Promise.resolve([]),
      openManageSubscription: () => Promise.resolve(),
      PLAY_PRODUCT_ID: 'budget_planner_paid_monthly',
    };
  });
}

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email').fill(process.env.E2E_TRIAL_EMAIL ?? 'e2e-trial@example.com');
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? 'TestPass1!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /summa/i })).toBeVisible({ timeout: 10_000 });
}

async function openAccountModal(page: Page) {
  await page.getByRole('button', { name: /account/i }).click();
  await expect(page.getByRole('dialog', { name: /account/i })).toBeVisible();
}

test.describe('Trial Period', () => {
  test('trial banner is visible with days remaining after trial activation', async ({ page }) => {
    await injectTrialBillingStub(page);
    await signIn(page);

    // Start a trial
    await openAccountModal(page);
    await page.getByRole('button', { name: /start free trial/i }).click();

    // Banner should appear in the main UI
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/free trial/i)).toBeVisible();
    await expect(page.getByText(/day/i)).toBeVisible();
  });

  test('account modal shows Trial chip and trial dates', async ({ page }) => {
    await injectTrialBillingStub(page);
    await signIn(page);

    await openAccountModal(page);
    await page.getByRole('button', { name: /start free trial/i }).click();

    // Re-open modal to see updated state
    await expect(page.getByRole('dialog', { name: /account/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/trial/i)).toBeVisible();
    // Trial end date should be displayed
    await expect(page.getByText(/trial ends/i)).toBeVisible();
  });

  test('Subscribe Now button in trial banner triggers purchase flow', async ({ page }) => {
    await injectPaidBillingStub(page);
    await signIn(page);

    // Simulate user already being in trial state by checking if Subscribe Now is shown
    // when the banner is visible and clicking it
    await expect(page.getByRole('button', { name: /subscribe now/i })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /subscribe now/i }).click();

    // After successful purchase, plan should become paid
    await expect(page.getByText(/paid/i)).toBeVisible({ timeout: 15_000 });
  });

  test('paid features are accessible during trial', async ({ page }) => {
    await injectTrialBillingStub(page);
    await signIn(page);

    // The app should not show any locked-feature overlays during trial
    const lockedOverlay = page.locator('[data-testid="locked-feature"]');
    await expect(lockedOverlay).toHaveCount(0);
  });
});
