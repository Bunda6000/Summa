import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CategoryGridCard from '../CategoryGridCard';

describe('CategoryGridCard', () => {
  const baseProps = {
    name: 'Housing',
    hasDataThisMonth: false,
    onPress: vi.fn(),
  };

  it('displays the category name', () => {
    render(<CategoryGridCard {...baseProps} />);
    expect(screen.getByText('Housing')).toBeTruthy();
  });

  it('calls onPress when clicked', () => {
    const onPress = vi.fn();
    render(<CategoryGridCard {...baseProps} onPress={onPress} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('shows accent dot when hasDataThisMonth is true', () => {
    const { container } = render(<CategoryGridCard {...baseProps} hasDataThisMonth />);
    expect(container.querySelector('[data-active-dot]')).toBeTruthy();
  });

  it('does not show accent dot when hasDataThisMonth is false', () => {
    const { container } = render(<CategoryGridCard {...baseProps} hasDataThisMonth={false} />);
    expect(container.querySelector('[data-active-dot]')).toBeNull();
  });
});
