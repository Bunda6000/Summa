import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HeroMonthCard from '../HeroMonthCard';

describe('HeroMonthCard', () => {
  const baseProps = {
    monthLabel: 'June 2026',
    income: 4200,
    paid: 2850,
    balance: 1350,
  };

  it('displays the month label', () => {
    render(<HeroMonthCard {...baseProps} />);
    expect(screen.getByText('June 2026')).toBeTruthy();
  });

  it('displays income value', () => {
    render(<HeroMonthCard {...baseProps} />);
    expect(screen.getByText(/4[,.]?200/)).toBeTruthy();
  });

  it('displays balance value', () => {
    render(<HeroMonthCard {...baseProps} />);
    expect(screen.getByText(/1[,.]?350/)).toBeTruthy();
  });

  it('displays progress text showing paid vs income', () => {
    render(<HeroMonthCard {...baseProps} />);
    expect(screen.getByText(/2[,.]?850/)).toBeTruthy();
  });

  it('does not crash when income is zero', () => {
    render(<HeroMonthCard {...baseProps} income={0} paid={0} balance={0} />);
    expect(screen.getByText('June 2026')).toBeTruthy();
  });
});
