# Summa Mobile UX Redesign — Design Document
**Date:** 2026-06-30  
**Scope:** Full responsive overhaul — mobile-primary redesign, desktop refinements  
**Status:** Approved

---

## Overview

The redesign treats Summa as a **mobile-primary app with a desktop companion mode**. The existing design is desktop-first with mobile adaptations bolted on; this inverts that relationship. The mobile experience is designed from scratch around single-viewport interactions, then the desktop layout inherits the same spacing tokens and component shapes at wider breakpoints.

One CSS token system. One component set. Two navigation shells.

---

## Navigation Architecture

### Desktop (≥769px) — unchanged shell
- Sticky top header: `Summa` logo + tagline · tab bar (Overview / Expenses / Incomes / Budget) · dark-mode toggle + Account + Logout
- No structural change to the existing layout

### Mobile (<768px) — floating bottom pill nav
- Header collapses to a **single row**: `Summa` left · dark-mode toggle + Account icon right · ~56px tall
- Tab labels removed from header entirely
- **Floating pill nav bar** sits above safe area:
  - `position: fixed; bottom: calc(16px + env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%)`
  - `width: clamp(280px, 85vw, 360px); height: 64px; border-radius: 32px`
  - Glassmorphic background (`var(--header-bg)`), subtle shadow
  - 4 items: 24px icon + 10px label, stacked vertically
  - Active state: accent-colored icon + label + inner pill `background: var(--accent-bg)`
  - Transition: `background 0.2s, color 0.2s`

---

## Screen Designs

### 1. Home Screen (replaces Dashboard on mobile)

Fits entirely within one viewport on 375×667px. Zero scrolling required.

**Layout (top to bottom):**
1. **Single-row header** — Summa logo + dark-mode toggle + account icon
2. **Hero Month Card** — glassmorphic, full-width, `border-radius: 20px`, `padding: 24px`
   - Current month label (e.g. "JUNE 2026")
   - Income + Balance side-by-side (`grid-template-columns: 1fr 1fr`)
   - Progress bar: `height: 6px`, accent fill = paid/income ratio; anticipated as faint secondary fill
   - Label: "$2,850 paid of $4,200"
3. **Upcoming Unpaid strip** — section label "UPCOMING UNPAID" + "see all" link
   - Horizontal `overflow-x: auto; scroll-snap-type: x mandatory`
   - Cards: `min-width: 140px; height: 80px; scroll-snap-align: start`
   - 3px amber left-border per card; category name (12px) + amount (18px bold) + month (11px muted)
   - Max 3 cards visible; "+N more" card as last item
4. **Primary CTA** — "＋ Log Expense" (accent fill, full-width, 48px)
5. **Secondary CTA** — "＋ Log Income" (ghost, full-width, 48px)
6. **Floating pill nav**

**Notes:**
- "Log Expense" opens `ExpenseModal` directly, pre-selecting last-used category
- 6-month chart, Recent Payments list, and full analytics live exclusively in Budget tab on mobile
- "Anticipated" metric visible in progress bar and Budget tab only — not a top-level card on mobile

**Desktop:** No change — existing dashboard with 4 summary cards, 6-month chart, Upcoming + Recent two-column layout is preserved.

---

### 2. Expenses Screen — Two-Step Flow (mobile only)

#### Step 1: Category Picker
- Full-screen 2-column grid of category cards
- Each card: `min-height: 96px; border-radius: 16px; border: 1px solid var(--border)`
- Icon: 28px centered; label: 13px `font-weight: 600` below icon
- Active-month indicator: 6px accent dot, top-right corner
- Press state: `transform: scale(0.97)` at 100ms
- "＋ Add Category" ghost button centered below grid
- **No sidebar** on mobile

#### Step 2: Month List
- Sub-header: `‹ [CategoryName]` (back chevron) + year nav (`◂ 2026 ▸`) in header row
- Full-width list of 12 month rows
- Each row: month name + amount (or "—") + status pill (Paid / Unpaid / + Add)
- Current month: accent-colored border
- Tap any row → existing `ExpenseModal` bottom sheet (unchanged)
- Year total pinned above the floating nav

#### Transition
- Category tap → **slide right** (new screen enters from right): `150ms ease-out`
- Back chevron → **slide left** (category picker re-enters): `150ms ease-out`

**Desktop:** Existing sidebar + table layout preserved exactly. Two-step flow is mobile-only.

---

### 3. Incomes Screen (mobile)

Segmented toggle at top replaces the stacked-section layout:

- **Segmented Toggle**: full-width, 44px height, `border-radius: 12px`, `background: var(--chip)`
  - Active segment: `background: var(--card); box-shadow: 0 1px 4px var(--shadow)` (lift)
  - Transition: `all 0.2s cubic-bezier(0.22, 1, 0.36, 1)`
