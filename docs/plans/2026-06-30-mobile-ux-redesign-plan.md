# Summa Mobile UX Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver the mobile-first responsive redesign specified in `docs/plans/2026-06-30-mobile-ux-redesign.md` — floating pill nav, today-focused home screen, two-step expenses category flow, incomes segmented toggle, and budget progressive disclosure — while preserving 100% of the existing desktop layout.

**Architecture:** New mobile-only shell components are added alongside the existing layout. Every mobile-only change is gated behind `@media (max-width: 768px)` in CSS, so desktop code paths are untouched. New components are pure/presentational where possible, wired into `App.tsx` and `BudgetView.tsx` using props already in scope. No store changes required.

**Tech Stack:** React 18.3.1, TypeScript, CSS Modules, Zustand (`useUIStore` / `useBudgetStore`), Vitest + `@testing-library/react`.

**Run tests:** `npx vitest run` (all) or `npx vitest run src/path/to/test.tsx` (single file).

---

### Task 1: CSS Spacing Tokens

Adds the shared design token variables used by all new components.

**Files:**
- Modify: `src/index.css`

**Step 1: Add tokens to `:root` block**

In `src/index.css`, find the `:root, [data-theme="light"]` block (line 5) and append these tokens before the closing `}`:

```css
  /* ── Design-system spacing & radius tokens (mobile redesign) ── */
  --space-xs: 6px;
  --space-sm: 12px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --radius-card: 16px;
  --radius-pill: 32px;
  --touch-min: 44px;
```

**Step 2: Verify build passes**

```bash
npm run build
```

Expected: build completes with no errors.

**Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(tokens): add spacing and radius design tokens"
```

---

### Task 2: BottomPillNav Component

Floating pill navigation bar — visible only on mobile, replaces the header tab row.

**Files:**
- Create: `src/components/BottomPillNav.tsx`
- Create: `src/components/BottomPillNav.module.css`
- Create: `src/components/__tests__/BottomPillNav.test.tsx`

**Step 1: Write the failing test**

Create `src/components/__tests__/BottomPillNav.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BottomPillNav from '../BottomPillNav';

const TABS = ['dashboard', 'expenses', 'incomes', 'budget'] as const;

describe('BottomPillNav', () => {
  it('renders all four nav items', () => {
    render(<BottomPillNav tab="dashboard" setTab={vi.fn()} />);
    expect(screen.getByRole('button', { name: /home/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /expenses/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /incomes/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /budget/i })).toBeTruthy();
  });

  it('marks the active tab with aria-current', () => {
    render(<BottomPillNav tab="expenses" setTab={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /expenses/i });
    expect(btn.getAttribute('aria-current')).toBe('page');
  });

  it('calls setTab with the correct value on press', async () => {
    const setTab = vi.fn();
    render(<BottomPillNav tab="dashboard" setTab={setTab} />);
    await userEvent.click(screen.getByRole('button', { name: /budget/i }));
    expect(setTab).toHaveBeenCalledWith('budget');
  });

  it('does not mark inactive tabs with aria-current', () => {
    render(<BottomPillNav tab="dashboard" setTab={vi.fn()} />);
    const expBtn = screen.getByRole('button', { name: /expenses/i });
    expect(expBtn.getAttribute('aria-current')).toBeNull();
  });
});
```

**Step 2: Run test — expect it to fail**

```bash
npx vitest run src/components/__tests__/BottomPillNav.test.tsx
```

Expected: FAIL — `Cannot find module '../BottomPillNav'`

**Step 3: Create the component**

Create `src/components/BottomPillNav.tsx`:

```tsx
import styles from './BottomPillNav.module.css';

type Tab = 'dashboard' | 'expenses' | 'incomes' | 'budget';

const NAV_ITEMS: { id: Tab; icon: string; label: string }[] = [
  { id: 'dashboard', icon: '⌂', label: 'Home' },
  { id: 'expenses', icon: '💸', label: 'Expenses' },
  { id: 'incomes', icon: '↑', label: 'Incomes' },
  { id: 'budget', icon: '◎', label: 'Budget' },
];

interface BottomPillNavProps {
  tab: Tab;
  setTab: (tab: Tab) => void;
}

