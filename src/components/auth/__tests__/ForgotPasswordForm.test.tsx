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
import ForgotPasswordForm from '../ForgotPasswordForm';

const mockResetPasswordForEmail = vi.mocked(supabase.auth.resetPasswordForEmail);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  useAuthStore.setState({
    loading: false, error: null, info: null,
    recoveryMode: false, resetError: null,
  });
});

describe('ForgotPasswordForm', () => {
  it('renders email field and submit button', () => {
    render(<ForgotPasswordForm onSwitchToSignIn={vi.fn()} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('shows inline validation error for malformed email', async () => {
    render(<ForgotPasswordForm onSwitchToSignIn={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'notanemail');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('calls requestPasswordReset with email on valid submit', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null } as never);
    render(<ForgotPasswordForm onSwitchToSignIn={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    await waitFor(() =>
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        'user@example.com',
        { redirectTo: window.location.origin }
      )
    );
  });

  it('displays generic info message from the store', () => {
    useAuthStore.setState({ info: 'If an account with that email exists, a reset link has been sent.' });
    render(<ForgotPasswordForm onSwitchToSignIn={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(/if an account/i);
  });

  it('calls onSwitchToSignIn when back link is clicked', async () => {
    const onSwitch = vi.fn();
    render(<ForgotPasswordForm onSwitchToSignIn={onSwitch} />);
    await userEvent.click(screen.getByRole('button', { name: /back to sign in/i }));
    expect(onSwitch).toHaveBeenCalled();
  });
});
