import { test, expect } from '@playwright/test';

// NOTE: These tests require a logged-in session and cover UI behaviour only.
// Full email-client interaction cannot be tested in a headless browser.

const BASE = '/Summa/';
const TEST_EMAIL = 'e2e-support@example.com';
const TEST_PASSWORD = 'TestPass1!';

async function signIn(page: import('@playwright/test').Page) {
  await page.goto(BASE);
  await page.getByRole('button', { name: /sign in/i }).first().click();
  await page.getByLabel('Email').fill(TEST_EMAIL);
  await page.getByLabel('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForTimeout(2000);
}

test.describe('Support & Billing Contact — UI', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(BASE);
    // Attempt sign-up to ensure test account exists (idempotent — ignores if already exists)
    await page.getByRole('button', { name: /create account/i }).click();
    await page.getByLabel('Email').fill(TEST_EMAIL);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /create account/i }).click();
    await page.waitForTimeout(2000);
    await page.close();
  });

  test('Contact Support option is visible in the Account modal', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: /account/i }).click();
    await expect(page.getByRole('link', { name: /contact support/i })).toBeVisible({ timeout: 5000 });
  });

  test('Billing Support CTA is visible in the Account modal', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: /account/i }).click();
    await expect(page.getByRole('link', { name: /billing support/i })).toBeVisible({ timeout: 5000 });
  });

  test('Contact Support link has a mailto href', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: /account/i }).click();
    const link = page.getByRole('link', { name: /contact support/i });
    await expect(link).toBeVisible({ timeout: 5000 });
    const href = await link.getAttribute('href');
    expect(href).toMatch(/^mailto:/);
  });

  test('fallback email is shown after clicking Contact Support', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: /account/i }).click();
    const link = page.getByRole('link', { name: /contact support/i });
    await expect(link).toBeVisible({ timeout: 5000 });
    await link.click();
    await expect(page.getByText('support@budgetplanner.app')).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('button', { name: /copy/i })).toBeVisible();
  });

  test('Billing Support link has a billing-specific mailto href', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: /account/i }).click();
    const link = page.getByRole('link', { name: /billing support/i });
    await expect(link).toBeVisible({ timeout: 5000 });
    const href = await link.getAttribute('href');
    expect(href).toMatch(/^mailto:/);
    expect(decodeURIComponent(href ?? '')).toMatch(/billing/i);
  });
});
