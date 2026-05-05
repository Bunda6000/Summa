import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from '../ConfirmDialog';

const defaultProps = {
  title: 'Cancel Subscription',
  message: 'Are you sure you want to cancel?',
  confirmLabel: 'Yes, cancel',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('ConfirmDialog', () => {
  it('renders the title and message', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to cancel?')).toBeInTheDocument();
  });

  it('renders a confirm button with the provided label', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: /yes, cancel/i })).toBeInTheDocument();
  });

  it('renders a cancel / dismiss button', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: /keep subscription|go back|dismiss/i })).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: /yes, cancel/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when the dismiss button is clicked', async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    const dismissBtn = screen.getByRole('button', { name: /keep subscription|go back|dismiss/i });
    await userEvent.click(dismissBtn);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onCancel when the backdrop is clicked', async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('uses a default confirm label when none is provided', () => {
    render(<ConfirmDialog title="Confirm" message="Are you sure?" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
  });
});
