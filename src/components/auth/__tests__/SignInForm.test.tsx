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
import SignInForm from '../SignInForm';

const mockSignIn = vi.mocked(supabase.auth.signInWithPassword);

const fakeSession = {
  user: { id: 'user-123', email: 'user@example.com' },
  access_token: 'token',
  refresh_token: 'refresh',
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ session: null, loading: false, error: null, info: null, failedAttempts: 0, lockedUntil: null });
});

describe('SignInForm', () => {
  it('renders email, password fields and a Sign in button', () => {
    render(<SignInForm onSwitchToSignUp={vi.fn()} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows email validation error on submit with blank email', async () => {
    render(<SignInForm onSwitchToSignUp={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('calls signIn with correct credentials on valid submit', async () => {
    mockSignIn.mockResolvedValue({ data: { session: fakeSession, user: fakeSession.user }, error: null } as never);
    render(<SignInForm onSwitchToSignUp={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'Str0ng!pass');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith({ email: 'user@example.com', password: 'Str0ng!pass' }));
  });

  it('shows error message on invalid credentials', async () => {
    mockSignIn.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'Invalid login credentials' } } as never);
    render(<SignInForm onSwitchToSignUp={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/invalid/i)).toBeInTheDocument();
  });

  it('shows lockout message after 5 failed attempts', async () => {
    mockSignIn.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'Invalid login credentials' } } as never);
    useAuthStore.setState({ failedAttempts: 4 });
    render(<SignInForm onSwitchToSignUp={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/temporarily blocked/i)).toBeInTheDocument();
  });

  it('disables the submit button while loading', async () => {
    mockSignIn.mockImplementation(() => new Promise(() => {})); // never resolves

    render(<SignInForm onSwitchToSignUp={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'Str0ng!pass');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
  });
});
