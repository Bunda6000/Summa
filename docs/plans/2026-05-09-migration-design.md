# Design: Migration for Existing Local Users

**Date:** 2026-05-09
**Status:** Approved

## Problem

Users who used the app before authentication was introduced have data stored under the legacy key `budget-app-v2` (no userId suffix). When they sign in for the first time, that data must be offered for migration into their new cloud-backed account (`budget-app-v2-{userId}` + `user_data` table).

## Decisions

| Question | Decision |
|---|---|
| Where does the prompt appear? | Post-sign-in interstitial screen, before the app loads |
| Duplicate/conflict strategy | Newest wins: compare `appData._updatedAt` vs `user_data.updated_at` |
| One-time tracking | Implicit: legacy key `budget-app-v2` is deleted on success; no extra flag needed |
| If user declines | Keep legacy key (prompt returns on next sign-in); also expose manual trigger in AccountModal |

## Architecture

### New files

- `src/migration/migrateLocalData.ts` — pure detection, migration, and cleanup logic
- `src/components/migration/MigrationScreen.tsx` — full-screen interstitial (4 states)
- `src/components/migration/MigrationPanel.tsx` — shared panel reused in AccountModal
- `src/migration/migrateLocalData.test.ts` — unit tests
- `src/components/migration/__tests__/MigrationScreen.test.tsx` — component tests
- `tests/e2e/migration.spec.ts` — e2e tests (skipped by default)

### Changed files

- `src/types/index.ts` — add `_updatedAt?: number` to `AppData`
- `src/store/useBudgetStore.ts` — write `_updatedAt: Date.now()` in `_save`
- `src/main.tsx` — add `migrationPending` state; render `MigrationScreen` when legacy data is detected
- `src/components/account/AccountModal.tsx` — add "Migrate offline data" section when legacy data exists

## Data Flow

```
session arrives in Root
  └─ loadStore('budget-app-v2')
       ├─ null  → no migration, proceed to initStore normally
       └─ data  → set migrationPending = true
                    └─ render MigrationScreen
                         ├─ user confirms  → runMigration(userId, legacyData)
                         │    ├─ fetch user_data row from Supabase
                         │    ├─ pick winner (newest wins — see algorithm below)
                         │    ├─ upsert winner to user_data
                         │    ├─ saveStore('budget-app-v2-{userId}', winner)
                         │    └─ removeStore('budget-app-v2')   ← only on full success
                         ├─ user skips    → keep legacy key, proceed (prompt returns next sign-in)
                         └─ error         → keep legacy key, show retry
```

### Root render logic

```
authReady=false                                          → null
authReady + !session                                     → <AuthScreen />
authReady + session + migrationPending + !storeInit      → <MigrationScreen />
authReady + session + !storeInit                         → null
authReady + session + storeInit                          → <BudgetApp />
```

## Timestamp Handling

`AppData` gains `_updatedAt?: number` (Unix ms). `useBudgetStore._save` writes it on every call.

**Newest wins comparison:**

```ts
const localTs = legacyData._updatedAt ?? 0;
const cloudTs = cloudRow ? Date.parse(cloudRow.updated_at) : 0;
const winner  = localTs >= cloudTs ? legacyData : cloudRow.data;
```

Edge cases:
- Legacy data has no `_updatedAt` → treated as epoch 0 → cloud wins if cloud has data; local wins if cloud is empty (new account, most common case)
- Cloud has no `user_data` row → `cloudTs = 0`, `localTs >= 0` → local always wins

## Migration Algorithm (atomic)

1. Load `budget-app-v2` from local storage
2. Fetch `user_data` row for `userId` from Supabase
3. Determine winner via newest-wins comparison
4. Upsert winner to `user_data` — if this fails, throw (legacy key untouched)
5. `saveStore('budget-app-v2-{userId}', winner)`
6. `removeStore('budget-app-v2')` — only reached if steps 4–5 succeed

Rollback is implicit: the legacy key is never deleted until all prior steps succeed.

## Components

### MigrationScreen states

| State | Content | Actions |
|---|---|---|
| `prompt` | "You have offline data from before sign-in. Import it into your account?" | [Migrate my data] [Not now] |
| `migrating` | Spinner + "Migrating your data..." | — |
| `success` | "All done! Your offline data has been imported." | [Continue to app] |
| `error` | "Something went wrong. Your local data is safe." | [Retry] [Skip for now] |

### AccountModal addition

A new section visible only when `detectLegacyData()` returns data:

```
Offline Data
  You have local data that hasn't been imported yet.
  [Migrate offline data →]
```

Disappears automatically once migration completes (legacy key gone).

## Testing Strategy

### Unit (`src/migration/migrateLocalData.test.ts`)
- `detectLegacyData` returns `null` when no legacy key exists
- `detectLegacyData` returns parsed data when legacy key exists
- `runMigration` picks local when `_updatedAt` is newer than cloud `updated_at`
- `runMigration` picks cloud when cloud is newer
- `runMigration` picks local when local has no timestamp and cloud is empty
- `runMigration` picks cloud when local has no timestamp and cloud has data
- `runMigration` does not delete legacy key if Supabase upsert fails
- `runMigration` deletes legacy key only after full success

### Component (`src/components/migration/__tests__/MigrationScreen.test.tsx`)
- Renders prompt state with correct buttons
- Migrate button transitions to migrating state
- Success transitions to success state
- Error transitions to error state with Retry and Skip
- Retry re-runs migration
- Skip calls `onSkip` without deleting legacy key

### Integration (`src/store/useBudgetStore.test.ts`)
- `_save` writes `_updatedAt` into appData on every call

### E2E (`tests/e2e/migration.spec.ts`) — skipped by default
- Seed legacy key, sign in, verify prompt appears
- Complete migration, verify legacy key gone and data visible
- Decline migration, sign out, sign in again, verify prompt reappears
