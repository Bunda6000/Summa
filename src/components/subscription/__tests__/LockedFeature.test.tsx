import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import LockedFeature from '../LockedFeature';
import useSubscriptionStore from '../../../subscription/useSubscriptionStore';
import type { SubscriptionTier } from '../../../subscription/featureFlags';

vi.mock('../../../subscription/useSubscriptionStore');

const mockUseSubscriptionStore = vi.mocked(useSubscriptionStore);

function setTier(tier: SubscriptionTier) {
  // Zustand stores are called with a selector: useStore(state => state.tier)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseSubscriptionStore.mockImplementation((selector: any) => selector({ tier }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LockedFeature', () => {
  it('renders children when user has active subscription', () => {
    setTier('active');
    render(
      <LockedFeature featureKey="budget_view">
        <div>Budget Content</div>
      </LockedFeature>
    );
    expect(screen.getByText('Budget Content')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /upgrade now/i })).not.toBeInTheDocument();
  });

  it('renders children during grace period', () => {
    setTier('grace_period');
    render(
      <LockedFeature featureKey="budget_view">
        <div>Budget Content</div>
      </LockedFeature>
    );
    expect(screen.getByText('Budget Content')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /upgrade now/i })).not.toBeInTheDocument();
  });

  it('shows locked overlay for free users', () => {
    setTier('free');
    render(
      <LockedFeature featureKey="budget_view">
        <div>Budget Content</div>
      </LockedFeature>
    );
    expect(screen.getByRole('link', { name: /upgrade now/i })).toBeInTheDocument();
    expect(screen.getByText(/paid/i)).toBeInTheDocument();
  });

  it('shows locked overlay for expired subscriptions', () => {
    setTier('expired');
    render(
      <LockedFeature featureKey="loans_view">
        <div>Loans Content</div>
      </LockedFeature>
    );
    expect(screen.getByRole('link', { name: /upgrade now/i })).toBeInTheDocument();
  });

  it('shows locked overlay for canceled subscriptions', () => {
    setTier('canceled');
    render(
      <LockedFeature featureKey="budget_view">
        <div>Budget Content</div>
      </LockedFeature>
    );
    expect(screen.getByRole('link', { name: /upgrade now/i })).toBeInTheDocument();
  });

  it('shows a lock icon when locked', () => {
    setTier('free');
    render(
      <LockedFeature featureKey="budget_view">
        <div>Budget Content</div>
      </LockedFeature>
    );
    expect(screen.getByRole('img', { name: /locked/i })).toBeInTheDocument();
  });

  it('renders without restriction for a free-tier feature key', () => {
    setTier('free');
    render(
      <LockedFeature featureKey="dashboard_overview">
        <div>Dashboard</div>
      </LockedFeature>
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /upgrade now/i })).not.toBeInTheDocument();
  });
});
