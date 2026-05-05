import { describe, it, expect } from 'vitest';
import {
  getSubscriptionUpdate,
  NOTIFICATION_TYPE,
  type RtdnUpdate,
} from '../rtdn';

describe('getSubscriptionUpdate', () => {
  describe('SUBSCRIPTION_RENEWED (2)', () => {
    it('keeps subscription active and marks as active', () => {
      const update: RtdnUpdate = getSubscriptionUpdate(NOTIFICATION_TYPE.SUBSCRIPTION_RENEWED);
      expect(update.subscriptionStatus).toBe('active');
      expect(update.profilePlan).toBe('paid');
      expect(update.profileSubscriptionStatus).toBe('active');
    });
  });

  describe('SUBSCRIPTION_CANCELED (3)', () => {
    it('marks the subscription as canceled without downgrading the plan yet', () => {
      const update: RtdnUpdate = getSubscriptionUpdate(NOTIFICATION_TYPE.SUBSCRIPTION_CANCELED);
      expect(update.subscriptionStatus).toBe('canceled');
      expect(update.profilePlan).toBe(null);
      expect(update.profileSubscriptionStatus).toBe('cancelled');
    });
  });

  describe('SUBSCRIPTION_ON_HOLD (5)', () => {
    it('marks the subscription as on-hold (past_due)', () => {
      const update: RtdnUpdate = getSubscriptionUpdate(NOTIFICATION_TYPE.SUBSCRIPTION_ON_HOLD);
      expect(update.subscriptionStatus).toBe('grace_period');
      expect(update.profileSubscriptionStatus).toBe('past_due');
    });
  });

  describe('SUBSCRIPTION_IN_GRACE_PERIOD (6)', () => {
    it('keeps plan active but marks past_due during grace period', () => {
      const update: RtdnUpdate = getSubscriptionUpdate(NOTIFICATION_TYPE.SUBSCRIPTION_IN_GRACE_PERIOD);
      expect(update.subscriptionStatus).toBe('grace_period');
      expect(update.profilePlan).toBe('paid');
      expect(update.profileSubscriptionStatus).toBe('past_due');
    });
  });

  describe('SUBSCRIPTION_REVOKED (12)', () => {
    it('immediately downgrades to free plan', () => {
      const update: RtdnUpdate = getSubscriptionUpdate(NOTIFICATION_TYPE.SUBSCRIPTION_REVOKED);
      expect(update.subscriptionStatus).toBe('expired');
      expect(update.profilePlan).toBe('free');
      expect(update.profileSubscriptionStatus).toBe('active');
    });
  });

  describe('SUBSCRIPTION_EXPIRED (13)', () => {
    it('downgrades to free plan after period ends', () => {
      const update: RtdnUpdate = getSubscriptionUpdate(NOTIFICATION_TYPE.SUBSCRIPTION_EXPIRED);
      expect(update.subscriptionStatus).toBe('expired');
      expect(update.profilePlan).toBe('free');
      expect(update.profileSubscriptionStatus).toBe('active');
    });
  });

  describe('SUBSCRIPTION_RECOVERED (1)', () => {
    it('restores paid plan after recovery from hold/grace period', () => {
      const update: RtdnUpdate = getSubscriptionUpdate(NOTIFICATION_TYPE.SUBSCRIPTION_RECOVERED);
      expect(update.subscriptionStatus).toBe('active');
      expect(update.profilePlan).toBe('paid');
      expect(update.profileSubscriptionStatus).toBe('active');
    });
  });

  describe('SUBSCRIPTION_RESTARTED (7)', () => {
    it('restores paid plan after user restarts a previously-cancelled subscription', () => {
      const update: RtdnUpdate = getSubscriptionUpdate(NOTIFICATION_TYPE.SUBSCRIPTION_RESTARTED);
      expect(update.subscriptionStatus).toBe('active');
      expect(update.profilePlan).toBe('paid');
      expect(update.profileSubscriptionStatus).toBe('active');
    });
  });

  describe('unknown notification type', () => {
    it('returns null for all fields so the DB is left unchanged', () => {
      const update: RtdnUpdate = getSubscriptionUpdate(999 as never);
      expect(update.subscriptionStatus).toBeNull();
      expect(update.profilePlan).toBeNull();
      expect(update.profileSubscriptionStatus).toBeNull();
    });
  });
});
