import { describe, it, expect } from 'vitest';
import { computeAccessTier, isFeatureAllowed } from '../featureFlags';

const PAST = '2020-01-01T00:00:00Z';
const FUTURE = '2099-01-01T00:00:00Z';

describe('computeAccessTier', () => {
  it('returns free when no subscription row', () => {
    expect(computeAccessTier(null, null, null)).toBe('free');
  });

  it('returns free when status is free', () => {
    expect(computeAccessTier('free', null, null)).toBe('free');
  });

  it('returns active when status is active and period has not ended', () => {
    expect(computeAccessTier('active', FUTURE, null)).toBe('active');
  });

  it('returns grace_period when period ended but grace has not', () => {
    expect(computeAccessTier('active', PAST, FUTURE)).toBe('grace_period');
  });

  it('returns expired when period and grace both ended', () => {
    expect(computeAccessTier('active', PAST, PAST)).toBe('expired');
  });

  it('returns expired when status is active but no period_end set', () => {
    expect(computeAccessTier('active', null, null)).toBe('expired');
  });

  it('returns canceled when status is canceled', () => {
    expect(computeAccessTier('canceled', FUTURE, FUTURE)).toBe('canceled');
  });

  it('returns expired when status is expired', () => {
    expect(computeAccessTier('expired', PAST, PAST)).toBe('expired');
  });
});

describe('isFeatureAllowed', () => {
  describe('free tier features', () => {
    it('is always allowed regardless of subscription', () => {
      expect(isFeatureAllowed('free', 'dashboard_overview')).toBe(true);
      expect(isFeatureAllowed('expired', 'dashboard_overview')).toBe(true);
      expect(isFeatureAllowed('canceled', 'dashboard_overview')).toBe(true);
    });
  });

  describe('paid tier features', () => {
    it('is denied for free tier', () => {
      expect(isFeatureAllowed('free', 'budget_view')).toBe(false);
      expect(isFeatureAllowed('free', 'loans_view')).toBe(false);
    });

    it('is allowed for active subscription', () => {
      expect(isFeatureAllowed('active', 'budget_view')).toBe(true);
      expect(isFeatureAllowed('active', 'loans_view')).toBe(true);
    });

    it('is allowed during grace period', () => {
      expect(isFeatureAllowed('grace_period', 'budget_view')).toBe(true);
      expect(isFeatureAllowed('grace_period', 'loans_view')).toBe(true);
    });

    it('is denied when subscription expired', () => {
      expect(isFeatureAllowed('expired', 'budget_view')).toBe(false);
      expect(isFeatureAllowed('expired', 'loans_view')).toBe(false);
    });

    it('is denied when subscription canceled', () => {
      expect(isFeatureAllowed('canceled', 'budget_view')).toBe(false);
      expect(isFeatureAllowed('canceled', 'loans_view')).toBe(false);
    });
  });
});
