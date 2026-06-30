import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BottomPillNav from '../BottomPillNav';

const TABS = ['dashboard', 'expenses', 'incomes', 'budget'] as const;

describe('BottomPillNav', () => {
  it('renders all four nav items', () => {
    render(<BottomPillNav tab="dashboard" setTab={vi.fn()} />);
    expect(screen.getByRole('button', { name: /home/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /expenses/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /incomes/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /budget/i })).toBeTruthy();
  });

  it('marks the active tab with aria-current', () => {
    render(<BottomPillNav tab="expenses" setTab={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /expenses/i });
    expect(btn.getAttribute('aria-current')).toBe('page');
  });

  it('calls setTab with the correct value on press', async () => {
    const setTab = vi.fn();
    render(<BottomPillNav tab="dashboard" setTab={setTab} />);
    await userEvent.click(screen.getByRole('button', { name: /budget/i }));
    expect(setTab).toHaveBeenCalledWith('budget');
  });

  it('does not mark inactive tabs with aria-current', () => {
    render(<BottomPillNav tab="dashboard" setTab={vi.fn()} />);
    const expBtn = screen.getByRole('button', { name: /expenses/i });
    expect(expBtn.getAttribute('aria-current')).toBeNull();
  });
});
