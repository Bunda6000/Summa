/**
 * Portable storage layer.
 * Uses Capacitor Preferences when available (Android/iOS),
 * falls back to localStorage for web/dev.
 */

import type { Preferences as CapPreferences } from '@capacitor/preferences';

type PreferencesPlugin = typeof CapPreferences;

let preferences: PreferencesPlugin | false | null = null;

async function initPreferences(): Promise<void> {
  if (preferences !== null) return;
  try {
    const mod = await import('@capacitor/preferences');
    preferences = mod.Preferences;
  } catch {
    preferences = false; // not available, use localStorage
  }
}

export async function loadStore<T>(key: string, fallback: T): Promise<T> {
  await initPreferences();
  try {
    if (preferences) {
      const { value } = await preferences.get({ key });
      return value ? (JSON.parse(value) as T) : fallback;
    } else {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    }
  } catch {
    return fallback;
  }
}

export async function saveStore<T>(key: string, val: T): Promise<void> {
  await initPreferences();
  const str = JSON.stringify(val);
  try {
    if (preferences) {
      await preferences.set({ key, value: str });
    } else {
      localStorage.setItem(key, str);
    }
  } catch (e) {
    console.warn('Storage write failed:', e);
  }
}

export async function removeStore(key: string): Promise<void> {
  await initPreferences();
  try {
    if (preferences) {
      await preferences.remove({ key });
    } else {
      localStorage.removeItem(key);
    }
  } catch {}
}
