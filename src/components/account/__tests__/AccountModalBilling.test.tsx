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

import useProfileStore, { type Profile } from '../../../profile/useProfileStore';
import useAuthStore from '../../../auth/useAuthStore';
import useBillingStore from '../../../store/useBillingStore';
import AccountModal from '../AccountModal';

const fakeSession = {
  user: { id: 'user-123', email: 'alice@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' },
  access_token: 'tok',
  refresh_token: 'ref',
} as never;

const freeProfile: Profile = {
  user_id: 'user-123',
  display_name: 'Alice',
  plan: 'free',
  subscription_status: 'active',
  renewal_date: null,
};

const paidProfile: Profile = {
  user_id: 'user-123',
  display_name: 'Alice',
  plan: 'paid',
  subscription_status: 'active',
  renewal_date: '2026-06-01T10:00:00Z',
};

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
  useProfileStore.setState({ profile: freeProfile, loading: false, saving: false, error: null });
  vi.spyOn(useProfileStore.getState(), 'loadProfile').mockResolvedValue(undefined);

  // Default billing store state
  (useBillingStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    status: 'idle',
    error: null,
    purchase: vi.fn(),
    restorePurchases: vi.fn(),
    openManageSubscription: vi.fn(),
    clearError: vi.fn(),
  });
});

// ─── Upgrade button behaviour ─────────────────────────────────────────────────

describe('AccountModal — Upgrade button', () => {
  it('is visible for free-plan users with a confirmed email', () => {
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /upgrade/i })).toBeInTheDocument();
  });

  it('is not visible for paid-plan users', () => {
    useProfileStore.setState({ profile: paidProfile, loading: false, saving: false, error: null });
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /upgrade/i })).toBeNull();
  });

  it('calls billing store purchase with the user id when clicked', async () => {
    const mockPurchase = vi.fn().mockResolvedValue(undefined);
    (useBillingStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      status: 'idle',
      error: null,
      purchase: mockPurchase,
      restorePurchases: vi.fn(),
      openManageSubscription: vi.fn(),
      clearError: vi.fn(),
    });

    render(<AccountModal onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /upgrade/i }));

    await waitFor(() => expect(mockPurchase).toHaveBeenCalledWith('user-123'));
  });

  it('shows a spinner / disabled state while purchasing', () => {
    (useBillingStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      status: 'purchasing',
      error: null,
      purchase: vi.fn(),
      restorePurchases: vi.fn(),
      openManageSubscription: vi.fn(),
      clearError: vi.fn(),
    });

    render(<AccountModal onClose={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /processing|purchasing/i });
    expect(btn).toBeDisabled();
  });
});

// ─── Manage Subscription button ───────────────────────────────────────────────

describe('AccountModal — Manage Subscription button', () => {
  it('is visible for paid-plan users', () => {
    useProfileStore.setState({ profile: paidProfile, loading: false, saving: false, error: null });
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /manage subscription/i })).toBeInTheDocument();
  });

  it('is not visible for free-plan users', () => {
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /manage subscription/i })).toBeNull();
  });

  it('calls openManageSubscription when clicked', async () => {
    const openManage = vi.fn().mockResolvedValue(undefined);
    (useBillingStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      status: 'idle',
      error: null,
      purchase: vi.fn(),
      restorePurchases: vi.fn(),
      openManageSubscription: openManage,
      clearError: vi.fn(),
    });
    useProfileStore.setState({ profile: paidProfile, loading: false, saving: false, error: null });

    render(<AccountModal onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /manage subscription/i }));

    await waitFor(() => expect(openManage).toHaveBeenCalledOnce());
  });
});

// ─── Billing error display ────────────────────────────────────────────────────

describe('AccountModal — billing errors', () => {
  it('shows a billing error message when billing store has an error', () => {
    (useBillingStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      status: 'error',
      error: 'Payment failed. Please try again.',
      purchase: vi.fn(),
      restorePurchases: vi.fn(),
      openManageSubscription: vi.fn(),
      clearError: vi.fn(),
    });

    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByText(/payment failed/i)).toBeInTheDocument();
  });

  it('shows a cancellation message when the user dismisses the Play dialog', () => {
    (useBillingStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      status: 'idle',
      error: 'Purchase canceled.',
      purchase: vi.fn(),
      restorePurchases: vi.fn(),
      openManageSubscription: vi.fn(),
      clearError: vi.fn(),
    });

    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByText(/canceled/i)).toBeInTheDocument();
  });
});
