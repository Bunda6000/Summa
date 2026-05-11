import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(),
  },
}));

vi.mock('../../../lib/billing');
vi.mock('../../../store/useBillingStore');
vi.mock('../../../subscription/useSubscriptionStore');
vi.mock('../SupportPanel', () => ({ default: () => null }));

import useProfileStore, { type Profile } from '../../../profile/useProfileStore';
import useAuthStore from '../../../auth/useAuthStore';
import useBillingStore from '../../../store/useBillingStore';
import useSubscriptionStore from '../../../subscription/useSubscriptionStore';
import AccountModal from '../AccountModal';

const fakeSession = {
  user: { id: 'user-123', email: 'alice@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' },
  access_token: 'tok',
  refresh_token: 'ref',
} as never;

const paidActiveProfile: Profile = {
  user_id: 'user-123',
  display_name: 'Alice',
  plan: 'paid',
  subscription_status: 'active',
  renewal_date: null,
};

const paidCancelledProfile: Profile = {
  user_id: 'user-123',
  display_name: 'Alice',
  plan: 'paid',
  subscription_status: 'cancelled',
  renewal_date: null,
};

const fakeExpiryDate = '2026-06-01T00:00:00Z';

function setupBillingStore(overrides: Record<string, unknown> = {}) {
  (useBillingStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    status: 'idle',
    error: null,
    purchase: vi.fn(),
    restorePurchases: vi.fn(),
    openManageSubscription: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  });
}

function setupSubscriptionStore(overrides: Record<string, unknown> = {}) {
  (useSubscriptionStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    tier: 'active',
    loading: false,
    rawStatus: 'active',
    currentPeriodEnd: null,
    gracePeriodEnd: null,
    initSubscription: vi.fn(),
    resetSubscription: vi.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  useAuthStore.setState({
    session: fakeSession,
    loading: false,
    error: null,
    info: null,
    failedAttempts: 0,
    lockedUntil: null,
    resendCount: 0,
    resendCooldownUntil: null,
    verificationError: null,
  });

  useProfileStore.setState({ profile: paidActiveProfile, loading: false, saving: false, error: null });
  vi.spyOn(useProfileStore.getState(), 'loadProfile').mockResolvedValue(undefined);

  setupBillingStore();
  setupSubscriptionStore();
});

// ─── Cancel Subscription button ───────────────────────────────────────────────

describe('AccountModal — Cancel Subscription button', () => {
  it('is visible for paid users with active subscription', () => {
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /cancel subscription/i })).toBeInTheDocument();
  });

  it('is not visible for free users', () => {
    useProfileStore.setState({
      profile: { ...paidActiveProfile, plan: 'free' },
      loading: false,
      saving: false,
      error: null,
    });
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /cancel subscription/i })).toBeNull();
  });

  it('opens a confirmation dialog when clicked', async () => {
    render(<AccountModal onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel subscription/i }));
    // ConfirmDialog title appears after clicking Cancel Subscription
    expect(screen.getByText(/cancel subscription\?/i)).toBeInTheDocument();
  });

  it('does not call openManageSubscription until the dialog is confirmed', async () => {
    const openManage = vi.fn().mockResolvedValue(undefined);
    setupBillingStore({ openManageSubscription: openManage });

    render(<AccountModal onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel subscription/i }));

    expect(openManage).not.toHaveBeenCalled();
  });

  it('calls openManageSubscription after confirming the dialog', async () => {
    const openManage = vi.fn().mockResolvedValue(undefined);
    setupBillingStore({ openManageSubscription: openManage });

    render(<AccountModal onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel subscription/i }));

    // Confirm button label is set to "Go to Google Play" in the AccountModal
    const confirmBtn = screen.getByRole('button', { name: /go to google play/i });
    await userEvent.click(confirmBtn);

    await waitFor(() => expect(openManage).toHaveBeenCalledOnce());
  });

  it('does not call openManageSubscription when the dialog is dismissed', async () => {
    const openManage = vi.fn().mockResolvedValue(undefined);
    setupBillingStore({ openManageSubscription: openManage });

    render(<AccountModal onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel subscription/i }));

    const keepBtn = screen.getByRole('button', { name: /keep subscription/i });
    await userEvent.click(keepBtn);

    expect(openManage).not.toHaveBeenCalled();
  });

  it('closes the dialog after dismissal', async () => {
    render(<AccountModal onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel subscription/i }));

    const keepBtn = screen.getByRole('button', { name: /keep subscription/i });
    await userEvent.click(keepBtn);

    // ConfirmDialog title should be gone; AccountModal itself remains
    expect(screen.queryByText(/cancel subscription\?/i)).toBeNull();
  });
});

// ─── Pending cancellation notice ─────────────────────────────────────────────

describe('AccountModal — pending cancellation notice', () => {
  it('shows an expiry notice when subscription is cancelled but plan is still paid', () => {
    useProfileStore.setState({
      profile: paidCancelledProfile,
      loading: false,
      saving: false,
      error: null,
    });
    setupSubscriptionStore({ currentPeriodEnd: fakeExpiryDate, rawStatus: 'canceled' });

    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByText(/access ends|cancels on|expires on/i)).toBeInTheDocument();
  });

  it('shows the formatted expiry date in the notice', () => {
    useProfileStore.setState({
      profile: paidCancelledProfile,
      loading: false,
      saving: false,
      error: null,
    });
    setupSubscriptionStore({ currentPeriodEnd: fakeExpiryDate, rawStatus: 'canceled' });

    render(<AccountModal onClose={vi.fn()} />);
    // Date formatted as "Jun 1, 2026" or similar locale string
    expect(screen.getByText(/jun.*2026|2026.*jun|june.*2026/i)).toBeInTheDocument();
  });

  it('does not show the expiry notice for active paid subscriptions', () => {
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.queryByText(/access ends|cancels on|expires on/i)).toBeNull();
  });
});

// ─── Downgrade notice ────────────────────────────────────────────────────────

describe('AccountModal — downgrade notice', () => {
  it('shows a downgrade notice for paid users', () => {
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByText(/downgrade|change plan|lower plan/i)).toBeInTheDocument();
  });

  it('shows a button or link to open the Play Store for downgrade', () => {
    render(<AccountModal onClose={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /downgrade.*play|manage.*play|change.*play|go to.*play/i }) ||
      screen.getByText(/google play/i)
    ).toBeInTheDocument();
  });

  it('calls openManageSubscription when the downgrade action is confirmed', async () => {
    const openManage = vi.fn().mockResolvedValue(undefined);
    setupBillingStore({ openManageSubscription: openManage });

    render(<AccountModal onClose={vi.fn()} />);

    // "Change plan in Google Play" button triggers the downgrade confirm dialog
    const downgradeBtn = screen.getByRole('button', { name: /change plan in google play/i });
    await userEvent.click(downgradeBtn);

    // Confirm dialog appears; click "Go to Google Play" to proceed
    const confirmBtn = screen.getByRole('button', { name: /go to google play/i });
    await userEvent.click(confirmBtn);

    await waitFor(() => expect(openManage).toHaveBeenCalledOnce());
  });
});
