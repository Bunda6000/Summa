import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SegmentedToggle from '../SegmentedToggle';

const OPTIONS = [
  { id: 'fixed', label: 'Fixed' },
  { id: 'variable', label: 'Variable' },
];

describe('SegmentedToggle', () => {
  it('renders both options', () => {
    render(<SegmentedToggle options={OPTIONS} value="fixed" onChange={vi.fn()} />);
    expect(screen.getByText('Fixed')).toBeTruthy();
    expect(screen.getByText('Variable')).toBeTruthy();
  });

  it('marks the active option with aria-pressed', () => {
    render(<SegmentedToggle options={OPTIONS} value="fixed" onChange={vi.fn()} />);
    const fixedBtn = screen.getByRole('button', { name: 'Fixed' });
    const varBtn = screen.getByRole('button', { name: 'Variable' });
    expect(fixedBtn.getAttribute('aria-pressed')).toBe('true');
    expect(varBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onChange with the clicked option id', async () => {
    const onChange = vi.fn();
    render(<SegmentedToggle options={OPTIONS} value="fixed" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Variable' }));
    expect(onChange).toHaveBeenCalledWith('variable');
  });

  it('does not call onChange when clicking the already-active option', async () => {
    const onChange = vi.fn();
    render(<SegmentedToggle options={OPTIONS} value="fixed" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Fixed' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
