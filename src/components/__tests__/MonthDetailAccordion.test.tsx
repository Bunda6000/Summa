import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MonthDetailAccordion from '../MonthDetailAccordion';

describe('MonthDetailAccordion', () => {
  it('renders the toggle button', () => {
    render(<MonthDetailAccordion><p>Content</p></MonthDetailAccordion>);
    expect(screen.getByRole('button', { name: /monthly detail/i })).toBeTruthy();
  });

  it('hides children by default', () => {
    render(<MonthDetailAccordion><p>Hidden content</p></MonthDetailAccordion>);
    expect(screen.queryByText('Hidden content')).toBeNull();
  });

  it('shows children after clicking the toggle', async () => {
    render(<MonthDetailAccordion><p>Hidden content</p></MonthDetailAccordion>);
    await userEvent.click(screen.getByRole('button', { name: /monthly detail/i }));
    expect(screen.getByText('Hidden content')).toBeTruthy();
  });

  it('hides children again after clicking twice', async () => {
    render(<MonthDetailAccordion><p>Content</p></MonthDetailAccordion>);
    const btn = screen.getByRole('button', { name: /monthly detail/i });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(screen.queryByText('Content')).toBeNull();
  });
});
