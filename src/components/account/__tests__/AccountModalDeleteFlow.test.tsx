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
    functions: { invoke: vi.fn() },
    from: vi.fn(),
  },
}));

import useProfileStore, { type Profile } from '../../../profile/useProfileStore';
import useAuthStore from '../../../auth/useAuthStore';
import AccountModal from '../AccountModal';

const fakeSession = {
  user: { id: 'user-123', email: 'alice@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' },
  access_token: 'tok',
  refresh_token: 'ref',
} as never;

const fakeProfile: Profile = {
  user_id: 'user-123',
  display_name: 'Alice',
  plan: 'free',
  subscription_status: 'active',
  renewal_date: null,
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
    recoveryMode: false,
    resetError: null,
  });
  useProfileStore.setState({ profile: fakeProfile, loading: false, saving: false, error: null });
  vi.spyOn(useProfileStore.getState(), 'loadProfile').mockResolvedValue(undefined);
});

describe('AccountModal — delete account', () => {
  it('shows a Delete Account button', () => {
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument();
  });

  it('opens a confirmation dialog when Delete Account is clicked', async () => {
    render(<AccountModal onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    expect(screen.getByText(/permanently delete/i)).toBeInTheDocument();
  });

  it('does not call deleteAccount if user cancels the dialog', async () => {
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(useAuthStore.getState(), 'deleteAccount').mockImplementation(mockDelete);

    render(<AccountModal onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('calls deleteAccount when the user confirms deletion', async () => {
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(useAuthStore.getState(), 'deleteAccount').mockImplementation(mockDelete);

    render(<AccountModal onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    await userEvent.click(screen.getByRole('button', { name: /delete forever/i }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledOnce());
  });

  it('closes the modal after successful account deletion', async () => {
    const mockDelete = vi.fn().mockImplementation(async () => {
      useAuthStore.setState({ error: null });
    });
    vi.spyOn(useAuthStore.getState(), 'deleteAccount').mockImplementation(mockDelete);
    const onClose = vi.fn();

    render(<AccountModal onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    await userEvent.click(screen.getByRole('button', { name: /delete forever/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('does not close the modal when deletion fails', async () => {
    const mockDelete = vi.fn().mockImplementation(async () => {
      useAuthStore.setState({ error: 'Failed to delete account. Please try again.' });
    });
    vi.spyOn(useAuthStore.getState(), 'deleteAccount').mockImplementation(mockDelete);
    const onClose = vi.fn();

    render(<AccountModal onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    await userEvent.click(screen.getByRole('button', { name: /delete forever/i }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a Privacy Policy link', () => {
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByRole('link', { name: /privacy policy/i })).toBeInTheDocument();
  });

  it('shows a Terms of Service link', () => {
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByRole('link', { name: /terms of service/i })).toBeInTheDocument();
  });
});
