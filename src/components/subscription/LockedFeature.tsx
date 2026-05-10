import React from 'react';
import useSubscriptionStore from '../../subscription/useSubscriptionStore';
import { isFeatureAllowed, type FeatureKey } from '../../subscription/featureFlags';
import styles from './LockedFeature.module.css';

interface LockedFeatureProps {
  featureKey: FeatureKey;
  children: React.ReactNode;
}

export default function LockedFeature({ featureKey, children }: LockedFeatureProps) {
  const tier = useSubscriptionStore(state => state.tier);
  const allowed = isFeatureAllowed(tier, featureKey);

  if (allowed) return <>{children}</>;

  return (
    <div className={styles.container}>
      <div className={styles.overlay}>
        <span
          role="img"
          aria-label="locked"
          className={styles.lockIcon}
        >
          🔒
        </span>
        <p className={styles.title}>This is a paid feature</p>
        <p className={styles.subtitle}>
          Upgrade your plan to unlock the full experience.
        </p>
        <a href="/pricing" className={styles.ctaButton}>
          Upgrade Now
        </a>
      </div>
      <div className={styles.blurred} aria-hidden="true">
        {children}
      </div>
    </div>
  );
}
