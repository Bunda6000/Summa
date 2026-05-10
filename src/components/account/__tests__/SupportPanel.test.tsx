import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../utils/supportMeta', () => ({
  SUPPORT_EMAIL: 'support@budgetplanner.app',
  getSupportMeta: vi.fn().mockResolvedValue({
    appVersion: '1.0.0',
    platform: 'web',
    os: 'macOS',
    screen: '1440x900',
  }),
  buildMailtoHref: vi.fn((_meta, type) =>
    type === 'billing'
      ? 'mailto:support@budgetplanner.app?subject=Billing+Support+Request&body=test'
      : 'mailto:support@budgetplanner.app?subject=Support+Request&body=test'
  ),
}));

import SupportPanel from '../SupportPanel';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SupportPanel — general variant', () => {
  it('renders a Contact Support link', async () => {
    render(<SupportPanel />);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /contact support/i })).toBeInTheDocument()
    );
  });

  it('shows expected response time copy', async () => {
    render(<SupportPanel />);
    await waitFor(() =>
      expect(screen.getByText(/24 hours/i)).toBeInTheDocument()
    );
  });

  it('shows a description of what support can help with', async () => {
    render(<SupportPanel />);
    await waitFor(() =>
      expect(screen.getByText(/account|billing|technical/i)).toBeInTheDocument()
    );
  });

  it('contact link has a mailto href', async () => {
    render(<SupportPanel />);
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /contact support/i });
      expect(link).toHaveAttribute('href', expect.stringContaining('mailto:'));
    });
  });

  it('does not show fallback before contact link is clicked', async () => {
    render(<SupportPanel />);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /contact support/i })).toBeInTheDocument()
    );
    expect(screen.queryByText(/copy/i)).toBeNull();
  });

  it('shows fallback with support email after clicking the contact link', async () => {
    render(<SupportPanel />);
    const link = await screen.findByRole('link', { name: /contact support/i });
    await userEvent.click(link);
    expect(screen.getByText('support@budgetplanner.app')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('copies email to clipboard when copy button is clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    render(<SupportPanel />);
    const link = await screen.findByRole('link', { name: /contact support/i });
    await userEvent.click(link);
    const copyBtn = screen.getByRole('button', { name: /copy/i });
    await userEvent.click(copyBtn);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('support@budgetplanner.app'));
  });

  it('shows Copied! feedback after copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    render(<SupportPanel />);
    const link = await screen.findByRole('link', { name: /contact support/i });
    await userEvent.click(link);
    await userEvent.click(screen.getByRole('button', { name: /copy/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument()
    );
  });
});

describe('SupportPanel — billing variant', () => {
  it('renders a Billing Support link', async () => {
    render(<SupportPanel variant="billing" />);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /billing support/i })).toBeInTheDocument()
    );
  });

  it('billing link has a mailto href with billing subject', async () => {
    render(<SupportPanel variant="billing" />);
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /billing support/i });
      expect(link).toHaveAttribute('href', expect.stringContaining('Billing'));
    });
  });

  it('shows fallback with support email after clicking billing link', async () => {
    render(<SupportPanel variant="billing" />);
    const link = await screen.findByRole('link', { name: /billing support/i });
    await userEvent.click(link);
    expect(screen.getByText('support@budgetplanner.app')).toBeInTheDocument();
  });
});