export default function BottomPillNav({ tab, setTab }: BottomPillNavProps) {
  return (
    <nav className={styles.nav} role="navigation" aria-label="Main navigation">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          className={`${styles.item} ${tab === item.id ? styles.active : ''}`}
          onClick={() => setTab(item.id)}
          aria-current={tab === item.id ? 'page' : undefined}
          style={{ touchAction: 'manipulation' }}
        >
          <span className={styles.icon} aria-hidden="true">{item.icon}</span>
          <span className={styles.label}>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
```

**Step 4: Create the stylesheet**

Create `src/components/BottomPillNav.module.css`:

```css
.nav {
  display: none; /* shown only on mobile via media query in index.css */
  position: fixed;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  width: clamp(280px, 85vw, 360px);
  height: 64px;
  background: var(--header-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  box-shadow: 0 8px 32px var(--shadow-lg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  z-index: 200;
  align-items: center;
  justify-content: space-around;
  padding: 0 8px;
}

.item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  flex: 1;
  height: 52px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 24px;
  transition: background 0.2s, color 0.2s;
  min-width: var(--touch-min);
  font-family: 'DM Sans', sans-serif;
  color: var(--muted);
  padding: 4px 0;
}

.icon {
  font-size: 20px;
  line-height: 1;
  transition: color 0.2s;
}

.label {
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.3px;
}

.active {
  color: var(--accent);
  background: var(--accent-bg);
}

@media (max-width: 768px) {
  .nav {
    display: flex;
  }
}
```

**Step 5: Run test — expect it to pass**

```bash
npx vitest run src/components/__tests__/BottomPillNav.test.tsx
```

Expected: 4 tests PASS.

**Step 6: Commit**

```bash
git add src/components/BottomPillNav.tsx src/components/BottomPillNav.module.css src/components/__tests__/BottomPillNav.test.tsx
git commit -m "feat(nav): add BottomPillNav floating pill navigation for mobile"
```

---

### Task 3: Collapse Mobile Header to Single Row

Hides the tab row from the header on mobile (tabs move to BottomPillNav). Slims the header to one row.

**Files:**
- Modify: `src/App.module.css`

**Step 1: Update the `@media(max-width: 768px)` block**

In `src/App.module.css`, find the existing `@media(max-width: 768px)` block (around line 554). Replace the `.tabs` rule within it:

Old:
```css
  .tabs {
    order: 3;           /* drops to row 2 */
    margin-left: 0;     /* cancel the desktop auto margin */
    flex-basis: 100%;   /* forces its own row */
    width: 100%;
  }

  .tab {
    flex: 1;
    padding: 9px 6px;
    font-size: 13px;
    white-space: nowrap;
  }
```

New (hide tabs entirely on mobile — they are now in BottomPillNav):
```css
  .tabs {
    display: none;
  }

  .headerInner {
    padding: 10px 14px;
    gap: 8px;
    flex-wrap: nowrap; /* single row */
  }

  .headerLogo {
    flex: 1;
    min-width: 0;
  }
```

Also add bottom padding to `.main` to prevent content hiding behind the floating pill nav. Find and update the existing mobile `.main-area` override in `src/index.css` (line ~90):

In `src/index.css`, find:
```css
  .main-area{padding:16px 12px calc(80px + var(--safe-bottom)) !important}
```

Change to:
```css
  .main-area{padding:16px 12px calc(100px + var(--safe-bottom)) !important}
```

**Step 2: Verify build passes**

```bash
npm run build
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/App.module.css src/index.css
git commit -m "refactor(header): collapse mobile header to single row, hide tab row"
```

---

### Task 4: Wire BottomPillNav into App.tsx

Replaces the `mobileActionBar` with the new `BottomPillNav` and removes the old add-action buttons from it.

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add the import**

At the top of `src/App.tsx`, after the existing component imports, add:

```tsx
import BottomPillNav from './components/BottomPillNav';
```

**Step 2: Replace the mobileActionBar block**

Find the existing `mobileActionBar` block near the bottom of `BudgetApp` (around line 869):

```tsx
      {/* Mobile thumb-zone action bar — only shown on small screens for tabs with add actions */}
      {(tab === "incomes" || tab === "expenses") && (
        <div className={styles.mobileActionBar}>
          {tab === "incomes" && (
            <>
              <button onClick={()=>setModal({type:"addFixedIncome"})} className={`btn-hover ${styles.btnPrimary}`} style={{flex:1,touchAction:"manipulation"}}>+ Fixed</button>
              <button onClick={()=>setModal({type:"addVarIncome"})} className={`btn-hover ${styles.btnPrimary}`} style={{flex:1,touchAction:"manipulation"}}>+ Variable</button>
            </>
          )}
          {tab === "expenses" && (
            <button onClick={()=>setModal({type:"addCat"})} className={`btn-hover ${styles.btnPrimary}`} style={{flex:1,touchAction:"manipulation"}}>+ Add Category</button>
          )}
        </div>
      )}
```

Replace the entire block with:

```tsx
      <BottomPillNav tab={tab} setTab={(t) => setTab(t as "dashboard" | "expenses" | "incomes" | "budget")} />
```

**Step 3: Verify build passes**

```bash
npm run build
```

Expected: no errors.

**Step 4: Run all tests**

```bash
npx vitest run
```

Expected: all existing tests still pass.

**Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(nav): wire BottomPillNav into App, retire mobileActionBar"
```

---

### Task 5: HeroMonthCard Component

The "this month at a glance" card shown on the home screen on mobile.

**Files:**
- Create: `src/components/HeroMonthCard.tsx`
- Create: `src/components/HeroMonthCard.module.css`
- Create: `src/components/__tests__/HeroMonthCard.test.tsx`

**Step 1: Write the failing test**

Create `src/components/__tests__/HeroMonthCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HeroMonthCard from '../HeroMonthCard';

describe('HeroMonthCard', () => {
  const baseProps = {
    monthLabel: 'June 2026',
    income: 4200,
    paid: 2850,
    balance: 1350,
  };

  it('displays the month label', () => {
    render(<HeroMonthCard {...baseProps} />);
    expect(screen.getByText('June 2026')).toBeTruthy();
  });

  it('displays income value', () => {
    render(<HeroMonthCard {...baseProps} />);
    expect(screen.getByText(/4[,.]?200/)).toBeTruthy();
  });

  it('displays balance value', () => {
    render(<HeroMonthCard {...baseProps} />);
    expect(screen.getByText(/1[,.]?350/)).toBeTruthy();
  });

  it('displays progress text showing paid vs income', () => {
    render(<HeroMonthCard {...baseProps} />);
    expect(screen.getByText(/2[,.]?850/)).toBeTruthy();
  });

  it('does not crash when income is zero', () => {
    render(<HeroMonthCard {...baseProps} income={0} paid={0} balance={0} />);
    expect(screen.getByText('June 2026')).toBeTruthy();
  });
});
```

**Step 2: Run test — expect fail**

```bash
npx vitest run src/components/__tests__/HeroMonthCard.test.tsx
```

Expected: FAIL — `Cannot find module '../HeroMonthCard'`

**Step 3: Create the component**

Create `src/components/HeroMonthCard.tsx`:

```tsx
import { fmt } from '../utils/formatters';
import styles from './HeroMonthCard.module.css';

interface HeroMonthCardProps {
  monthLabel: string;
  income: number;
  paid: number;
  balance: number;
}

export default function HeroMonthCard({ monthLabel, income, paid, balance }: HeroMonthCardProps) {
  const paidPct = income > 0 ? Math.min(100, (paid / income) * 100) : 0;
  const isPositive = balance >= 0;

  return (
    <div className={`glass-card ${styles.card}`}>
      <p className={styles.monthLabel}>{monthLabel}</p>
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Income</span>
          <span className={styles.metricValue}>{fmt(income)}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Balance</span>
          <span className={styles.metricValue} style={{ color: isPositive ? 'var(--accent)' : 'var(--red)' }}>
            {fmt(balance)}
          </span>
        </div>
      </div>
      <div className={styles.progressWrap}>
        <div className={styles.progressBg}>
          <div className={styles.progressFill} style={{ width: `${paidPct}%` }} />
        </div>
        <p className={styles.progressLabel}>
          {fmt(paid)} paid of {fmt(income)}
        </p>
      </div>
    </div>
  );
}
```

**Step 4: Create the stylesheet**

Create `src/components/HeroMonthCard.module.css`:

```css
.card {
  background: var(--card);
  border-radius: 20px;
  padding: var(--space-lg);
  border: 1px solid var(--border);
  margin-bottom: var(--space-md);
}

.monthLabel {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 1.2px;
  margin-bottom: 14px;
  font-family: 'Space Grotesk', sans-serif;
}

.metrics {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: 18px;
}

.divider {
  width: 1px;
  height: 40px;
  background: var(--border);
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric:last-child {
  text-align: right;
}

.metricLabel {
  font-size: 11px;
  color: var(--muted);
  font-weight: 500;
}

.metricValue {
  font-size: 26px;
  font-weight: 700;
  color: var(--text);
  font-family: 'Space Grotesk', sans-serif;
  letter-spacing: -0.5px;
}

.progressWrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progressBg {
  height: 6px;
  border-radius: 3px;
  background: var(--border);
  overflow: hidden;
}

.progressFill {
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
  transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

.progressLabel {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
}
```

**Step 5: Run test — expect pass**

```bash
npx vitest run src/components/__tests__/HeroMonthCard.test.tsx
```

Expected: 5 tests PASS.

**Step 6: Commit**

```bash
git add src/components/HeroMonthCard.tsx src/components/HeroMonthCard.module.css src/components/__tests__/HeroMonthCard.test.tsx
git commit -m "feat(home): add HeroMonthCard with progress bar"
```

---

### Task 6: UpcomingStrip Component

Horizontal-scroll strip of upcoming unpaid expense cards shown on the home screen.

**Files:**
- Create: `src/components/UpcomingStrip.tsx`
- Create: `src/components/UpcomingStrip.module.css`
- Create: `src/components/__tests__/UpcomingStrip.test.tsx`

**Step 1: Write the failing test**

Create `src/components/__tests__/UpcomingStrip.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UpcomingStrip from '../UpcomingStrip';

const makeItems = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    cat: `Cat ${i + 1}`,
    sub: null,
    amount: 100 * (i + 1),
    label: 'Jul 2026',
  }));

describe('UpcomingStrip', () => {
  it('renders nothing when items is empty', () => {
    const { container } = render(<UpcomingStrip items={[]} onSeeAll={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders category names', () => {
    render(<UpcomingStrip items={makeItems(2)} onSeeAll={vi.fn()} />);
    expect(screen.getByText('Cat 1')).toBeTruthy();
    expect(screen.getByText('Cat 2')).toBeTruthy();
  });

  it('shows see-all button when items > 3', () => {
    render(<UpcomingStrip items={makeItems(5)} onSeeAll={vi.fn()} />);
    expect(screen.getByRole('button', { name: /see all/i })).toBeTruthy();
  });

  it('calls onSeeAll when see-all button is clicked', async () => {
    const onSeeAll = vi.fn();
    render(<UpcomingStrip items={makeItems(5)} onSeeAll={onSeeAll} />);
    await userEvent.click(screen.getByRole('button', { name: /see all/i }));
    expect(onSeeAll).toHaveBeenCalledOnce();
  });

  it('shows +N more count when items > 3', () => {
    render(<UpcomingStrip items={makeItems(7)} onSeeAll={vi.fn()} />);
    expect(screen.getByText(/\+4/)).toBeTruthy();
  });
});
```

**Step 2: Run test — expect fail**

```bash
npx vitest run src/components/__tests__/UpcomingStrip.test.tsx
```

Expected: FAIL — `Cannot find module '../UpcomingStrip'`

**Step 3: Create the component**

Create `src/components/UpcomingStrip.tsx`:

```tsx
import { fmt } from '../utils/formatters';
import styles from './UpcomingStrip.module.css';

interface UpcomingItem {
  cat: string;
  sub: string | null;
  amount: number;
  label: string;
}

interface UpcomingStripProps {
  items: UpcomingItem[];
  onSeeAll: () => void;
}

const VISIBLE = 3;

export default function UpcomingStrip({ items, onSeeAll }: UpcomingStripProps) {
  if (items.length === 0) return null;

  const visible = items.slice(0, VISIBLE);
  const extra = items.length - VISIBLE;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.sectionLabel}>Upcoming Unpaid</span>
        {items.length > VISIBLE && (
          <button className={styles.seeAll} onClick={onSeeAll} aria-label="See all upcoming">
            see all
          </button>
        )}
      </div>
      <div className={styles.strip}>
        {visible.map((item, i) => (
          <div key={i} className={styles.card}>
            <span className={styles.catName}>{item.sub ? `${item.cat} · ${item.sub}` : item.cat}</span>
            <span className={styles.amount}>{fmt(item.amount)}</span>
            <span className={styles.month}>{item.label}</span>
          </div>
        ))}
        {extra > 0 && (
          <div className={`${styles.card} ${styles.moreCard}`} onClick={onSeeAll}>
            <span className={styles.moreCount}>+{extra}</span>
            <span className={styles.moreLabel}>more</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Create the stylesheet**

Create `src/components/UpcomingStrip.module.css`:

```css
.wrap {
  margin-bottom: var(--space-md);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.sectionLabel {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.seeAll {
  font-size: 12px;
  color: var(--accent);
  background: none;
  border: none;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  font-weight: 500;
  padding: 4px 0;
  min-height: var(--touch-min);
}

.strip {
  display: flex;
  gap: var(--space-sm);
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 4px;
  /* hide scrollbar */
  scrollbar-width: none;
}

.strip::-webkit-scrollbar {
  display: none;
}

.card {
  flex-shrink: 0;
  min-width: 140px;
  height: 80px;
  background: var(--card);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  border-left: 3px solid var(--amber);
  padding: 12px;
  scroll-snap-align: start;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.catName {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.amount {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  font-family: 'Space Grotesk', sans-serif;
}

.month {
  font-size: 11px;
  color: var(--muted);
}

.moreCard {
  border-left-color: var(--border);
  align-items: center;
  justify-content: center;
  cursor: pointer;
  gap: 2px;
}

.moreCount {
  font-size: 20px;
  font-weight: 700;
  color: var(--muted);
  font-family: 'Space Grotesk', sans-serif;
}

.moreLabel {
  font-size: 11px;
  color: var(--faintest);
}
```

**Step 5: Run test — expect pass**

```bash
npx vitest run src/components/__tests__/UpcomingStrip.test.tsx
```

Expected: 5 tests PASS.

**Step 6: Commit**

```bash
git add src/components/UpcomingStrip.tsx src/components/UpcomingStrip.module.css src/components/__tests__/UpcomingStrip.test.tsx
git commit -m "feat(home): add UpcomingStrip horizontal scroll component"
```

---

### Task 7: Home Screen Mobile Layout in App.tsx

Wires `HeroMonthCard` and `UpcomingStrip` into the dashboard tab. On mobile, shows the compact home screen. On desktop, shows the existing dashboard (unchanged).

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.module.css`

**Step 1: Add imports to App.tsx**

At the top of `src/App.tsx`, add:

```tsx
import HeroMonthCard from './components/HeroMonthCard';
import UpcomingStrip from './components/UpcomingStrip';
```

**Step 2: Add CSS utility classes to App.module.css**

Append to the end of `src/App.module.css`:

```css
/* Mobile-only and desktop-only visibility helpers */
.mobileOnly {
  display: none;
}

.desktopOnly {
  display: block;
}

@media (max-width: 768px) {
  .mobileOnly {
    display: block;
  }

  .desktopOnly {
    display: none;
  }
}

/* Home screen action buttons */
.homeActions {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}
```

**Step 3: Wrap the existing dashboard in `.desktopOnly`**

In `src/App.tsx`, find the `tab === "dashboard"` return block. It currently starts with:

```tsx
          return (
            <div style={{animation:"fadeIn .35s"}}>
              <h2 className={styles.sectionTitle} ...
```

Wrap the entire returned `<div>` in a `desktopOnly` div and add a `mobileOnly` div before it:

```tsx
          const curKey = mk(getCY(), getCM());
          const curIncome = getFixedIncomeForMonth(curKey) + getVarIncomeForMonth(curKey);
          const curPaid = getPaidExpForMonth(curKey);
          const curBalance = curIncome - curPaid;
          const curMonthLabel = `${MONTHS[getCM()]} ${getCY()}`;

          // ... (keep all existing miniData, upcoming, recent calculations unchanged) ...

          return (
            <div style={{animation:"fadeIn .35s"}}>
              {/* ── Mobile home screen ── */}
              <div className={styles.mobileOnly}>
                <HeroMonthCard
                  monthLabel={curMonthLabel}
                  income={curIncome}
                  paid={curPaid}
                  balance={curBalance}
                />
                <UpcomingStrip
                  items={upcoming}
                  onSeeAll={() => setTab("expenses")}
                />
                <div className={styles.homeActions}>
                  <button
                    className={`btn-hover ${styles.btnPrimary}`}
                    style={{touchAction:"manipulation"}}
                    onClick={() => {
                      if (cat) {
                        setModal({type:"editExp", catId:cat.id, catObj:cat,
                          monthKey:mk(getCY(),getCM()),
                          monthLabel:curMonthLabel, entry:null});
                      } else {
                        setTab("expenses");
                      }
                    }}
                  >
                    + Log Expense
                  </button>
                  <button
                    className={`btn-hover ${styles.btnGhost}`}
                    style={{touchAction:"manipulation"}}
                    onClick={() => setModal({type:"addVarIncome"})}
                  >
                    + Log Income
                  </button>
                </div>
              </div>

              {/* ── Desktop dashboard (unchanged) ── */}
              <div className={styles.desktopOnly}>
                <h2 className={styles.sectionTitle} style={{marginBottom:22}}>{MONTHS[getCM()]} {getCY()} Overview</h2>
                {/* ... paste the existing summary cards, mini chart, and two-column section here unchanged ... */}
              </div>
            </div>
          );
```

> **Note to implementer:** The existing dashboard content (summary cards `div.budget-grid-3`, chart card, and two-column `div.budget-grid-2`) should be moved inside the `<div className={styles.desktopOnly}>` block intact. Do not modify any of that code — just wrap it.

**Step 4: Verify build passes**

```bash
npm run build
```

Expected: no errors.

**Step 5: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass.

**Step 6: Commit**

```bash
git add src/App.tsx src/App.module.css
git commit -m "feat(home): mobile home screen with HeroMonthCard, UpcomingStrip, and CTAs"
```

---

### Task 8: CategoryGridCard Component

Card used in the Expenses category picker grid (mobile Step 1).

**Files:**
- Create: `src/components/CategoryGridCard.tsx`
- Create: `src/components/CategoryGridCard.module.css`
- Create: `src/components/__tests__/CategoryGridCard.test.tsx`

**Step 1: Write the failing test**

Create `src/components/__tests__/CategoryGridCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CategoryGridCard from '../CategoryGridCard';

describe('CategoryGridCard', () => {
  const baseProps = {
    name: 'Housing',
    hasDataThisMonth: false,
    onPress: vi.fn(),
  };

  it('displays the category name', () => {
    render(<CategoryGridCard {...baseProps} />);
    expect(screen.getByText('Housing')).toBeTruthy();
  });

  it('calls onPress when clicked', () => {
    const onPress = vi.fn();
    render(<CategoryGridCard {...baseProps} onPress={onPress} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('shows accent dot when hasDataThisMonth is true', () => {
    const { container } = render(<CategoryGridCard {...baseProps} hasDataThisMonth />);
    expect(container.querySelector('[data-active-dot]')).toBeTruthy();
  });

  it('does not show accent dot when hasDataThisMonth is false', () => {
    const { container } = render(<CategoryGridCard {...baseProps} hasDataThisMonth={false} />);
    expect(container.querySelector('[data-active-dot]')).toBeNull();
  });
});
```

**Step 2: Run test — expect fail**

```bash
npx vitest run src/components/__tests__/CategoryGridCard.test.tsx
```

Expected: FAIL — `Cannot find module '../CategoryGridCard'`

**Step 3: Create the component**

Create `src/components/CategoryGridCard.tsx`:

```tsx
import styles from './CategoryGridCard.module.css';

interface CategoryGridCardProps {
  name: string;
  hasDataThisMonth: boolean;
  onPress: () => void;
}

export default function CategoryGridCard({ name, hasDataThisMonth, onPress }: CategoryGridCardProps) {
  return (
    <button
      className={styles.card}
      onClick={onPress}
      style={{ touchAction: 'manipulation' }}
    >
      {hasDataThisMonth && (
        <span className={styles.activeDot} data-active-dot aria-hidden="true" />
      )}
      <span className={styles.name}>{name}</span>
    </button>
  );
}
```

**Step 4: Create the stylesheet**

Create `src/components/CategoryGridCard.module.css`:

```css
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 96px;
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  background: var(--card);
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  transition: transform 0.1s, border-color 0.2s, box-shadow 0.2s;
  padding: var(--space-sm);
  -webkit-tap-highlight-color: transparent;
}

.card:active {
  transform: scale(0.97);
}

@media (hover: hover) {
  .card:hover {
    border-color: var(--accent);
    box-shadow: 0 4px 16px var(--accent-glow);
  }
}

.activeDot {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 6px var(--accent-glow);
}

.name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  text-align: center;
  line-height: 1.3;
}
```

**Step 5: Run test — expect pass**

```bash
npx vitest run src/components/__tests__/CategoryGridCard.test.tsx
```

Expected: 4 tests PASS.

**Step 6: Commit**

```bash
git add src/components/CategoryGridCard.tsx src/components/CategoryGridCard.module.css src/components/__tests__/CategoryGridCard.test.tsx
git commit -m "feat(expenses): add CategoryGridCard for mobile category picker"
```

---

### Task 9: Expenses Two-Step Flow in App.tsx

Replaces the mobile category pill-row with a full-screen category grid (Step 1) that slides into a month list (Step 2) on mobile. Desktop sidebar layout is untouched.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.module.css`

**Step 1: Add the import**

In `src/App.tsx`, add:

```tsx
import CategoryGridCard from './components/CategoryGridCard';
```

**Step 2: Add local state for the mobile step**

Inside `BudgetApp`, near the other `useState` declarations, add:

```tsx
const [mobileExpStep, setMobileExpStep] = useState<'picker' | 'months'>('picker');
const [slideDir, setSlideDir] = useState<'right' | 'left'>('right');
```

Also add a `useEffect` to reset to picker when the tab changes to expenses:

```tsx
// Reset expenses step when navigating away and back
import { useState, useEffect } from 'react'; // update existing import
```

Inside the component:

```tsx
useEffect(() => {
  if (tab !== 'expenses') setMobileExpStep('picker');
}, [tab]);
```

**Step 3: Add slide animation keyframes and classes to App.module.css**

Append to `src/App.module.css`:

```css
/* Expenses two-step slide transitions (mobile) */
.slideFromRight {
  animation: slideInRight 150ms ease-out;
}

.slideFromLeft {
  animation: slideInLeft 150ms ease-out;
}

@keyframes slideInRight {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}

@keyframes slideInLeft {
  from { transform: translateX(-100%); opacity: 0; }
  to   { transform: translateX(0);     opacity: 1; }
}

/* Category grid layout */
.catGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: var(--space-md);
}

/* Step 2 sub-header on mobile */
.expMobileHeader {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.expMobileBack {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 22px;
  color: var(--muted);
  padding: 8px;
  border-radius: 10px;
  min-width: var(--touch-min);
  min-height: var(--touch-min);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.expMobileCatName {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  font-family: 'Space Grotesk', sans-serif;
  flex: 1;
}
```

**Step 4: Update the `tab === "expenses"` section in App.tsx**

Find the `{tab === "expenses" && (` block. It currently starts with a `<div className="exp-layout" ...>`. Keep the entire desktop layout inside a `desktopOnly` div and add a `mobileOnly` div with the two-step flow before it.

The structure should become:

```tsx
{tab === "expenses" && (
  <div style={{animation:"fadeIn .35s"}}>

    {/* ── Mobile two-step flow ── */}
    <div className={styles.mobileOnly}>
      {mobileExpStep === 'picker' && (
        <div key="picker" className={slideDir === 'left' ? styles.slideFromLeft : ''}>
          <div className={styles.catGrid}>
            {categories.map((c, i) => {
              const curKey = mk(getCY(), getCM());
              const hasData = !!expenses?.[c.id]?.[curKey];
              return (
                <CategoryGridCard
                  key={c.id}
                  name={c.name}
                  hasDataThisMonth={hasData}
                  onPress={() => {
                    setCatIdx(i);
                    setExpYear(getCY());
                    setExpSel(new Set());
                    setSlideDir('right');
                    setMobileExpStep('months');
                  }}
                />
              );
            })}
          </div>
          {categories.length === 0 && (
            <div className={styles.emptyState}>
              <div style={{fontSize:32,marginBottom:8,opacity:.5}}>📂</div>
              <p style={{fontWeight:500,marginBottom:4}}>No categories yet</p>
              <button onClick={()=>setModal({type:"addCat"})} className={`btn-hover ${styles.btnPrimary}`} style={{marginTop:12}}>
                Create your first category
              </button>
            </div>
          )}
          <button onClick={()=>setModal({type:"addCat"})} className={`btn-hover ${styles.btnGhost}`}
            style={{width:"100%",marginTop:8}}>
            + Add Category
          </button>
        </div>
      )}

      {mobileExpStep === 'months' && cat && (
        <div key="months" className={slideDir === 'right' ? styles.slideFromRight : ''}>
          {/* Sub-header */}
          <div className={styles.expMobileHeader}>
            <button className={styles.expMobileBack}
              onClick={() => { setSlideDir('left'); setMobileExpStep('picker'); }}
              aria-label="Back to categories">
              ‹
            </button>
            <span className={styles.expMobileCatName}>{cat.name}</span>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <button onClick={() => { if(expYear > 2020) setExpYear(expYear - 1); }}
                className={`year-btn-h ${styles.yearBtn}`} style={{opacity:expYear>2020?1:.3}}>◂</button>
              <span className={styles.yearLabel}>{expYear}</span>
              <button onClick={() => { if(expYear < catMaxYear-1) setExpYear(expYear + 1); }}
                className={`year-btn-h ${styles.yearBtn}`} style={{opacity:expYear<catMaxYear-1?1:.3}}>▸</button>
            </div>
          </div>

          {/* Month list — reuse the existing mobileListWrap cards */}
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
            {MONTHS.map((mName, mi) => {
              const key = mk(expYear, mi);
              const entry = expenses?.[cat.id]?.[key] || null;
              const hasSubs = (cat.subcategories?.length ?? 0) > 0;
              const isPast = expYear < getCY() || (expYear === getCY() && mi < getCM());
              const isCurrent = expYear === getCY() && mi === getCM();
              const totalAmt = hasSubs
                ? (cat.subcategories||[]).reduce((s,sc) => s + (entry?.subAmounts?.[sc.id]||0), 0) || (entry?.amount||0)
                : (entry?.amount||0);
              const subAmounts = entry?.subAmounts || {};
              const subIds = hasSubs ? Object.keys(subAmounts).filter(id => (subAmounts[id]||0) > 0) : [];
              const paidCount = subIds.filter(id => entry?.subPaid?.[id]?.paid).length;
              const fullyPaid = hasSubs ? (subIds.length > 0 && paidCount === subIds.length) : !!entry?.paid;
              const partialPaid = hasSubs && paidCount > 0 && !fullyPaid;

              let pillText = "+ Add";
              let pillColor = "var(--faintest)";
              let pillBg = "transparent";
              let pillBorder = "1px solid var(--border)";
              if (fullyPaid) {
                pillText = "Paid"; pillColor = "var(--accent)"; pillBg = "var(--accent-bg)"; pillBorder = "1px solid var(--accent-light)";
              } else if (partialPaid) {
                pillText = `${paidCount}/${subIds.length} paid`; pillColor = "var(--amber,#C8850A)"; pillBg = "color-mix(in srgb,var(--amber,#C8850A) 10%,transparent)"; pillBorder = "1px solid color-mix(in srgb,var(--amber,#C8850A) 25%,transparent)";
              } else if (totalAmt > 0) {
                pillText = "Unpaid"; pillColor = "var(--amber,#C8850A)"; pillBg = "color-mix(in srgb,var(--amber,#C8850A) 10%,transparent)"; pillBorder = "1px solid color-mix(in srgb,var(--amber,#C8850A) 25%,transparent)";
              }

              return (
                <div key={mi}
                  className={`stagger-row ${styles.mobileRow} ${isCurrent ? styles.mobileRowCurrent : ''}`}
                  onClick={() => setModal({type:"editExp",catId:cat.id,catObj:cat,monthKey:key,monthLabel:`${mName} ${expYear}`,entry})}
                  style={{opacity: isPast && !entry ? 0.45 : 1, animationDelay:`${mi*20}ms`}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontWeight:700,fontSize:14,color:isCurrent?"var(--accent)":"var(--text)"}}>{mName}</span>
                      {isCurrent && <span className={styles.nowBadge}>now</span>}
                    </div>
                    <span style={{fontSize:12,fontWeight:600,color:pillColor,background:pillBg,padding:"3px 10px",borderRadius:20,border:pillBorder}}>
                      {pillText}
                    </span>
                  </div>
                  <div style={{marginTop:6,fontSize:20,fontWeight:700,color:totalAmt>0?"var(--text)":"var(--faint)"}}>
                    {totalAmt > 0 ? fmt(totalAmt) : "—"}
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.yearTotal}>
            <span style={{color:"var(--muted)"}}>Total for {expYear}:</span>
            <span style={{fontWeight:600,fontSize:18,color:"var(--text)"}}>
              {fmt(MONTHS.reduce((s,_,mi) => s + (getExp(cat.id, mk(expYear,mi))?.amount||0), 0))}
            </span>
          </div>
        </div>
      )}
    </div>

    {/* ── Desktop layout (existing, unchanged) ── */}
    <div className={`exp-layout desktopOnly ${styles.desktopOnly}`} style={{display:"flex",gap:20,alignItems:"flex-start"}}>
      {/* paste the existing sidebar + right content here, untouched */}
    </div>

  </div>
)}
```

> **Note to implementer:** Move the existing `<div className="exp-layout" ...>` block (the full desktop sidebar + right-content) inside the `<div className={... styles.desktopOnly}>` wrapper. Do not modify any code inside it.

**Step 5: Verify build passes**

```bash
npm run build
```

Expected: no errors.

**Step 6: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass.

**Step 7: Commit**

```bash
git add src/App.tsx src/App.module.css
git commit -m "feat(expenses): two-step mobile category flow with slide transitions"
```

---

### Task 10: SegmentedToggle Component

Reusable two-option toggle used on the Incomes screen.

**Files:**
- Create: `src/components/SegmentedToggle.tsx`
- Create: `src/components/SegmentedToggle.module.css`
- Create: `src/components/__tests__/SegmentedToggle.test.tsx`

**Step 1: Write the failing test**

Create `src/components/__tests__/SegmentedToggle.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SegmentedToggle from '../SegmentedToggle';

const OPTIONS = [
  { id: 'fixed', label: 'Fixed' },
  { id: 'variable', label: 'Variable' },
];

describe('SegmentedToggle', () => {
  it('renders both options', () => {
    render(<SegmentedToggle options={OPTIONS} value="fixed" onChange={vi.fn()} />);
    expect(screen.getByText('Fixed')).toBeTruthy();
    expect(screen.getByText('Variable')).toBeTruthy();
  });

  it('marks the active option with aria-pressed', () => {
    render(<SegmentedToggle options={OPTIONS} value="fixed" onChange={vi.fn()} />);
    const fixedBtn = screen.getByRole('button', { name: 'Fixed' });
    const varBtn = screen.getByRole('button', { name: 'Variable' });
    expect(fixedBtn.getAttribute('aria-pressed')).toBe('true');
    expect(varBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onChange with the clicked option id', async () => {
    const onChange = vi.fn();
    render(<SegmentedToggle options={OPTIONS} value="fixed" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Variable' }));
    expect(onChange).toHaveBeenCalledWith('variable');
  });

  it('does not call onChange when clicking the already-active option', async () => {
    const onChange = vi.fn();
    render(<SegmentedToggle options={OPTIONS} value="fixed" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Fixed' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test — expect fail**

```bash
npx vitest run src/components/__tests__/SegmentedToggle.test.tsx
```

Expected: FAIL — `Cannot find module '../SegmentedToggle'`

**Step 3: Create the component**

Create `src/components/SegmentedToggle.tsx`:

```tsx
import styles from './SegmentedToggle.module.css';

interface Option {
  id: string;
  label: string;
}

interface SegmentedToggleProps {
  options: Option[];
  value: string;
  onChange: (id: string) => void;
}

export default function SegmentedToggle({ options, value, onChange }: SegmentedToggleProps) {
  return (
    <div className={styles.wrap} role="group">
      {options.map((opt) => (
        <button
          key={opt.id}
          className={`${styles.option} ${value === opt.id ? styles.active : ''}`}
          onClick={() => { if (opt.id !== value) onChange(opt.id); }}
          aria-pressed={opt.id === value}
          style={{ touchAction: 'manipulation' }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

**Step 4: Create the stylesheet**

Create `src/components/SegmentedToggle.module.css`:

```css
.wrap {
  display: flex;
  background: var(--chip);
  border-radius: 12px;
  padding: 3px;
  margin-bottom: var(--space-md);
}

.option {
  flex: 1;
  height: 38px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--muted);
  font-size: 14px;
  font-weight: 500;
  font-family: 'DM Sans', sans-serif;
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.22, 1, 0.36, 1);
  min-height: var(--touch-min);
}

.active {
  background: var(--card);
  color: var(--text);
  box-shadow: 0 1px 4px var(--shadow);
}
```

**Step 5: Run test — expect pass**

```bash
npx vitest run src/components/__tests__/SegmentedToggle.test.tsx
```

Expected: 4 tests PASS.

**Step 6: Commit**

```bash
git add src/components/SegmentedToggle.tsx src/components/SegmentedToggle.module.css src/components/__tests__/SegmentedToggle.test.tsx
git commit -m "feat(incomes): add reusable SegmentedToggle component"
```

---

### Task 11: Incomes SegmentedToggle Integration in App.tsx

Replaces the stacked Fixed/Variable layout on mobile with a segmented toggle. Desktop stacked layout is untouched.

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add the import**

In `src/App.tsx`, add:

```tsx
import SegmentedToggle from './components/SegmentedToggle';
```

**Step 2: Add local state**

Inside `BudgetApp`, add:

```tsx
const [incomeSegment, setIncomeSegment] = useState<'fixed' | 'variable'>('fixed');
```

**Step 3: Update the `tab === "incomes"` section**

Find `{tab === "incomes" && (`. Wrap the existing content in `desktopOnly` and add a `mobileOnly` section above it.

The `mobileOnly` section:

```tsx
{/* ── Mobile incomes: segmented toggle ── */}
<div className={styles.mobileOnly}>
  <SegmentedToggle
    options={[{ id: 'fixed', label: 'Fixed' }, { id: 'variable', label: 'Variable' }]}
    value={incomeSegment}
    onChange={(id) => setIncomeSegment(id as 'fixed' | 'variable')}
  />

  {incomeSegment === 'fixed' && (
    <>
      {fixedIncomes.length === 0 ? (
        <div className={styles.emptyState}>
          <div style={{fontSize:32,marginBottom:8,opacity:.5}}>💰</div>
          <p style={{fontWeight:500,marginBottom:4}}>No fixed income sources yet</p>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
          {fixedIncomes.map((src, si) => {
            const sorted = [...(src.records||[])].sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom));
            const current = sorted.filter(r=>r.effectiveFrom<=mk(getCY(),getCM())).pop();
            return (
              <div key={src.id} className={`stagger-card card-h ${styles.incomeCard}`} style={{animationDelay:`${si*80}ms`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <h3 style={{fontSize:16,fontWeight:600,marginBottom:4}}>{src.name}</h3>
                    {current && (
                      <div style={{fontSize:22,fontWeight:700,color:"var(--accent)",fontFamily:"'Space Grotesk',sans-serif"}}>
                        {fmt(current.amount)}<span style={{fontSize:13,fontWeight:400,color:"var(--muted)"}}>/mo</span>
                      </div>
                    )}
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>setModal({type:"editFixedIncome",idx:si,src})} className={styles.btnSmall}>Edit</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <button onClick={()=>setModal({type:"addFixedIncome"})} className={`btn-hover ${styles.btnPrimary}`}
        style={{width:"100%",touchAction:"manipulation"}}>
        + Add Fixed Source
      </button>
    </>
  )}

  {incomeSegment === 'variable' && (
    <>
      {variableIncomes.length === 0 ? (
        <div className={styles.emptyState}>
          <div style={{fontSize:32,marginBottom:8,opacity:.5}}>📋</div>
          <p style={{fontWeight:500,marginBottom:4}}>No variable income recorded yet</p>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
          {[...variableIncomes].sort((a,b)=>b.month.localeCompare(a.month)).map(v => {
            const {y,m} = parseMk(v.month);
            return (
              <div key={v.id} className={`${styles.mobileRow}`}
                onClick={()=>setModal({type:"editVarIncome",item:v})}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontWeight:600,fontSize:14}}>{v.name}</span>
                  <span style={{fontWeight:700,fontSize:16,color:"var(--accent)"}}>{fmt(v.amount)}</span>
                </div>
                <span style={{fontSize:12,color:"var(--muted)",marginTop:4}}>{MONTHS[m]} {y}</span>
              </div>
            );
          })}
        </div>
      )}
      <button onClick={()=>setModal({type:"addVarIncome"})} className={`btn-hover ${styles.btnPrimary}`}
        style={{width:"100%",touchAction:"manipulation"}}>
        + Add Variable Entry
      </button>
    </>
  )}
</div>

{/* ── Desktop incomes (existing, unchanged) ── */}
<div className={styles.desktopOnly}>
  {/* paste existing Fixed and Variable sections here, untouched */}
</div>
```

> **Note to implementer:** Move the existing Fixed and Variable `<section>` blocks inside the `<div className={styles.desktopOnly}>` wrapper. Do not modify any code inside them.

**Step 4: Verify build**

```bash
npm run build
```

Expected: no errors.

**Step 5: Run all tests**

```bash
npx vitest run
```

Expected: all pass.

**Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat(incomes): mobile segmented toggle for Fixed/Variable income"
```

---

### Task 12: Budget Metric Chips + MonthDetailAccordion

Adds the 3 compact metric chips and collapsible monthly table on mobile. Desktop BudgetView is untouched.

**Files:**
- Create: `src/components/MonthDetailAccordion.tsx`
- Create: `src/components/MonthDetailAccordion.module.css`
- Create: `src/components/__tests__/MonthDetailAccordion.test.tsx`
- Modify: `src/components/views/BudgetView.tsx`
- Modify: `src/components/views/BudgetView.module.css`

**Step 1: Write the failing test**

Create `src/components/__tests__/MonthDetailAccordion.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MonthDetailAccordion from '../MonthDetailAccordion';

describe('MonthDetailAccordion', () => {
  it('renders the toggle button', () => {
    render(<MonthDetailAccordion><p>Content</p></MonthDetailAccordion>);
    expect(screen.getByRole('button', { name: /monthly detail/i })).toBeTruthy();
  });

  it('hides children by default', () => {
    render(<MonthDetailAccordion><p>Hidden content</p></MonthDetailAccordion>);
    expect(screen.queryByText('Hidden content')).toBeNull();
  });

  it('shows children after clicking the toggle', async () => {
    render(<MonthDetailAccordion><p>Hidden content</p></MonthDetailAccordion>);
    await userEvent.click(screen.getByRole('button', { name: /monthly detail/i }));
    expect(screen.getByText('Hidden content')).toBeTruthy();
  });

  it('hides children again after clicking twice', async () => {
    render(<MonthDetailAccordion><p>Content</p></MonthDetailAccordion>);
    const btn = screen.getByRole('button', { name: /monthly detail/i });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(screen.queryByText('Content')).toBeNull();
  });
});
```

**Step 2: Run test — expect fail**

```bash
npx vitest run src/components/__tests__/MonthDetailAccordion.test.tsx
```

Expected: FAIL — `Cannot find module '../MonthDetailAccordion'`

**Step 3: Create MonthDetailAccordion**

Create `src/components/MonthDetailAccordion.tsx`:

```tsx
import { useState } from 'react';
import type { ReactNode } from 'react';
import styles from './MonthDetailAccordion.module.css';

interface MonthDetailAccordionProps {
  children: ReactNode;
}

export default function MonthDetailAccordion({ children }: MonthDetailAccordionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.wrap}>
      <button
        className={styles.toggle}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={`Monthly detail ${open ? 'collapse' : 'expand'}`}
        style={{ touchAction: 'manipulation' }}
      >
        <span>Monthly Detail</span>
        <span className={styles.chevron} aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className={styles.content}>{children}</div>}
    </div>
  );
}
```

**Step 4: Create the stylesheet**

Create `src/components/MonthDetailAccordion.module.css`:

```css
.wrap {
  margin-top: var(--space-sm);
}

.toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px var(--space-md);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  font-family: 'DM Sans', sans-serif;
  min-height: var(--touch-min);
  transition: border-color 0.2s;
}

.toggle:active {
  opacity: 0.8;
}

.chevron {
  font-size: 12px;
  color: var(--muted);
  transition: transform 0.2s;
}

.content {
  margin-top: 8px;
  border-radius: var(--radius-card);
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--card);
  animation: fadeIn 0.2s;
}
```

**Step 5: Run test — expect pass**

```bash
npx vitest run src/components/__tests__/MonthDetailAccordion.test.tsx
```

Expected: 4 tests PASS.

**Step 6: Add metric chips CSS to BudgetView.module.css**

In `src/components/views/BudgetView.module.css`, append:

```css
/* Mobile metric chips strip */
.metricChips {
  display: none;
}

.metricChip {
  flex: 1;
  min-width: 100px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 14px var(--space-sm);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metricChipLabel {
  font-size: 10px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.metricChipValue {
  font-size: 20px;
  font-weight: 700;
  font-family: 'Space Grotesk', sans-serif;
  letter-spacing: -0.3px;
}

/* Hide desktop summary cards on mobile */
@media (max-width: 768px) {
  .metricChips {
    display: flex;
    gap: var(--space-sm);
    overflow-x: auto;
    margin-bottom: var(--space-md);
    padding-bottom: 4px;
    scrollbar-width: none;
  }

  .metricChips::-webkit-scrollbar {
    display: none;
  }

  .summaryGrid {
    display: none !important;
  }
}
```

**Step 7: Update BudgetView.tsx**

At the top of `src/components/views/BudgetView.tsx`, add the imports:

```tsx
import MonthDetailAccordion from '../MonthDetailAccordion';
```

In the `BudgetView` return, directly after the year nav `<div>`, add the metric chips strip before the existing `summaryGrid`:

```tsx
      {/* Mobile metric chips — 3 values, replaces 4-card summaryGrid on mobile */}
      <div className={styles.metricChips}>
        {[
          { label: 'Income', value: yearTotals.income, color: 'var(--accent)' },
          { label: 'Paid', value: yearTotals.paid, color: 'var(--red)' },
          { label: 'Balance', value: yearTotals.balance, color: yearTotals.balance >= 0 ? 'var(--accent)' : 'var(--red)' },
        ].map((m) => (
          <div key={m.label} className={styles.metricChip}>
            <span className={styles.metricChipLabel}>{m.label}</span>
            <span className={styles.metricChipValue} style={{ color: m.color }}>{fmt(m.value)}</span>
          </div>
        ))}
      </div>
```

Then find the Monthly Detail `<div>` block (the one containing `<table style={{width:"100%"...`). Wrap it with `MonthDetailAccordion` on mobile:

Replace:
```tsx
      <div className={`stagger-card glass-card chart-3d ${styles.chartCard}`} style={{marginTop:14,...}}>
        <h3 className={styles.chartTitle}>Monthly Detail</h3>
        <div style={{overflowX:"auto"}}>
          <table ...>
```

With:
```tsx
      <MonthDetailAccordion>
        <div style={{overflowX:"auto"}}>
          <table ...>
            {/* existing table unchanged */}
          </table>
        </div>
      </MonthDetailAccordion>
```

> **Note to implementer:** The `MonthDetailAccordion` is shown on all screen sizes but the toggle is only visually prominent on mobile. On desktop, the table is visible inside a standard card as before — you can optionally keep the accordion wrapper or revert to the plain card for desktop. The simplest approach is to wrap with `MonthDetailAccordion` universally; the `<h3>Monthly Detail</h3>` header is replaced by the accordion toggle.

**Step 8: Verify build**

```bash
npm run build
```

Expected: no errors.

**Step 9: Run all tests**

```bash
npx vitest run
```

Expected: all pass.

**Step 10: Commit**

```bash
git add src/components/MonthDetailAccordion.tsx src/components/MonthDetailAccordion.module.css src/components/__tests__/MonthDetailAccordion.test.tsx src/components/views/BudgetView.tsx src/components/views/BudgetView.module.css
git commit -m "feat(budget): mobile metric chips and collapsible MonthDetailAccordion"
```

---

### Task 13: Desktop Refinements

Minor CSS polish that tightens the desktop experience to match the unified token scale. No functional changes.

**Files:**
- Modify: `src/App.module.css`

**Step 1: Tighten header padding**

In `src/App.module.css`, find `.headerInner` (around line 43):

```css
.headerInner {
  margin: 0 auto;
  padding: 14px 28px;
```

Change to:

```css
.headerInner {
  margin: 0 auto;
  padding: 12px 24px;
```

**Step 2: Slim the category sidebar**

In `src/App.module.css`, find `.catSidebar` (around line 119):

```css
  width: 240px;
```

Change to:

```css
  width: 220px;
```

**Step 3: Unify card border-radius**

In `src/App.module.css`, find `.summaryCard` (around line 467):

```css
  border-radius: 18px;
```

Change to:

```css
  border-radius: var(--radius-card);
```

Find `.chartCard` (around line 477):

```css
  border-radius: 18px;
```

Change to:

```css
  border-radius: var(--radius-card);
```

Find `.incomeCard` (around line 312):

```css
  border-radius: 16px;
```

Change to:

```css
  border-radius: var(--radius-card);
```

**Step 4: Verify build**

```bash
npm run build
```

Expected: no errors.

**Step 5: Run all tests**

```bash
npx vitest run
```

Expected: all pass.

**Step 6: Commit**

```bash
git add src/App.module.css
git commit -m "refactor(desktop): tighten header padding, sidebar width, unify card radius"
```

---

## Implementation Order

Complete tasks in sequence — each builds on the previous:

1. CSS Tokens
2. BottomPillNav component
3. Mobile header slim-down
4. Wire BottomPillNav into App
5. HeroMonthCard
6. UpcomingStrip
7. Home screen mobile layout
8. CategoryGridCard
9. Expenses two-step flow
10. SegmentedToggle
11. Incomes SegmentedToggle integration
12. Budget metric chips + MonthDetailAccordion
13. Desktop refinements

## Verification After All Tasks

```bash
# All unit tests pass
npx vitest run

# Production build succeeds
npm run build

# Dev server starts
npm run dev
# Then verify manually at http://localhost:3000:
# - Mobile (375px): bottom pill nav, home screen, category grid, segmented incomes
# - Desktop (1200px): existing layout unchanged
```
