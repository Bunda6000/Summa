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

import useProfileStore, { type Profile } from '../../../profile/useProfileStore';
import useAuthStore from '../../../auth/useAuthStore';
import AccountModal from '../AccountModal';

const fakeSession = {
  user: { id: 'user-123', email: 'alice@example.com' },
  access_token: 'tok',
  refresh_token: 'ref',
} as never;

const fakeProfile: Profile = {
  user_id: 'user-123',
  display_name: 'Alice',
  plan: 'free',
  subscription_status: 'active',
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ session: fakeSession, loading: false, error: null, info: null, failedAttempts: 0, lockedUntil: null });
  useProfileStore.setState({ profile: fakeProfile, loading: false, saving: false, error: null });
  // Prevent loadProfile from hitting Supabase in tests that set state directly
  vi.spyOn(useProfileStore.getState(), 'loadProfile').mockResolvedValue(undefined);
});

describe('AccountModal', () => {
  it('renders email as read-only', () => {
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    // email should not be in an editable input
    const emailInput = screen.queryByRole('textbox', { name: /email/i });
    expect(emailInput).toBeNull();
  });

  it('renders display name in an editable input', () => {
    render(<AccountModal onClose={vi.fn()} />);
    const input = screen.getByRole('textbox', { name: /display name/i });
    expect(input).toHaveValue('Alice');
  });

  it('renders plan as Free chip', () => {
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByText(/free/i)).toBeInTheDocument();
  });

  it('renders subscription status', () => {
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it('shows email re-verification note when user tries to change email', () => {
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByText(/re.?verif/i)).toBeInTheDocument();
  });

  it('calls updateDisplayName with new name on save', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    useProfileStore.setState({ profile: fakeProfile, loading: false, saving: false, error: null });
    vi.spyOn(useProfileStore.getState(), 'updateDisplayName').mockImplementation(mockUpdate);

    render(<AccountModal onClose={vi.fn()} />);
    const input = screen.getByRole('textbox', { name: /display name/i });
    await userEvent.clear(input);
    await userEvent.type(input, 'Bob');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('user-123', 'Bob'));
  });

  it('disables save button while saving', () => {
    useProfileStore.setState({ profile: fakeProfile, loading: false, saving: true, error: null });
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
  });

  it('shows error message when save fails', () => {
    useProfileStore.setState({ profile: fakeProfile, loading: false, saving: false, error: 'Failed to save profile' });
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
  });

  it('shows loading state while profile is loading', () => {
    useProfileStore.setState({ profile: null, loading: true, saving: false, error: null });
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(<AccountModal onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
