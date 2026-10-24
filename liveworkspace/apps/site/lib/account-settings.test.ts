import { describe, expect, it } from 'vitest';
import { ALL_SETTING_KEYS, PRESENCE_COLOURS as SHARED_PALETTE } from '@liveworkspace/settings';
import { APP_SITES } from '@liveworkspace/sites';
import { settingsTarget } from './explorer/host';
import {
  appSettingsLinks,
  cleanName,
  colourName,
  EDITOR_ONLY_KEYS,
  PRESENCE_COLOURS,
  readToggle,
  TOGGLE_SECTIONS,
  uncatalogued,
} from './account-settings';

const rows = TOGGLE_SECTIONS.flatMap((s) => s.rows);

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
    const notifications = TOGGLE_SECTIONS.find((s) => s.id === 'notifications')!.rows;
    expect(notifications.map((r) => r.key).sort()).toEqual([...notify].sort());
    const privacy = TOGGLE_SECTIONS.find((s) => s.id === 'privacy')!.rows;
    expect(privacy.map((r) => r.key)).toEqual(['telemetryEnabled', 'reduceMotion']);
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

describe('the profile', () => {
  it('offers the apps’ shared palette, ten colours', () => {
    expect(PRESENCE_COLOURS).toBe(SHARED_PALETTE);
    expect(PRESENCE_COLOURS).toHaveLength(10);
  });

  it('names a colour, or says it is the app’s pick or set elsewhere', () => {
    expect(colourName(null)).toBe('Automatic');
    expect(colourName('#0EA5E9')).toBe('Sky');
    expect(colourName('rebeccapurple')).toBe('Custom');
  });

  it('stores a name trimmed, and an empty one as none', () => {
    expect(cleanName('  Ada Lovelace ')).toBe('Ada Lovelace');
    expect(cleanName('   ')).toBeNull();
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
      expect(url.searchParams.has('settings')).toBe(false);
      expect(settingsTarget(url.search, 'livediagram')).toBeNull();
    }
  });
});
