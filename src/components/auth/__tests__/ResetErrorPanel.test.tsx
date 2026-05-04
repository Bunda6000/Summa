import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

import { supabase } from '../../../lib/supabase';
import useAuthStore from '../../../auth/useAuthStore';
import ResetErrorPanel from '../ResetErrorPanel';

const mockResetPasswordForEmail = vi.mocked(supabase.auth.resetPasswordForEmail);
const EXPIRED_MSG = 'The password reset link has expired. Please request a new one.';

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  useAuthStore.setState({ loading: false, error: null, info: null, resetError: EXPIRED_MSG });
});

describe('ResetErrorPanel', () => {
  it('displays the expired error message', () => {
    render(<ResetErrorPanel error={EXPIRED_MSG} onDismiss={vi.fn()} />);
    expect(screen.getByText(EXPIRED_MSG)).toBeInTheDocument();
  });

  it('calls requestPasswordReset when resend form submitted with email', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null } as never);
    render(<ResetErrorPanel error={EXPIRED_MSG} onDismiss={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send new reset link/i }));
    await waitFor(() =>
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        'user@example.com',
        { redirectTo: window.location.origin }
      )
    );
  });

  it('shows generic info message after resend', () => {
    useAuthStore.setState({ info: 'If an account with that email exists, a reset link has been sent.' });
    render(<ResetErrorPanel error={EXPIRED_MSG} onDismiss={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(/if an account/i);
  });

  it('calls clearResetError and onDismiss when back link clicked', async () => {
    const onDismiss = vi.fn();
    render(<ResetErrorPanel error={EXPIRED_MSG} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: /back to sign in/i }));
    expect(useAuthStore.getState().resetError).toBeNull();
    expect(onDismiss).toHaveBeenCalled();
  });
});
