import { test, expect, Page } from '@playwright/test';

const TEST_EMAIL = `e2e-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPass1!';

async function fillSignUp(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /create account/i }).click();
}

async function fillSignIn(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
}

test.describe('Authentication', () => {
  // Create the shared test account once before any test that signs in to it.
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('/');
    // Switch to sign-up view and create the shared account.
    await page.getByRole('button', { name: /create account/i }).click();
    await fillSignUp(page, TEST_EMAIL, TEST_PASSWORD);
    // Wait for either app (email confirmation off) or confirmation message.
    await page.waitForTimeout(2000);
    await page.close();
  });

  test('sign-up with valid credentials shows the app', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
    await fillSignUp(page, TEST_EMAIL, TEST_PASSWORD);
    // After sign-up the main app header should be visible
    await expect(page.getByRole('heading', { name: /summa/i })).toBeVisible({ timeout: 10000 });
  });

  test('sign-up with invalid email shows inline error', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Email').fill('notanemail');
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/valid email/i)).toBeVisible();
  });

  test('sign-up with weak password shows policy error', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Email').fill(TEST_EMAIL);
    await page.getByLabel('Password').fill('weak');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });

  test('sign-in with valid credentials navigates to app', async ({ page }) => {
    await page.goto('/');
    // Switch to sign-in view
    await page.getByRole('button', { name: /sign in/i }).first().click();
    await fillSignIn(page, TEST_EMAIL, TEST_PASSWORD);
    await expect(page.getByRole('heading', { name: /summa/i })).toBeVisible({ timeout: 10000 });
  });

  test('sign-in with wrong password shows error', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /sign in/i }).first().click();
    await fillSignIn(page, TEST_EMAIL, 'WrongPass1!');
    await expect(page.getByText(/invalid/i)).toBeVisible();
  });

  test('session persists on reload', async ({ page }) => {
    await page.goto('/');
    // Switch to sign-in and authenticate
    await page.getByRole('button', { name: /sign in/i }).first().click();
    await fillSignIn(page, TEST_EMAIL, TEST_PASSWORD);
    await expect(page.getByRole('heading', { name: /summa/i })).toBeVisible({ timeout: 10000 });
    // Reload — user should remain signed in
    await page.reload();
    await expect(page.getByRole('heading', { name: /summa/i })).toBeVisible({ timeout: 5000 });
  });

  test('logout clears session and shows sign-in screen', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /sign in/i }).first().click();
    await fillSignIn(page, TEST_EMAIL, TEST_PASSWORD);
    await expect(page.getByRole('heading', { name: /summa/i })).toBeVisible({ timeout: 10000 });
    // Click logout
    await page.getByRole('button', { name: /logout/i }).click();
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible({ timeout: 5000 });
  });

  test('brute force: shows blocked message after 5 failed attempts', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /sign in/i }).first().click();
    for (let i = 0; i < 5; i++) {
      await page.getByLabel('Email').fill('victim@example.com');
      await page.getByLabel('Password').fill(`WrongPass${i}!`);
      await page.getByRole('button', { name: /sign in/i }).last().click();
      await page.waitForTimeout(300);
    }
    await expect(page.getByText(/temporarily blocked/i)).toBeVisible();
  });
});
