import { test, expect } from '@playwright/test';

// The app is served at /Summa/ (Vite base). Query params are dropped when
// Vite redirects from / to /Summa/, so we navigate to /Summa/ directly.
const BASE = '/Summa/';

// ── Expired / invalid token ─────────────────────────────────────────────────
test.describe('Email verification — expired token', () => {
  test('shows friendly error when URL contains otp_expired code', async ({ page }) => {
    await page.goto(
      `${BASE}?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`,
    );
    await expect(page.getByRole('heading', { name: /Verification link expired/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: /resend/i })).toBeVisible();
  });

  test('shows friendly error for generic access_denied', async ({ page }) => {
    await page.goto(`${BASE}?error=access_denied&error_description=Verification+failed`);
    await expect(page.getByText(/error|failed|problem/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: /resend/i })).toBeVisible();
  });

  test('does not show verification error panel on normal load', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByText(/expired|invalid token/i)).not.toBeVisible({ timeout: 5000 });
  });

  test('dismissing the error panel returns to sign-in form', async ({ page }) => {
    await page.goto(
      `${BASE}?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`,
    );
    await expect(page.getByRole('button', { name: /resend/i })).toBeVisible({ timeout: 8000 });
    await page.getByRole('button', { name: /back to sign in/i }).click();
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible({ timeout: 5000 });
  });
});

// ── Resend rate limit ────────────────────────────────────────────────────────
test.describe('Email verification — resend rate limit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(
      `${BASE}?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`,
    );
    await expect(page.getByRole('button', { name: /resend/i })).toBeVisible({ timeout: 8000 });
  });

  test('shows rate-limit message after threshold resend attempts', async ({ page }) => {
    const emailInput = page.getByLabel(/email/i);
    const resendBtn = page.getByRole('button', { name: /resend verification email/i });

    await emailInput.fill('test@example.com');

    // Click RESEND_THRESHOLD (3) times, waiting for each attempt to finish before
    // clicking again. Each attempt increments resendCount regardless of outcome.
    for (let i = 0; i < 3; i++) {
      await resendBtn.click();
      // Wait for the loading state to clear — button re-enables once error is set
      await expect(resendBtn).toBeEnabled({ timeout: 5000 });
    }

    // 4th click hits client-side threshold (resendCount = 3 >= RESEND_THRESHOLD)
    // and is blocked synchronously — no network call is made
    await resendBtn.click();
    await expect(page.getByText(/too many resend/i)).toBeVisible({ timeout: 5000 });
  });
});

// ── Unverified banner in Account modal ──────────────────────────────────────
// NOTE: Full end-to-end test (signup → email → click link → verified) requires
// a real email inbox or Supabase admin confirmation and is covered by manual QA.
// The unit tests in AccountModal.test.tsx cover the banner logic comprehensively.
