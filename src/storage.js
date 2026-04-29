/**
 * Portable storage layer.
 * Uses Capacitor Preferences when available (Android/iOS),
 * falls back to localStorage for web/dev.
 */

let preferences = null;

async function initPreferences() {
  if (preferences !== null) return;
  try {
    const mod = await import('@capacitor/preferences');
    preferences = mod.Preferences;
  } catch {
    preferences = false; // not available, use localStorage
  }
}

export async function loadStore(key, fallback) {
  await initPreferences();
  try {
    if (preferences) {
      const { value } = await preferences.get({ key });
      return value ? JSON.parse(value) : fallback;
    } else {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }
  } catch {
    return fallback;
  }
}

export async function saveStore(key, val) {
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

export async function removeStore(key) {
  await initPreferences();
  try {
    if (preferences) {
      await preferences.remove({ key });
    } else {
      localStorage.removeItem(key);
    }
  } catch {}
}
