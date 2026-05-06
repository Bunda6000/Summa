// Pure mapping from Google Play RTDN notification type → DB update payload.
// This module has no runtime dependencies so it can be tested with Vitest.

export const NOTIFICATION_TYPE = {
  SUBSCRIPTION_RECOVERED: 1,
  SUBSCRIPTION_RENEWED: 2,
  SUBSCRIPTION_CANCELED: 3,
  SUBSCRIPTION_PURCHASED: 4,
  SUBSCRIPTION_ON_HOLD: 5,
  SUBSCRIPTION_IN_GRACE_PERIOD: 6,
  SUBSCRIPTION_RESTARTED: 7,
  SUBSCRIPTION_PRICE_CHANGE_CONFIRMED: 8,
  SUBSCRIPTION_DEFERRED: 9,
  SUBSCRIPTION_PAUSED: 10,
  SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED: 11,
  SUBSCRIPTION_REVOKED: 12,
  SUBSCRIPTION_EXPIRED: 13,
  SUBSCRIPTION_PENDING_PURCHASE_CANCELED: 20,
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

export interface RtdnUpdate {
  subscriptionStatus: 'active' | 'canceled' | 'expired' | 'grace_period' | null;
  profilePlan: 'paid' | 'free' | null;
  profileSubscriptionStatus: 'active' | 'cancelled' | 'past_due' | null;
}

export function getSubscriptionUpdate(notificationType: NotificationType): RtdnUpdate {
  switch (notificationType) {
    case NOTIFICATION_TYPE.SUBSCRIPTION_RECOVERED:
    case NOTIFICATION_TYPE.SUBSCRIPTION_RESTARTED:
      return { subscriptionStatus: 'active', profilePlan: 'paid', profileSubscriptionStatus: 'active' };

    case NOTIFICATION_TYPE.SUBSCRIPTION_RENEWED:
    case NOTIFICATION_TYPE.SUBSCRIPTION_PURCHASED:
    case NOTIFICATION_TYPE.SUBSCRIPTION_PRICE_CHANGE_CONFIRMED:
    case NOTIFICATION_TYPE.SUBSCRIPTION_DEFERRED:
      return { subscriptionStatus: 'active', profilePlan: 'paid', profileSubscriptionStatus: 'active' };

    case NOTIFICATION_TYPE.SUBSCRIPTION_CANCELED:
    case NOTIFICATION_TYPE.SUBSCRIPTION_PENDING_PURCHASE_CANCELED:
      // Subscription is canceled but still active until current_period_end.
      // profilePlan stays 'paid' until EXPIRED fires — null means don't change.
      return { subscriptionStatus: 'canceled', profilePlan: null, profileSubscriptionStatus: 'cancelled' };

    case NOTIFICATION_TYPE.SUBSCRIPTION_ON_HOLD:
    case NOTIFICATION_TYPE.SUBSCRIPTION_PAUSED:
    case NOTIFICATION_TYPE.SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED:
      return { subscriptionStatus: 'grace_period', profilePlan: null, profileSubscriptionStatus: 'past_due' };

    case NOTIFICATION_TYPE.SUBSCRIPTION_IN_GRACE_PERIOD:
      return { subscriptionStatus: 'grace_period', profilePlan: 'paid', profileSubscriptionStatus: 'past_due' };

    case NOTIFICATION_TYPE.SUBSCRIPTION_REVOKED:
    case NOTIFICATION_TYPE.SUBSCRIPTION_EXPIRED:
      return { subscriptionStatus: 'expired', profilePlan: 'free', profileSubscriptionStatus: 'active' };

    default:
      return { subscriptionStatus: null, profilePlan: null, profileSubscriptionStatus: null };
  }
}
