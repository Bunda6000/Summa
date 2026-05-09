# Migration for Existing Local Users — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When a user who has pre-auth local data signs in, show a one-time interstitial offering to migrate that data into their cloud account.

**Architecture:** Detect the legacy key `budget-app-v2` (no userId suffix) right after a session arrives in `Root`. If found, render a `MigrationScreen` interstitial instead of loading the app. Migration logic lives in `src/migration/migrateLocalData.ts` and uses "newest wins" (local `_updatedAt` vs cloud `updated_at`). The legacy key is deleted only on full success — rollback is implicit. A "Migrate offline data" button in AccountModal handles the re-entry path for users who deferred.

**Tech Stack:** React, TypeScript, Zustand, Supabase JS client, Vitest, Testing Library

**Design doc:** `docs/plans/2026-05-09-migration-design.md`

---

### Task 1: Add `_updatedAt` to `AppData` and write it on every save

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/store/useBudgetStore.ts`
- Create: `src/store/__tests__/useBudgetStore.test.ts`

---

**Step 1: Write the failing test**

Create `src/store/__tests__/useBudgetStore.test.ts`:

```ts
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
```

**Step 2: Run test to verify it fails**

```
npm test -- src/store/__tests__/useBudgetStore.test.ts
```

Expected: FAIL — `_updatedAt` is `undefined`.

**Step 3: Add `_updatedAt` to `AppData`**

In `src/types/index.ts`, add one field at the bottom of the interface:

```ts
export interface AppData {
  categories: Category[];
  expenses: Expenses;
  loanTypes: LoanType[];
  loanPaid: LoanPaid;
  fixedIncomes: FixedIncome[];
  variableIncomes: VariableIncome[];
  _schemaVersion?: number;
  _updatedAt?: number;
}
```

**Step 4: Update `_save` in `useBudgetStore`**

In `src/store/useBudgetStore.ts`, find `_save` (around line 147) and update it:

```ts
_save: (nextData: AppData) => {
  const { userId } = get();
  const stamped = { ...nextData, _updatedAt: Date.now() };
  set({ appData: stamped });
  if (userId) {
    saveStore(`budget-app-v2-${userId}`, stamped);
    scheduleCloudSync(userId, stamped);
  }
},
```

**Step 5: Run test to verify it passes**

```
npm test -- src/store/__tests__/useBudgetStore.test.ts
```

Expected: PASS

**Step 6: Run full test suite to check no regressions**

```
npm test
```

Expected: all tests pass.

**Step 7: Commit**

```
git add src/types/index.ts src/store/useBudgetStore.ts src/store/__tests__/useBudgetStore.test.ts
git commit -m "feat(migration): add _updatedAt timestamp to AppData, write on every _save"
```

---

### Task 2: Create migration logic module

**Files:**
- Create: `src/migration/migrateLocalData.ts`
- Create: `src/migration/__tests__/migrateLocalData.test.ts`

---

**Step 1: Write the failing tests**

Create `src/migration/__tests__/migrateLocalData.test.ts`:

```ts
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
```

**Step 2: Run tests to verify they fail**

```
npm test -- src/migration/__tests__/migrateLocalData.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement `src/migration/migrateLocalData.ts`**

```ts
import { loadStore, saveStore, removeStore } from '../storage';
import { supabase } from '../lib/supabase';
import type { AppData } from '../types';

const LEGACY_KEY = 'budget-app-v2';

export async function detectLegacyData(): Promise<AppData | null> {
  return loadStore<AppData | null>(LEGACY_KEY, null);
}

export async function runMigration(userId: string, legacyData: AppData): Promise<AppData> {
  const { data: cloudRow } = await supabase
    .from('user_data')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  const localTs = legacyData._updatedAt ?? 0;
  const cloudTs = cloudRow?.updated_at ? Date.parse(cloudRow.updated_at) : 0;
  const winner: AppData = localTs >= cloudTs ? legacyData : (cloudRow!.data as AppData);

  const { error } = await supabase.from('user_data').upsert({ user_id: userId, data: winner });
  if (error) throw new Error(error.message);

  await saveStore(`budget-app-v2-${userId}`, winner);
  await removeStore(LEGACY_KEY);

  return winner;
}
```

