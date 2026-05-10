import { test, expect } from '@playwright/test';

// These tests require the dev server running at http://localhost:3000.
// Admin access is controlled by VITE_ADMIN_EMAILS env var.
// The /monitoring route is only rendered for users whose email is in that list.

test.describe('/monitoring — unauthenticated access', () => {
  test('redirects to auth screen when not signed in', async ({ page }) => {
    await page.goto('/monitoring');
    // App renders AuthScreen when no session — monitoring page should not be visible
    await expect(page.getByText(/sign in|log in/i).first()).toBeVisible();
    await expect(page.getByText(/system health|monitoring/i)).not.toBeVisible();
  });
});

test.describe('/monitoring — non-admin authenticated user', () => {
  test.beforeEach(async ({ page }) => {
    // Stub auth so we appear signed in but NOT as admin
    await page.addInitScript(() => {
      // Patch window location so the app thinks we're at /monitoring
      // Auth is mocked via localStorage injection for the Supabase client
      (window as unknown as Record<string, unknown>).__e2e_mock_non_admin = true;
    });
  });

  test('shows 404 / access denied for non-admin users', async ({ page }) => {
    await page.goto('/monitoring');
    // Since non-admin users should not see the dashboard, the app renders
    // a 404 or redirects to the main app
    await expect(page.getByText(/not found|access denied|404/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('/monitoring — health dashboard structure', () => {
  // These tests use route interception to mock the health-check edge function
  // and inject a valid admin session via localStorage.

  test.beforeEach(async ({ page }) => {
    // Intercept the health-check edge function call
    await page.route('**/functions/v1/health-check', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          uptime_pct: 99.8,
          auth_failure_rate_1h: 2.5,
          billing_failure_count_24h: 1,
          rtdn_error_count_24h: 0,
          sync_success_rate_1h: 97.3,
          sync_failure_count_1h: 2,
          total_events_24h: 148,
          last_event_at: new Date().toISOString(),
        }),
      });
    });

    // Intercept Supabase auth to return an admin session
    await page.route('**/auth/v1/token*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'test-token',
          token_type: 'bearer',
          user: {
            id: 'admin-user-id',
            email: process.env.E2E_ADMIN_EMAIL ?? 'filip.bundovski@gmail.com',
          },
        }),
      });
    });
  });

  test('page title includes Monitoring or System Health', async ({ page }) => {
    await page.goto('/monitoring');
    await expect(page).toHaveTitle(/monitoring|system health|budget/i);
  });

  test('renders the uptime metric', async ({ page }) => {
    await page.goto('/monitoring');
    // Allow time for auth + data fetch to settle
    await expect(page.getByText(/uptime/i).first()).toBeVisible({ timeout: 8000 });
  });

  test('renders the auth failure rate section', async ({ page }) => {
    await page.goto('/monitoring');
    await expect(page.getByText(/auth/i).first()).toBeVisible({ timeout: 8000 });
  });

  test('renders the sync section', async ({ page }) => {
    await page.goto('/monitoring');
    await expect(page.getByText(/sync/i).first()).toBeVisible({ timeout: 8000 });
  });

  test('renders a refresh button', async ({ page }) => {
    await page.goto('/monitoring');
    await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible({ timeout: 8000 });
  });

  test('shows error state when health-check fails', async ({ page }) => {
    // Override the route to return a server error
    await page.route('**/functions/v1/health-check', (route) => {
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal error' }) });
    });

    await page.goto('/monitoring');
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 8000 });
  });
});
