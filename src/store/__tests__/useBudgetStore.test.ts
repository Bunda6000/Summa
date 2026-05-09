import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../storage', () => ({
  loadStore: vi.fn().mockResolvedValue(null),
  saveStore: vi.fn().mockResolvedValue(undefined),
  removeStore: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })) })),
    })),
  },
}));

import { saveStore } from '../../storage';
import useBudgetStore from '../useBudgetStore';
import { defaultData } from '../../constants';
import type { AppData } from '../../types';

const mockSaveStore = vi.mocked(saveStore);

beforeEach(() => {
  vi.clearAllMocks();
  useBudgetStore.setState({
    appData: null,
    dark: false,
    initialized: false,
    _initializing: false,
    userId: null,
  });
});

describe('useBudgetStore._save', () => {
  it('writes _updatedAt as a Unix ms timestamp', () => {
    const base = defaultData() as AppData;
    useBudgetStore.setState({ userId: 'u1', appData: base });

    const before = Date.now();
    useBudgetStore.getState()._save({ ...base });
    const after = Date.now();

    const saved = useBudgetStore.getState().appData!;
    expect(saved._updatedAt).toBeGreaterThanOrEqual(before);
    expect(saved._updatedAt).toBeLessThanOrEqual(after);
  });

  it('persists to local storage with user-scoped key', () => {
    const base = defaultData() as AppData;
    useBudgetStore.setState({ userId: 'u1', appData: base });

    useBudgetStore.getState()._save({ ...base });

    expect(mockSaveStore).toHaveBeenCalledWith('budget-app-v2-u1', expect.objectContaining({ _updatedAt: expect.any(Number) }));
  });
});
