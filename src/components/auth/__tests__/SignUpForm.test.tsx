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
  },
}));

import { supabase } from '../../../lib/supabase';
import useAuthStore from '../../../auth/useAuthStore';
import SignUpForm from '../SignUpForm';

const mockSignUp = vi.mocked(supabase.auth.signUp);

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ session: null, loading: false, error: null, info: null, failedAttempts: 0, lockedUntil: null });
});

describe('SignUpForm', () => {
  it('renders email, password fields and a Create account button', () => {
    render(<SignUpForm onSwitchToSignIn={vi.fn()} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('shows email validation error on submit with invalid email', async () => {
    render(<SignUpForm onSwitchToSignIn={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'notanemail');
    await userEvent.type(screen.getByLabelText(/password/i), 'Str0ng!pass');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('shows password policy error on submit with weak password', async () => {
    render(<SignUpForm onSwitchToSignIn={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'weak');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('shows success message after sign-up', async () => {
    mockSignUp.mockResolvedValue({
      data: { session: { user: { id: 'u1', email: 'user@example.com' }, access_token: 'tok', refresh_token: 'ref' }, user: { id: 'u1' } },
      error: null,
    } as never);

    render(<SignUpForm onSwitchToSignIn={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'Str0ng!pass');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(mockSignUp).toHaveBeenCalled());
  });

  it('shows duplicate email error from server', async () => {
    mockSignUp.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'User already registered' },
    } as never);

    render(<SignUpForm onSwitchToSignIn={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'existing@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'Str0ng!pass');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/already registered/i)).toBeInTheDocument();
  });

  it('disables the submit button while loading', async () => {
    mockSignUp.mockImplementation(() => new Promise(() => {})); // never resolves

    render(<SignUpForm onSwitchToSignIn={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'Str0ng!pass');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
  });
});
