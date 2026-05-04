import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      updateUser: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

import { supabase } from '../../../lib/supabase';
import useAuthStore from '../../../auth/useAuthStore';
import ResetPasswordForm from '../ResetPasswordForm';

const mockUpdateUser = vi.mocked(supabase.auth.updateUser);

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ loading: false, error: null, recoveryMode: true });
});

describe('ResetPasswordForm', () => {
  it('renders new password and confirm fields', () => {
    render(<ResetPasswordForm />);
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('shows validation error for weak password', async () => {
    render(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText(/new password/i), 'weak');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'weak');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('shows error when passwords do not match', async () => {
    render(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText(/new password/i), 'StrongPass1!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Different1!');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('calls updateUser with password on valid submit', async () => {
    mockUpdateUser.mockResolvedValue({ data: {}, error: null } as never);
    render(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText(/new password/i), 'NewPass1!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'NewPass1!');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    await waitFor(() =>
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'NewPass1!' })
    );
  });

  it('surfaces store error on failed update', async () => {
    mockUpdateUser.mockResolvedValue({ data: {}, error: { message: 'Password update failed' } } as never);
    render(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText(/new password/i), 'NewPass1!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'NewPass1!');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/password update failed/i);
  });
});