**Step 4: Run tests to verify they pass**

```
npm test -- src/migration/__tests__/migrateLocalData.test.ts
```

Expected: all 8 tests PASS.

**Step 5: Run full suite**

```
npm test
```

Expected: all tests pass.

**Step 6: Commit**

```
git add src/migration/migrateLocalData.ts src/migration/__tests__/migrateLocalData.test.ts
git commit -m "feat(migration): add detectLegacyData and runMigration logic"
```

---

### Task 3: Create `MigrationPanel` component

The shared 4-state panel (prompt → migrating → success → error). Used inside `MigrationScreen` (full-screen) and `AccountModal` (inline).

**Files:**
- Create: `src/components/migration/MigrationPanel.tsx`
- Create: `src/components/migration/__tests__/MigrationPanel.test.tsx`

---

**Step 1: Write the failing tests**

Create `src/components/migration/__tests__/MigrationPanel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../migration/migrateLocalData', () => ({
  runMigration: vi.fn(),
}));

import { runMigration } from '../../../migration/migrateLocalData';
import MigrationPanel from '../MigrationPanel';
import type { AppData } from '../../../types';

const mockRun = vi.mocked(runMigration);

const baseData: AppData = {
  categories: [],
  expenses: {},
  loanTypes: [],
  loanPaid: {},
  fixedIncomes: [],
  variableIncomes: [],
};

const defaultProps = {
  userId: 'uid-1',
  legacyData: baseData,
  onComplete: vi.fn(),
  onSkip: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MigrationPanel', () => {
  it('renders the prompt state initially', () => {
    render(<MigrationPanel {...defaultProps} />);
    expect(screen.getByText(/offline data/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /migrate my data/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /not now/i })).toBeInTheDocument();
  });

  it('transitions to migrating state when Migrate is clicked', async () => {
    mockRun.mockReturnValue(new Promise(() => {})); // never resolves
    render(<MigrationPanel {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /migrate my data/i }));
    expect(screen.getByText(/migrating/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /migrate my data/i })).not.toBeInTheDocument();
  });

  it('transitions to success state after migration completes', async () => {
    mockRun.mockResolvedValue(baseData);
    render(<MigrationPanel {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /migrate my data/i }));
    await waitFor(() => expect(screen.getByText(/all done/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('calls onComplete with the winner when Continue is clicked', async () => {
    const winner = { ...baseData, _updatedAt: 123 };
    mockRun.mockResolvedValue(winner);
    const onComplete = vi.fn();
    render(<MigrationPanel {...defaultProps} onComplete={onComplete} />);
    await userEvent.click(screen.getByRole('button', { name: /migrate my data/i }));
    await waitFor(() => screen.getByRole('button', { name: /continue/i }));
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledWith(winner);
  });

  it('transitions to error state when migration throws', async () => {
    mockRun.mockRejectedValue(new Error('network error'));
    render(<MigrationPanel {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /migrate my data/i }));
    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip for now/i })).toBeInTheDocument();
  });

  it('retries migration when Retry is clicked', async () => {
    mockRun.mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce(baseData);
    render(<MigrationPanel {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /migrate my data/i }));
    await waitFor(() => screen.getByRole('button', { name: /retry/i }));
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText(/all done/i)).toBeInTheDocument());
    expect(mockRun).toHaveBeenCalledTimes(2);
  });

  it('calls onSkip when Not now is clicked without running migration', async () => {
    const onSkip = vi.fn();
    render(<MigrationPanel {...defaultProps} onSkip={onSkip} />);
    await userEvent.click(screen.getByRole('button', { name: /not now/i }));
    expect(onSkip).toHaveBeenCalled();
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('calls onSkip when Skip for now is clicked in error state', async () => {
    mockRun.mockRejectedValue(new Error('fail'));
    const onSkip = vi.fn();
    render(<MigrationPanel {...defaultProps} onSkip={onSkip} />);
    await userEvent.click(screen.getByRole('button', { name: /migrate my data/i }));
    await waitFor(() => screen.getByRole('button', { name: /skip for now/i }));
    await userEvent.click(screen.getByRole('button', { name: /skip for now/i }));
    expect(onSkip).toHaveBeenCalled();
  });
});
```

**Step 2: Run tests to verify they fail**

