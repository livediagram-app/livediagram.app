import { describe, expect, it } from 'vitest';
import { ALL_SETTING_KEYS } from '@liveworkspace/settings';
import { APP_SITES } from '@liveworkspace/sites';
import { SETTINGS_PARAM } from './explorer/host';
import {
  ACCESSIBILITY_ROWS,
  appSettingsLinks,
  EDITOR_ONLY_KEYS,
  IN_APP_ROWS,
  NOTIFICATION_ROWS,
  PRIVACY_ROWS,
  readToggle,
  uncatalogued,
} from './account-settings';

const rows = [...NOTIFICATION_ROWS, ...IN_APP_ROWS, ...PRIVACY_ROWS, ...ACCESSIBILITY_ROWS];

describe('the settings catalogue', () => {
  it('shows every shared key but the editors’ chrome, once each', () => {
    expect(uncatalogued()).toEqual([]);
    const keys = rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(ALL_SETTING_KEYS).toContain(key);
    for (const key of EDITOR_ONLY_KEYS) expect(keys).not.toContain(key);
  });

  it('has every email and notification switch, and privacy and accessibility', () => {
    const notify = ALL_SETTING_KEYS.filter((k) => k.startsWith('notif'));
    const notifications = [...NOTIFICATION_ROWS, ...IN_APP_ROWS];
    expect(notifications.map((r) => r.key).sort()).toEqual([...notify].sort());
    expect([...PRIVACY_ROWS, ...ACCESSIBILITY_ROWS].map((r) => r.key)).toEqual([
      'telemetryEnabled',
      'reduceMotion',
    ]);
  });

  it('reads an unset switch as the apps do', () => {
    const tips = rows.find((r) => r.key === 'notifyTips')!;
    const motion = rows.find((r) => r.key === 'reduceMotion')!;
    expect(readToggle({}, tips)).toBe(true);
    expect(readToggle({ notifyTips: false }, tips)).toBe(false);
    expect(readToggle({ notifyTips: 'nonsense' }, tips)).toBe(true);
    expect(readToggle({}, motion)).toBe(false);
    expect(readToggle({ reduceMotion: true }, motion)).toBe(true);
  });

  it('labels and explains every switch', () => {
    for (const row of rows) {
      expect(row.label.length, row.key).toBeGreaterThan(3);
      expect(row.description, row.key).toMatch(/\.$/);
    }
  });
});

describe('each app’s own settings', () => {
  it('links to every app, at its Explorer Home', () => {
    const links = appSettingsLinks();
    expect(links.map((l) => l.id)).toEqual(APP_SITES.map((s) => s.id));
    for (const link of links) expect(link.href).toMatch(/^https?:\/\/[^/]+\/explorer\/home$/);
  });

  it('never links to a Settings deep link, which the Explorer sends straight back here', () => {
    for (const link of appSettingsLinks()) {
      const url = new URL(link.href);
      expect(url.searchParams.has(SETTINGS_PARAM)).toBe(false);
    }
  });
});