- **Fixed segment**: income source cards (unchanged design) + "＋ Add Fixed Source" CTA inline at bottom
- **Variable segment**: variable income list (card or table pattern) + "＋ Add Entry" CTA inline at bottom
- Existing `mobileActionBar` (`+ Fixed` / `+ Variable` buttons) **retired**

**Desktop:** No change — both sections stacked with existing section headers and right-aligned add buttons.

---

### 4. Budget Screen (mobile)

Progressive disclosure through a compact 3-zone layout:

1. **Year nav** in header row: `‹ 2026 ›`
2. **Metric chips strip** (horizontal scroll if needed, but 3 fits at 375px):
   - Income / Paid / Balance — compact chips, `height: 56px`
   - "Anticipated" demoted — visible in chart tooltips and expanded Monthly Detail
3. **Breakdown chart card** — existing `ViewSelect` dropdown preserved, chart height `150px`, padding reduced to `16px`
4. **Trends chart card** — same treatment
5. **Monthly Detail accordion** — collapsed by default; tap "Monthly Detail ↕ expand" to reveal the 7-column table (horizontal scroll within)

**Desktop:** No change — all 4 summary cards, both chart rows, category filter chips, and full data table visible at once.

---

## Spacing & Token System

Unified scale applied at every breakpoint:

| Token | Value | Usage |
|---|---|---|
| `--space-xs` | 6px | gap between chips, icon padding |
| `--space-sm` | 12px | card inner padding (mobile) |
| `--space-md` | 16px | card padding (desktop), section gaps |
| `--space-lg` | 24px | section padding, modal padding |
| `--space-xl` | 32px | between major sections |
| `--radius-card` | 16px | all cards (unified, currently mixed 14–18px) |
| `--radius-pill` | 32px | bottom nav, segment toggles |
| `--touch-min` | 44px | minimum tap target |

---

## Interaction Map

| Trigger | Animation | Duration |
|---|---|---|
| Tap category card | Slide right (new screen from right, old exits left) | 150ms ease-out |
| Tap ‹ back | Slide left (category picker re-enters from left) | 150ms ease-out |
| Tap bottom nav item | Fade + scale pulse (1.0→1.02→1.0) on incoming screen | 200ms |
| Tap month row | Bottom sheet slides up (`slideUpMobile`) | 300ms (unchanged) |
| Tap segmented toggle | Inner pill slides horizontally (CSS `translate`) | 180ms |
| Category card press | `scale(0.97)` on `touchstart`, release on `touchend` | 100ms |
| Log Expense shortcut | Opens expense modal, pre-fills last-used category | instant |
| Paid checkbox | Existing `check-pop` scale animation | unchanged |

---

## Desktop Refinements Only

- Header `padding`: `14px 28px` → `12px 24px`
- Summary cards: unified `--radius-card` (16px)
- Expenses sidebar: `width` `240px` → `220px`
- Chart cards: `marginBottom` stays at `14px` (already consistent)

---

## Component Inventory

### New components
1. `BottomPillNav` — floating bottom nav (mobile only)
2. `SegmentedToggle` — two-segment toggle (Incomes screen)
3. `CategoryGridCard` — card in the category picker grid
4. `HeroMonthCard` — home screen summary card with progress bar
5. `UpcomingStrip` — horizontal scroll strip of upcoming unpaid cards
6. `MonthDetailAccordion` — collapsible wrapper for the Budget monthly table

### Modified components
- `App.tsx` — mobile header reduced to single row; tab nav moved to `BottomPillNav`
- `BudgetView.tsx` — metric chips replace summary cards on mobile; Monthly Detail wrapped in accordion
- Incomes section in `App.tsx` — segmented toggle replaces stacked sections; `mobileActionBar` retired

### Unchanged components
- `ExpenseModal` — bottom sheet behavior unchanged
- `CategoryFormModal`, `FixedIncomeModal`, `VarIncomeModal` — unchanged
- `LoansView` — unchanged
- All chart components — unchanged
- All auth/billing/account components — unchanged

---

## UX Rationale

**Floating pill nav over fixed tab bar:** Reserves less vertical space; leaves screen edges accessible; signals intentional native-feel design.

**Two-step category flow over sidebar:** On 375px, a sidebar forces two ~160px-wide columns — too narrow for comfortable reading. Full-width steps eliminate width compression and produce a clear forward/back mental model.

**Collapsing Monthly Detail table on mobile:** 7-column table requires horizontal scroll which conflicts with left/right navigation gestures. Collapsed-by-default means users who need it opt in knowingly.

**Progress bar over 4 cards on Home:** One visual answers "where do I stand?" in under a second. Four equal-weight numbers require mental arithmetic.

**Inline CTAs over mobileActionBar:** Bottom-bar buttons are spatially disconnected from the content they create. Inline CTAs sit directly above the list they add to, reinforcing the spatial relationship.
