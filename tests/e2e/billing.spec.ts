import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email').fill(process.env.E2E_EMAIL ?? 'e2e-billing@example.com');
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? 'TestPass1!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /summa/i })).toBeVisible({ timeout: 10_000 });
}

async function openAccountModal(page: Page) {
  await page.getByRole('button', { name: /account/i }).click();
  await expect(page.getByRole('dialog', { name: /account/i })).toBeVisible();
}

async function openBillingModal(page: Page) {
  await openAccountModal(page);
  await page.getByRole('button', { name: /billing.*receipts|view billing/i }).click();
  await expect(page.getByRole('dialog', { name: /billing/i })).toBeVisible({ timeout: 5_000 });
}

// Intercept the purchase_history Supabase query to return stub data
async function stubPaidBillingData(page: Page) {
  await page.route('**/rest/v1/purchase_history**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'r1',
          order_id: 'GPA.3303-stub-0001',
          product_id: 'budget_planner_paid_monthly',
          purchase_token: 'tok-stub-aaa',
          status: 'purchased',
          purchased_at: '2026-04-01T10:00:00Z',
          expires_at: '2026-05-01T10:00:00Z',
        },
      ]),
    });
  });
}

async function stubEmptyBillingData(page: Page) {
  await page.route('**/rest/v1/purchase_history**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

async function stubBillingError(page: Page) {
  await page.route('**/rest/v1/purchase_history**', (route) => {
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Internal Server Error' }) });
  });
}

// ---------------------------------------------------------------------------

test.describe('Billing UI — paid user', () => {
  test.beforeEach(async ({ page }) => {
    await stubPaidBillingData(page);
    await signIn(page);
  });

  test('Billing modal opens from the Account modal', async ({ page }) => {
    await openBillingModal(page);
    await expect(page.getByRole('dialog', { name: /billing/i })).toBeVisible();
  });

  test('Billing summary shows account email', async ({ page }) => {
    await openBillingModal(page);
    await expect(page.getByText(process.env.E2E_EMAIL ?? 'e2e-billing@example.com')).toBeVisible();
  });

  test('Billing summary shows subscription status', async ({ page }) => {
    await openBillingModal(page);
    await expect(page.getByText(/active|grace period|expired|canceled/i)).toBeVisible();
  });

  test('Receipts list shows past purchases', async ({ page }) => {
    await openBillingModal(page);
    await expect(page.getByText('GPA.3303-stub-0001')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/purchased/i)).toBeVisible();
  });

  test('Clicking a receipt opens a new tab to Google Play', async ({ page, context }) => {
    await openBillingModal(page);
    await page.getByText('GPA.3303-stub-0001').waitFor();

    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.getByText('GPA.3303-stub-0001').click(),
    ]);

    await expect(newPage).toHaveURL(/play\.google\.com/);
  });
});

test.describe('Billing UI — free user / no subscription', () => {
  test.beforeEach(async ({ page }) => {
    await stubEmptyBillingData(page);
    await signIn(page);
  });

  test('Billing modal shows no-billing-info message for free users', async ({ page }) => {
    await openBillingModal(page);
    await expect(page.getByText(/no billing information/i)).toBeVisible({ timeout: 5_000 });
  });

  test('Renewal date field is not shown for free users with no history', async ({ page }) => {
    await openBillingModal(page);
    await expect(page.getByText(/renewal date/i)).toHaveCount(0);
  });
});

test.describe('Billing UI — error handling', () => {
  test('Shows a friendly error and retry button when the backend fails', async ({ page }) => {
    await stubBillingError(page);
    await signIn(page);
    await openBillingModal(page);

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
  });

  test('Retry button re-fetches billing data', async ({ page }) => {
    let callCount = 0;
    await page.route('**/rest/v1/purchase_history**', (route) => {
      callCount++;
      if (callCount === 1) {
        route.fulfill({ status: 500, body: '{}' });
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
    });

    await signIn(page);
    await openBillingModal(page);

    await page.getByRole('button', { name: /retry/i }).click();
    // After retry the error should be gone
    await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 5_000 });
  });
});
