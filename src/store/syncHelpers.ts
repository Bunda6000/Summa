import { isFeatureAllowed, type SubscriptionTier } from '../subscription/featureFlags';
import { defaultData } from '../constants';
import type { AppData } from '../types';

export function shouldSync(tier: SubscriptionTier): boolean {
  return isFeatureAllowed(tier, 'cloud_sync');
}

/** Last-write-wins: returns whichever snapshot has the newer _updatedAt timestamp.
 *  Falls back to local when timestamps are equal or absent on both sides. */
export function resolveConflict(local: AppData | null, cloud: AppData | null): AppData {
  if (!local && !cloud) return defaultData();
  if (!local) return cloud!;
  if (!cloud) return local;

  const localTs = local._updatedAt ?? '';
  const cloudTs = cloud._updatedAt ?? '';

  if (cloudTs > localTs) return cloud;
  return local;
}
