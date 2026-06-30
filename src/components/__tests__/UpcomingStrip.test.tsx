import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UpcomingStrip from '../UpcomingStrip';

const makeItems = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    cat: `Cat ${i + 1}`,
    sub: null,
    amount: 100 * (i + 1),
    label: 'Jul 2026',
  }));

describe('UpcomingStrip', () => {
  it('renders nothing when items is empty', () => {
    const { container } = render(<UpcomingStrip items={[]} onSeeAll={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders category names', () => {
    render(<UpcomingStrip items={makeItems(2)} onSeeAll={vi.fn()} />);
    expect(screen.getByText('Cat 1')).toBeTruthy();
    expect(screen.getByText('Cat 2')).toBeTruthy();
  });

  it('shows see-all button when items > 3', () => {
    render(<UpcomingStrip items={makeItems(5)} onSeeAll={vi.fn()} />);
    expect(screen.getByRole('button', { name: /see all/i })).toBeTruthy();
  });

  it('calls onSeeAll when see-all button is clicked', async () => {
    const onSeeAll = vi.fn();
    render(<UpcomingStrip items={makeItems(5)} onSeeAll={onSeeAll} />);
    await userEvent.click(screen.getByRole('button', { name: /see all/i }));
    expect(onSeeAll).toHaveBeenCalledOnce();
  });

  it('shows +N more count when items > 3', () => {
    render(<UpcomingStrip items={makeItems(7)} onSeeAll={vi.fn()} />);
    expect(screen.getByText(/\+4/)).toBeTruthy();
  });
});
