import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Billing stub injected into the page before each test.
// It replaces the real Capacitor plugin so tests run in a standard browser.
// The stub reads window.__billingBehaviour to decide what to do.
// ---------------------------------------------------------------------------
async function injectBillingStub(page: Page, behaviour: 'success' | 'cancel' | 'payment_error') {
  await page.addInitScript((b) => {
    // @ts-expect-error window extension for testing
    window.__billingBehaviour = b;

    // Override the billing module by intercepting the dynamic import.
    // We patch the global so that billing.ts (which reads isBillingAvailable)
    // will detect our stubs instead of Capacitor native calls.
    // @ts-expect-error
    window.__billingStub = {
      isBillingAvailable: () => true,
      purchaseSubscription: () => {
        // @ts-expect-error
        const behaviour = window.__billingBehaviour;
        if (behaviour === 'success') {
          return Promise.resolve({
            token: 'stub-token-e2e',
            productId: 'budget_planner_paid_monthly',
            orderId: 'GPA.stub-order',
          });
        }
        if (behaviour === 'cancel') {
          const e = Object.assign(new Error('Purchase canceled'), { code: 'USER_CANCELED' });
          return Promise.reject(e);
        }
        const e = Object.assign(new Error('Payment declined'), { code: 'PAYMENT_ERROR' });
        return Promise.reject(e);
      },
      getActivePurchases: () => {
        // @ts-expect-error
        if (window.__billingBehaviour === 'success') {
          return Promise.resolve([{
            token: 'stub-token-e2e',
            productId: 'budget_planner_paid_monthly',
            orderId: 'GPA.stub-order',
          }]);
        }
        return Promise.resolve([]);
      },
      openManageSubscription: () => Promise.resolve(),
      PLAY_PRODUCT_ID: 'budget_planner_paid_monthly',
    };
  }, behaviour);
}

// Sign in with a pre-existing test account
async function signIn(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email').fill(process.env.E2E_EMAIL ?? 'e2e-sub@example.com');
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? 'TestPass1!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /summa/i })).toBeVisible({ timeout: 10_000 });
}

async function openAccountModal(page: Page) {
  await page.getByRole('button', { name: /account/i }).click();
  await expect(page.getByRole('dialog', { name: /account/i })).toBeVisible();
}

// ---------------------------------------------------------------------------

test.describe('Subscription — Google Play Billing', () => {
  test('Upgrade button is visible for free-plan user with confirmed email', async ({ page }) => {
    await injectBillingStub(page, 'success');
    await signIn(page);
    await openAccountModal(page);

    // Assumes test account is on free plan with confirmed email
    await expect(page.getByRole('button', { name: /upgrade/i })).toBeVisible();
  });

  test('Successful purchase unlocks paid plan', async ({ page }) => {
    await injectBillingStub(page, 'success');
    await signIn(page);
    await openAccountModal(page);

    await page.getByRole('button', { name: /upgrade/i }).click();

    // After successful purchase the Paid chip should appear
    await expect(page.getByText(/paid/i)).toBeVisible({ timeout: 15_000 });
    // Upgrade button should be gone
    await expect(page.getByRole('button', { name: /upgrade/i })).toHaveCount(0);
    // Manage Subscription should appear
    await expect(page.getByRole('button', { name: /manage subscription/i })).toBeVisible();
  });

  test('Canceling the Play dialog shows a friendly message', async ({ page }) => {
    await injectBillingStub(page, 'cancel');
    await signIn(page);
    await openAccountModal(page);

    await page.getByRole('button', { name: /upgrade/i }).click();

    await expect(page.getByText(/cancel/i)).toBeVisible({ timeout: 5_000 });
    // Plan should remain free
    await expect(page.getByText(/free/i)).toBeVisible();
  });

  test('Payment error shows a clear error message and allows retry', async ({ page }) => {
    await injectBillingStub(page, 'payment_error');
    await signIn(page);
    await openAccountModal(page);

    await page.getByRole('button', { name: /upgrade/i }).click();

    await expect(page.getByText(/payment|failed|try again/i)).toBeVisible({ timeout: 5_000 });
    // Upgrade button should still be present to allow retry
    await expect(page.getByRole('button', { name: /upgrade/i })).toBeVisible();
  });

  test('Manage Subscription button is visible for paid-plan user', async ({ page }) => {
    await injectBillingStub(page, 'success');
    await signIn(page);
    await openAccountModal(page);

    // Complete a purchase first so the plan becomes paid
    await page.getByRole('button', { name: /upgrade/i }).click();
    await expect(page.getByRole('button', { name: /manage subscription/i })).toBeVisible({ timeout: 15_000 });
  });
});