```
npm test -- src/components/migration/__tests__/MigrationPanel.test.tsx
```

Expected: FAIL — module not found.

**Step 3: Implement `MigrationPanel`**

Create `src/components/migration/MigrationPanel.tsx`:

```tsx
import { useState } from 'react';
import { runMigration } from '../../migration/migrateLocalData';
import type { AppData } from '../../types';

type PanelState = 'prompt' | 'migrating' | 'success' | 'error';

interface Props {
  userId: string;
  legacyData: AppData;
  onComplete: (winner: AppData) => void;
  onSkip: () => void;
}

export default function MigrationPanel({ userId, legacyData, onComplete, onSkip }: Props) {
  const [state, setState] = useState<PanelState>('prompt');
  const [winner, setWinner] = useState<AppData | null>(null);

  const migrate = async () => {
    setState('migrating');
    try {
      const result = await runMigration(userId, legacyData);
      setWinner(result);
      setState('success');
    } catch {
      setState('error');
    }
  };

  if (state === 'prompt') return (
    <div>
      <h2>Offline Data Found</h2>
      <p>You have offline data from before sign-in. Import it into your account?</p>
      <button onClick={migrate}>Migrate my data</button>
      <button onClick={onSkip}>Not now</button>
    </div>
  );

  if (state === 'migrating') return (
    <div>
      <div aria-label="Loading" />
      <p>Migrating your data...</p>
    </div>
  );

  if (state === 'success') return (
    <div>
      <p>All done! Your offline data has been imported.</p>
      <button onClick={() => onComplete(winner!)}>Continue to app</button>
    </div>
  );

  return (
    <div>
      <p>Something went wrong. Your local data is safe.</p>
      <button onClick={migrate}>Retry</button>
      <button onClick={onSkip}>Skip for now</button>
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

```
npm test -- src/components/migration/__tests__/MigrationPanel.test.tsx
```

Expected: all 8 tests PASS.

**Step 5: Run full suite**

```
npm test
```

Expected: all tests pass.

**Step 6: Commit**

```
git add src/components/migration/MigrationPanel.tsx src/components/migration/__tests__/MigrationPanel.test.tsx
git commit -m "feat(migration): add MigrationPanel component with 4-state UI"
```

---

### Task 4: Create `MigrationScreen` full-screen interstitial

Wraps `MigrationPanel` in a full-screen layout that matches the app's existing auth/loading screens.

**Files:**
- Create: `src/components/migration/MigrationScreen.tsx`

No separate tests needed — `MigrationPanel` is already tested. `MigrationScreen` is a thin layout wrapper.

---

**Step 1: Implement `MigrationScreen`**

Create `src/components/migration/MigrationScreen.tsx`:

```tsx
import MigrationPanel from './MigrationPanel';
import type { AppData } from '../../types';

interface Props {
  userId: string;
  legacyData: AppData;
  onComplete: (winner: AppData) => void;
  onSkip: () => void;
}

export default function MigrationScreen({ userId, legacyData, onComplete, onSkip }: Props) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg, #0A0A10)',
      padding: 24,
    }}>
      <div style={{
        maxWidth: 400,
        width: '100%',
        background: 'var(--surface, #16161E)',
        border: '1px solid var(--border, rgba(255,255,255,0.08))',
        borderRadius: 16,
        padding: 32,
        boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
      }}>
        <MigrationPanel
          userId={userId}
          legacyData={legacyData}
          onComplete={onComplete}
          onSkip={onSkip}
        />
      </div>
    </div>
  );
}
```

**Step 2: Run full suite to verify no breakage**

```
npm test
```

Expected: all tests pass.

**Step 3: Commit**

```
git add src/components/migration/MigrationScreen.tsx
git commit -m "feat(migration): add MigrationScreen full-screen interstitial wrapper"
```

---

### Task 5: Wire migration into `main.tsx`

**Files:**
- Modify: `src/main.tsx`

---

**Step 1: Update `Root` in `src/main.tsx`**

Replace the current `Root` function with:

```tsx
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import BudgetApp from './App';
import useBudgetStore from './store/useBudgetStore';
import useAuthStore from './auth/useAuthStore';
import useSubscriptionStore from './subscription/useSubscriptionStore';
import AuthScreen from './components/auth/AuthScreen';
import MigrationScreen from './components/migration/MigrationScreen';
import { detectLegacyData } from './migration/migrateLocalData';
import type { AppData } from './types';

