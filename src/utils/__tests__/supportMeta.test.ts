import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: vi.fn(() => 'web'),
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    getInfo: vi.fn(),
  },
}));

import { getSupportMeta, buildMailtoHref, SUPPORT_EMAIL } from '../supportMeta';
import { App } from '@capacitor/app';

const mockGetInfo = vi.mocked(App.getInfo);

const fakeAppInfo = { version: '1.0.0', build: '1', name: 'Budget Planner', id: 'com.budgetplanner.app' };

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'screen', {
    value: { width: 390, height: 844 },
    writable: true,
    configurable: true,
  });
});

describe('getSupportMeta', () => {
  it('returns expected metadata shape', async () => {
    mockGetInfo.mockResolvedValue(fakeAppInfo as never);
    const meta = await getSupportMeta();
    expect(meta).toHaveProperty('appVersion');
    expect(meta).toHaveProperty('platform');
    expect(meta).toHaveProperty('os');
    expect(meta).toHaveProperty('screen');
  });

  it('includes app version from Capacitor', async () => {
    mockGetInfo.mockResolvedValue({ ...fakeAppInfo, version: '2.5.1' } as never);
    const meta = await getSupportMeta();
    expect(meta.appVersion).toBe('2.5.1');
  });

  it('falls back to 1.0.0 when getInfo throws', async () => {
    mockGetInfo.mockRejectedValue(new Error('not native'));
    const meta = await getSupportMeta();
    expect(meta.appVersion).toBe('1.0.0');
  });

  it('includes screen dimensions', async () => {
    mockGetInfo.mockResolvedValue(fakeAppInfo as never);
    const meta = await getSupportMeta();
    expect(meta.screen).toBe('390x844');
  });

  it('does not include email, password, token, or financial data', async () => {
    mockGetInfo.mockResolvedValue(fakeAppInfo as never);
    const meta = await getSupportMeta();
    const keys = Object.keys(meta).join(',').toLowerCase();
    expect(keys).not.toMatch(/email|password|token|credit|card|financial/);
    const values = JSON.stringify(meta).toLowerCase();
    expect(values).not.toMatch(/password|token|credit|card/);
  });

  it('includes platform from Capacitor', async () => {
    mockGetInfo.mockResolvedValue(fakeAppInfo as never);
    const meta = await getSupportMeta();
    expect(meta.platform).toBe('web');
  });
});

describe('buildMailtoHref', () => {
  const meta = { appVersion: '1.0.0', platform: 'web', os: 'macOS', screen: '1440x900' };

  it('produces a valid mailto URL starting with mailto:', () => {
    const href = buildMailtoHref(meta, 'general');
    expect(href).toMatch(/^mailto:/);
  });

  it('targets SUPPORT_EMAIL', () => {
    const href = buildMailtoHref(meta, 'general');
    expect(href).toContain(SUPPORT_EMAIL);
  });

  it('uses billing subject for billing type', () => {
    const href = buildMailtoHref(meta, 'billing');
    expect(decodeURIComponent(href)).toMatch(/billing/i);
  });

  it('uses general support subject for general type', () => {
    const href = buildMailtoHref(meta, 'general');
    expect(decodeURIComponent(href)).toMatch(/support request/i);
  });

  it('encodes app version in body', () => {
    const href = buildMailtoHref({ ...meta, appVersion: '3.1.4' }, 'general');
    expect(decodeURIComponent(href)).toContain('3.1.4');
  });

  it('encodes platform in body', () => {
    const href = buildMailtoHref({ ...meta, platform: 'android' }, 'general');
    expect(decodeURIComponent(href)).toContain('android');
  });

  it('does not encode email or financial data in body', () => {
    const href = buildMailtoHref(meta, 'general');
    const decoded = decodeURIComponent(href).toLowerCase();
    expect(decoded).not.toMatch(/password|credit.card|bank.account/);
  });
});
