import { test, expect } from '@playwright/test';

// These tests require a running dev server and a real Supabase project.
// Run manually: npx playwright test tests/e2e/migration.spec.ts
// They are skipped in CI by default.

test.describe('Local data migration', () => {
  test.skip('shows migration prompt when legacy data exists and user signs in', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const legacyData = JSON.stringify({
        categories: [{ id: 'cat1', name: 'Food', maxYears: 5, fields: [], subcategories: [], colOrder: [] }],
        expenses: {}, loanTypes: [], loanPaid: {}, fixedIncomes: [], variableIncomes: [], _schemaVersion: 2,
      });
      localStorage.setItem('budget-app-v2', legacyData);
    });
    await page.fill('[aria-label="Email"]', process.env.TEST_EMAIL!);
    await page.fill('[aria-label="Password"]', process.env.TEST_PASSWORD!);
    await page.click('button:has-text("Sign in")');
    await expect(page.getByText(/import your data/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /migrate my data/i })).toBeVisible();
  });

  test.skip('completes migration and removes legacy key', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const data = JSON.stringify({
        categories: [], expenses: {}, loanTypes: [], loanPaid: {}, fixedIncomes: [], variableIncomes: [], _schemaVersion: 2,
      });
      localStorage.setItem('budget-app-v2', data);
    });
    await page.fill('[aria-label="Email"]', process.env.TEST_EMAIL!);
    await page.fill('[aria-label="Password"]', process.env.TEST_PASSWORD!);
    await page.click('button:has-text("Sign in")');
    await page.click('button:has-text("Migrate my data")');
    await expect(page.getByText(/all done/i)).toBeVisible();
    await page.click('button:has-text("Continue to app")');
    const legacyKey = await page.evaluate(() => localStorage.getItem('budget-app-v2'));
    expect(legacyKey).toBeNull();
  });

  test.skip('re-shows migration prompt on next sign-in when user skips', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('budget-app-v2', JSON.stringify({
        categories: [], expenses: {}, loanTypes: [], loanPaid: {}, fixedIncomes: [], variableIncomes: [],
      }));
    });
    await page.fill('[aria-label="Email"]', process.env.TEST_EMAIL!);
    await page.fill('[aria-label="Password"]', process.env.TEST_PASSWORD!);
    await page.click('button:has-text("Sign in")');
    await page.click('button:has-text("Not now")');
    await page.click('button:has-text("Logout")');
    await page.fill('[aria-label="Email"]', process.env.TEST_EMAIL!);
    await page.fill('[aria-label="Password"]', process.env.TEST_PASSWORD!);
    await page.click('button:has-text("Sign in")');
    await expect(page.getByText(/import your data/i)).toBeVisible();
  });
});