useBudgetStore.subscribe(
  (state) => state.dark,
  (dark: boolean) => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }
);

function Root() {
  const { session, initAuth } = useAuthStore();
  const { initStore, resetStore, initialized } = useBudgetStore();
  const { initSubscription, resetSubscription } = useSubscriptionStore();
  const [authReady, setAuthReady] = useState(false);
  const [migrationPending, setMigrationPending] = useState(false);
  const [legacyData, setLegacyData] = useState<AppData | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    initAuth().then((unsubscribe) => {
      cleanup = unsubscribe;
      setAuthReady(true);
    });
    return () => cleanup?.();
  }, [initAuth]);

  // Check for legacy data once session arrives
  useEffect(() => {
    if (!session) return;
    detectLegacyData().then(data => {
      if (data) {
        setLegacyData(data);
        setMigrationPending(true);
      }
    });
  }, [session]);

  // Initialize store only when not blocked by pending migration
  useEffect(() => {
    if (!session) {
      resetStore();
      resetSubscription();
      return;
    }
    if (migrationPending) return;
    initStore(session.user.id);
    initSubscription(session.user.id);
  }, [session, migrationPending, initStore, resetStore, initSubscription, resetSubscription]);

  const handleMigrationComplete = (_winner: AppData) => {
    setMigrationPending(false);
    setLegacyData(null);
  };

  const handleMigrationSkip = () => {
    setMigrationPending(false);
    setLegacyData(null);
  };

  if (!authReady) return null;
  if (!session) return <AuthScreen />;
  if (migrationPending && legacyData) {
    return (
      <MigrationScreen
        userId={session.user.id}
        legacyData={legacyData}
        onComplete={handleMigrationComplete}
        onSkip={handleMigrationSkip}
      />
    );
  }
  if (!initialized) return null;
  return <BudgetApp />;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
```

**Step 2: Run full suite**

```
npm test
```

Expected: all tests pass.

**Step 3: Commit**

```
git add src/main.tsx
git commit -m "feat(migration): render MigrationScreen interstitial in Root when legacy data is detected"
```

---

### Task 6: Add "Migrate offline data" section to AccountModal

Shown when the user deferred migration and wants to trigger it manually later.

**Files:**
- Modify: `src/components/account/AccountModal.tsx`

---

**Step 1: Read the current AccountModal**

Read `src/components/account/AccountModal.tsx` in full to find the right insertion point. The section should appear after the account info area and before the subscription section — as a standalone block that disappears once migration is complete.

**Step 2: Add migration state and detection**

At the top of the `AccountModal` function body, after existing state declarations, add:

```tsx
const [migrateLegacy, setMigrateLegacy] = useState<AppData | null>(null);
const [showMigrationPanel, setShowMigrationPanel] = useState(false);

