import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../storage', () => ({
  loadStore: vi.fn(),
  saveStore: vi.fn().mockResolvedValue(undefined),
  removeStore: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { loadStore, saveStore, removeStore } from '../../storage';
import { supabase } from '../../lib/supabase';
import { detectLegacyData, runMigration } from '../migrateLocalData';
import type { AppData } from '../../types';

const mockLoadStore = vi.mocked(loadStore);
const mockSaveStore = vi.mocked(saveStore);
const mockRemoveStore = vi.mocked(removeStore);
const mockFrom = vi.mocked(supabase.from);

const base: AppData = {
  categories: [{ id: 'cat1', name: 'Food', maxYears: 5, fields: [], subcategories: [], colOrder: [] }],
  expenses: {},
  loanTypes: [],
  loanPaid: {},
  fixedIncomes: [],
  variableIncomes: [],
  _schemaVersion: 2,
};

function setupSupabase({
  cloudRow = null as { data: AppData; updated_at: string } | null,
  upsertError = null as { message: string } | null,
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: cloudRow, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const upsert = vi.fn().mockResolvedValue({ error: upsertError });
  mockFrom.mockReturnValue({ select, upsert } as never);
  return { maybeSingle, eq, select, upsert };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── detectLegacyData ──────────────────────────────────────────────────────────

describe('detectLegacyData', () => {
  it('returns null when legacy key has no data', async () => {
    mockLoadStore.mockResolvedValue(null);
    const result = await detectLegacyData();
    expect(result).toBeNull();
  });

  it('returns parsed AppData when legacy key has data', async () => {
    mockLoadStore.mockResolvedValue(base);
    const result = await detectLegacyData();
    expect(result).toEqual(base);
  });

  it('loads from the key "budget-app-v2"', async () => {
    mockLoadStore.mockResolvedValue(null);
    await detectLegacyData();
    expect(mockLoadStore).toHaveBeenCalledWith('budget-app-v2', null);
  });
});

// ── runMigration ─────────────────────────────────────────────────────────────

describe('runMigration', () => {
  it('picks local data when local _updatedAt is newer than cloud updated_at', async () => {
    const cloudTs = new Date('2024-01-01T00:00:00Z').toISOString();
    const localData = { ...base, _updatedAt: Date.parse('2024-06-01T00:00:00Z') };
    const cloudData = { ...base, categories: [] };
    setupSupabase({ cloudRow: { data: cloudData, updated_at: cloudTs } });

    const winner = await runMigration('uid-1', localData);

    expect(winner).toEqual(localData);
  });

  it('picks cloud data when cloud updated_at is newer than local _updatedAt', async () => {
    const cloudTs = new Date('2025-01-01T00:00:00Z').toISOString();
    const localData = { ...base, _updatedAt: Date.parse('2024-01-01T00:00:00Z') };
    const cloudData = { ...base, categories: [] };
    setupSupabase({ cloudRow: { data: cloudData, updated_at: cloudTs } });

    const winner = await runMigration('uid-1', localData);

    expect(winner).toEqual(cloudData);
  });

  it('picks local data when cloud has no row (new account)', async () => {
    setupSupabase({ cloudRow: null });
    const winner = await runMigration('uid-1', base);
    expect(winner).toEqual(base);
  });

  it('picks cloud data when local has no _updatedAt and cloud has data', async () => {
    const cloudTs = new Date('2024-01-01T00:00:00Z').toISOString();
    const localNoTs = { ...base }; // no _updatedAt → treated as 0
    const cloudData = { ...base, categories: [] };
    setupSupabase({ cloudRow: { data: cloudData, updated_at: cloudTs } });

    const winner = await runMigration('uid-1', localNoTs);

    expect(winner).toEqual(cloudData);
  });

  it('does NOT delete legacy key when Supabase upsert fails', async () => {
    setupSupabase({ cloudRow: null, upsertError: { message: 'network error' } });

    await expect(runMigration('uid-1', base)).rejects.toThrow('network error');

    expect(mockRemoveStore).not.toHaveBeenCalled();
  });

  it('saves winner under user-scoped key and deletes legacy key on full success', async () => {
    setupSupabase({ cloudRow: null });

    await runMigration('uid-1', base);

    expect(mockSaveStore).toHaveBeenCalledWith('budget-app-v2-uid-1', expect.any(Object));
    expect(mockRemoveStore).toHaveBeenCalledWith('budget-app-v2');
  });

  it('deletes legacy key only after upsert and local save succeed', async () => {
    const callOrder: string[] = [];
    const { upsert } = setupSupabase({ cloudRow: null });
    upsert.mockImplementation(async () => { callOrder.push('upsert'); return { error: null }; });
    mockSaveStore.mockImplementation(async () => { callOrder.push('save'); });
    mockRemoveStore.mockImplementation(async () => { callOrder.push('remove'); });

    await runMigration('uid-1', base);

    expect(callOrder).toEqual(['upsert', 'save', 'remove']);
  });
});
