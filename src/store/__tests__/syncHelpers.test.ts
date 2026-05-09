import { describe, it, expect } from 'vitest';
import { shouldSync, resolveConflict } from '../syncHelpers';
import { defaultData } from '../../constants';
import type { AppData } from '../../types';

const withTs = (ts?: string): AppData => ({ ...defaultData(), _updatedAt: ts });

// ─── shouldSync ───────────────────────────────────────────────────────────────

describe('shouldSync', () => {
  it('returns true for active subscription', () => {
    expect(shouldSync('active')).toBe(true);
  });

  it('returns true for grace_period subscription', () => {
    expect(shouldSync('grace_period')).toBe(true);
  });

  it('returns false for free tier', () => {
    expect(shouldSync('free')).toBe(false);
  });

  it('returns false for expired subscription', () => {
    expect(shouldSync('expired')).toBe(false);
  });

  it('returns false for canceled subscription', () => {
    expect(shouldSync('canceled')).toBe(false);
  });
});

// ─── resolveConflict ─────────────────────────────────────────────────────────

describe('resolveConflict', () => {
  it('returns cloud data when no local data exists', () => {
    const cloud = withTs('2025-06-01T00:00:00Z');
    expect(resolveConflict(null, cloud)).toBe(cloud);
  });

  it('returns a default dataset when both local and cloud are null', () => {
    const result = resolveConflict(null, null);
    expect(result).toBeDefined();
    expect(Array.isArray(result.categories)).toBe(true);
  });

  it('returns local data when no cloud data exists', () => {
    const local = withTs('2025-01-01T00:00:00Z');
    expect(resolveConflict(local, null)).toBe(local);
  });

  it('returns cloud data when cloud timestamp is newer', () => {
    const local = withTs('2025-01-01T00:00:00Z');
    const cloud = withTs('2025-06-01T00:00:00Z');
    expect(resolveConflict(local, cloud)).toBe(cloud);
  });

  it('returns local data when local timestamp is newer', () => {
    const local = withTs('2025-06-01T00:00:00Z');
    const cloud = withTs('2025-01-01T00:00:00Z');
    expect(resolveConflict(local, cloud)).toBe(local);
  });

  it('returns local data when neither has a timestamp (local wins by default)', () => {
    const local = defaultData();
    const cloud = defaultData();
    expect(resolveConflict(local, cloud)).toBe(local);
  });

  it('returns cloud data when only cloud has a timestamp', () => {
    const local = defaultData();
    const cloud = withTs('2025-01-01T00:00:00Z');
    expect(resolveConflict(local, cloud)).toBe(cloud);
  });

  it('returns local data when only local has a timestamp', () => {
    const local = withTs('2025-01-01T00:00:00Z');
    const cloud = defaultData();
    expect(resolveConflict(local, cloud)).toBe(local);
  });
});
