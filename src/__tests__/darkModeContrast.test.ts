/**
 * WCAG 2.1 contrast tests for dark mode.
 *
 * Red flags caught here:
 *  - CSS custom properties (--muted, --faintest) that are too dark
 *  - Hardcoded hex colours in chart tick fills that copy the broken --muted value
 *
 * Thresholds used:
 *  - 4.5:1  WCAG AA — normal body / label text
 *  - 3.5:1  relaxed — tertiary / decorative secondary text (empty states, hints)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── WCAG helpers ──────────────────────────────────────────────────────────────

/** Relative luminance of a #RRGGBB hex colour per WCAG 2.1 §1.4.3 */
function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.1 contrast ratio between two #RRGGBB colours */
function contrast(fg: string, bg: string): number {
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

// ── CSS parser ────────────────────────────────────────────────────────────────

/** Extract CSS custom property values from the [data-theme="dark"] block. */
function darkModeVars(): Map<string, string> {
  const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf-8');
  const block = css.match(/\[data-theme="dark"\]\s*\{([^}]+)\}/)?.[1] ?? '';
  const map = new Map<string, string>();
  for (const m of block.matchAll(/--([\w-]+)\s*:\s*([^;]+)/g)) {
    map.set(`--${m[1]}`, m[2].trim());
  }
  return map;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** --bg in dark mode (solid value used as baseline for contrast checks) */
const DARK_BG = '#111827';
const WCAG_AA = 4.5;
const WCAG_AA_TERTIARY = 3.5; // for hints, empty-state messages, decorative labels

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Dark mode WCAG contrast', () => {
  describe('CSS custom properties in index.css', () => {
    it('--muted is a solid hex colour and meets WCAG AA (4.5:1) on the dark background', () => {
      const vars = darkModeVars();
      const muted = vars.get('--muted') ?? '';
      // Must be a plain #RRGGBB so we can compute luminance
      expect(muted).toMatch(/^#[0-9a-fA-F]{6}$/);
      const ratio = contrast(muted, DARK_BG);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA);
    });

    it('--faintest is a solid hex colour and meets 3.5:1 on the dark background', () => {
      const vars = darkModeVars();
      const faintest = vars.get('--faintest') ?? '';
      expect(faintest).toMatch(/^#[0-9a-fA-F]{6}$/);
      const ratio = contrast(faintest, DARK_BG);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_TERTIARY);
    });

    it('--text2 already meets WCAG AA (4.5:1) on the dark background (regression)', () => {
      const vars = darkModeVars();
      const text2 = vars.get('--text2') ?? '';
      expect(text2).toMatch(/^#[0-9a-fA-F]{6}$/);
      const ratio = contrast(text2, DARK_BG);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA);
    });
  });

  describe('Hardcoded chart tick colours in source files', () => {
    it('App.tsx does not use the old low-contrast dark tick colour "#6A6A72"', () => {
      const src = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
      expect(src).not.toContain('"#6A6A72"');
    });

    it('BudgetView.tsx does not use the old low-contrast dark tick colour "#6A6A72"', () => {
      const src = readFileSync(
        resolve(process.cwd(), 'src/components/views/BudgetView.tsx'),
        'utf-8',
      );
      expect(src).not.toContain('"#6A6A72"');
    });
  });
});
