import { test, expect } from '@playwright/test';

// NOTE: The full happy-path test (request → email link → set password → login)
// requires a real Supabase project with email delivery configured. That test
// is marked as skipped by default — run it manually in a live environment.
//
// The tests below cover UI behaviour that does not require email delivery.

// The app is served at /Summa/ (Vite base). Query params are dropped when
// Vite redirects from / to /Summa/, so we navigate to /Summa/ directly.
const BASE = '/Summa/';

test.describe('Password Reset — UI', () => {
  test('any email shows generic success message (no account-existence leak)', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('button', { name: /forgot password/i }).click();
    await page.getByLabel('Email').fill('nonexistent@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();
    await expect(page.getByRole('status')).toContainText(/if an account/i);
  });

  test('back to sign in link returns to sign-in form', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('button', { name: /forgot password/i }).click();
    await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible();
    await page.getByRole('button', { name: /back to sign in/i }).click();
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('invalid email format shows inline error on forgot-password form', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('button', { name: /forgot password/i }).click();
    await page.getByLabel('Email').fill('notanemail');
    await page.getByRole('button', { name: /send reset link/i }).click();
    await expect(page.getByText(/valid email/i)).toBeVisible();
  });

  test('expired reset token shows reset-error panel with resend form', async ({ page }) => {
    // Simulate arriving via an expired reset link: set the sessionStorage flag
    // then navigate with the error query params Supabase appends.
    await page.goto(BASE);
    await page.evaluate(() => sessionStorage.setItem('summa_reset_pending', '1'));
    await page.goto(`${BASE}?error_code=otp_expired&error=access_denied`);
    await expect(page.getByRole('heading', { name: /reset link expired/i })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
  });
});

test.describe('Password Reset — Full flow (requires live Supabase + email delivery)', () => {
  test.skip('request reset → receive email → set new password → sign in', async () => {
    // Manual test steps:
    // 1. Navigate to the app and click "Forgot password?" on the sign-in form.
    // 2. Enter a real test account email and submit.
    // 3. Verify generic success message is shown.
    // 4. Open the reset email and click the reset link.
    // 5. Verify "Set new password" form is shown (PASSWORD_RECOVERY mode).
    // 6. Enter a new valid password and confirm it, then submit.
    // 7. Verify the form disappears (password updated, recovery session consumed).
    // 8. Sign in with the new password and verify access to the app.
    // 9. Verify the old password no longer works.
  });

  test.skip('expired reset token rejects and offers resend', async () => {
    // Manual test steps:
    // 1. Request a reset link for a real account.
    // 2. Wait for the token to expire (Supabase default: 1 hour, or configure shorter).
    // 3. Click the expired link.
    // 4. Verify "Reset link expired" panel is shown.
    // 5. Enter email and request a new link — verify generic success message.
  });
});
