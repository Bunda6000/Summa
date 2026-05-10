import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export const SUPPORT_EMAIL = 'support@budgetplanner.app';

export interface SupportMeta {
  appVersion: string;
  platform: string;
  os: string;
  screen: string;
}

function parseOS(ua: string): string {
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/mac os x/i.test(ua)) return 'macOS';
  if (/windows/i.test(ua)) return 'Windows';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Unknown';
}

export async function getSupportMeta(): Promise<SupportMeta> {
  let appVersion = '1.0.0';
  try {
    const info = await App.getInfo();
    appVersion = info.version;
  } catch {
    // Web context or test environment — App plugin unavailable
  }

  return {
    appVersion,
    platform: Capacitor.getPlatform(),
    os: parseOS(navigator.userAgent),
    screen: `${window.screen.width}x${window.screen.height}`,
  };
}

export function buildMailtoHref(meta: SupportMeta, type: 'general' | 'billing'): string {
  const subject = type === 'billing' ? 'Billing Support Request' : 'Support Request';
  const prompt =
    type === 'billing'
      ? 'Hi, I have a billing question:\n\n[Describe your billing issue here]\n\n'
      : 'Hi, I need help with:\n\n[Describe your issue here]\n\n';

  const body = [
    prompt,
    '---',
    `App Version: ${meta.appVersion}`,
    `Platform: ${meta.platform}`,
    `OS: ${meta.os}`,
    `Screen: ${meta.screen}`,
    '---',
  ].join('\n');

  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