useEffect(() => {
  detectLegacyData().then(setMigrateLegacy);
}, []);
```

Add imports at the top of the file:

```tsx
import { detectLegacyData } from '../../migration/migrateLocalData';
import MigrationPanel from '../migration/MigrationPanel';
import type { AppData } from '../../types';
```

**Step 3: Add the migration section to the JSX**

Inside the modal card, find a natural section break (after display name / account info, before the subscription block). Add:

```tsx
{migrateLegacy && !showMigrationPanel && (
  <section style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Offline Data</h3>
    <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
      You have local data that hasn't been imported yet.
    </p>
    <button
      onClick={() => setShowMigrationPanel(true)}
      style={{ fontSize: 13, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
    >
      Migrate offline data →
    </button>
  </section>
)}
{migrateLegacy && showMigrationPanel && (
  <section style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
    <MigrationPanel
      userId={userId}
      legacyData={migrateLegacy}
      onComplete={() => { setMigrateLegacy(null); setShowMigrationPanel(false); }}
      onSkip={() => setShowMigrationPanel(false)}
    />
  </section>
)}
```

**Step 4: Run full suite**

```
npm test
```

Expected: all tests pass.

**Step 5: Commit**

```
git add src/components/account/AccountModal.tsx
git commit -m "feat(migration): add Migrate offline data section to AccountModal"
```

---

### Task 7: Add E2E test scaffold (skipped by default)

**Files:**
- Create: `tests/e2e/migration.spec.ts`

---

**Step 1: Create the E2E test file**

Create `tests/e2e/migration.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

// These tests require a running dev server and a real Supabase project.
// Run manually: npx playwright test tests/e2e/migration.spec.ts
// They are skipped in CI by default.

test.describe('Local data migration', () => {
  test.skip('shows migration prompt when legacy data exists and user signs in', async ({ page }) => {
    // Seed legacy key before navigating
    await page.goto('/');
    await page.evaluate(() => {
      const legacyData = JSON.stringify({
        categories: [{ id: 'cat1', name: 'Food', maxYears: 5, fields: [], subcategories: [], colOrder: [] }],
        expenses: {}, loanTypes: [], loanPaid: {}, fixedIncomes: [], variableIncomes: [], _schemaVersion: 2,
      });
      localStorage.setItem('budget-app-v2', legacyData);
    });
    // Sign in (fill credentials from env vars)
    await page.fill('[aria-label="Email"]', process.env.TEST_EMAIL!);
    await page.fill('[aria-label="Password"]', process.env.TEST_PASSWORD!);
    await page.click('button:has-text("Sign in")');
    // Migration screen should appear
    await expect(page.getByText(/offline data found/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /migrate my data/i })).toBeVisible();
  });

  test.skip('completes migration and removes legacy key', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const data = JSON.stringify({
        categories: [], expenses: {}, loanTypes: [], loanPaid: {}, fixedIncomes: [], variableIncomes: [], _schemaVersion: 2,
      });
      localStorage.setItem('budget-app-v2', data);
    });
    await page.fill('[aria-label="Email"]', process.env.TEST_EMAIL!);
    await page.fill('[aria-label="Password"]', process.env.TEST_PASSWORD!);
    await page.click('button:has-text("Sign in")');
    await page.click('button:has-text("Migrate my data")');
    await expect(page.getByText(/all done/i)).toBeVisible();
    await page.click('button:has-text("Continue to app")');
    // Legacy key should be gone
    const legacyKey = await page.evaluate(() => localStorage.getItem('budget-app-v2'));
    expect(legacyKey).toBeNull();
  });

  test.skip('re-shows migration prompt on next sign-in when user skips', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('budget-app-v2', JSON.stringify({
        categories: [], expenses: {}, loanTypes: [], loanPaid: {}, fixedIncomes: [], variableIncomes: [],
      }));
    });
    await page.fill('[aria-label="Email"]', process.env.TEST_EMAIL!);
    await page.fill('[aria-label="Password"]', process.env.TEST_PASSWORD!);
    await page.click('button:has-text("Sign in")');
    await page.click('button:has-text("Not now")');
    // Sign out and sign in again
    await page.click('button:has-text("Logout")');
    await page.fill('[aria-label="Email"]', process.env.TEST_EMAIL!);
    await page.fill('[aria-label="Password"]', process.env.TEST_PASSWORD!);
    await page.click('button:has-text("Sign in")');
    await expect(page.getByText(/offline data found/i)).toBeVisible();
  });
});
```

**Step 2: Run full suite to confirm it stays clean**

```
npm test
```

Expected: all unit/component tests pass; e2e file is excluded (vite.config.js excludes `tests/e2e/**`).

**Step 3: Commit**

```
git add tests/e2e/migration.spec.ts
git commit -m "test(migration): add skipped e2e test scaffold for local data migration flow"
```

---

## Done Criteria Checklist

- [ ] `AppData._updatedAt` is written on every `_save` call
- [ ] `detectLegacyData()` correctly identifies pre-auth local data under `budget-app-v2`
- [ ] `runMigration()` applies "newest wins" and is atomic (rollback on upsert failure)
- [ ] Legacy key is deleted only after full migration success
- [ ] `MigrationScreen` appears between auth and app load when legacy data exists
- [ ] Skipping migration keeps the legacy key (prompt returns on next sign-in)
- [ ] AccountModal shows "Migrate offline data" when legacy data is present, hides it after
- [ ] All unit and component tests pass (`npm test`)
- [ ] No regressions in existing test suite
