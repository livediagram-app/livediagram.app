import { describe, expect, it } from 'vitest';
import {
  ALL_SETTING_KEYS,
  COMMON_SETTING_KEYS,
  isAllSetting,
  isAllSettingRow,
  isCommonSetting,
  joinSettings,
  settingKeyOfRow,
  splitSettings,
} from './index';

describe('settings scopes', () => {
  it('splits shared keys into all and the rest into the app', () => {
    expect(splitSettings({ reduceMotion: true, tourSeen: true, notifyTips: false })).toEqual({
      all: { reduceMotion: true, notifyTips: false },
      app: { tourSeen: true },
    });
  });

  it('joins the scopes back, a shared key coming only from all', () => {
    expect(
      joinSettings(
        { reduceMotion: true, tourSeen: 'stray' },
        { reduceMotion: false, tourSeen: true },
      ),
    ).toEqual({ reduceMotion: true, tourSeen: true });
  });

  it('round-trips', () => {
    const prefs = { telemetryEnabled: false, tourSeen: true, customSwatches: ['#fff'] };
    const { all, app } = splitSettings(prefs);
    expect(joinSettings(all, app)).toEqual(prefs);
  });

  it('lists each key once, and knows them', () => {
    expect(new Set(ALL_SETTING_KEYS).size).toBe(ALL_SETTING_KEYS.length);
    expect(isAllSetting('notifyTips')).toBe(true);
    expect(isAllSetting('tourSeen')).toBe(false);
    expect(isAllSetting('notifyDocumentJoin')).toBe(false);
  });
});

// The editor settings two or more apps have moved from each app's scope to `all` (accounts.md "Common settings").
describe('common settings', () => {
  it('are shared, and only shared ones', () => {
    for (const key of COMMON_SETTING_KEYS) {
      expect(isAllSetting(key)).toBe(true);
      expect(isCommonSetting(key)).toBe(true);
    }
    expect(isCommonSetting('reduceMotion')).toBe(false);
    expect(isCommonSetting('tourSeen')).toBe(false);
  });

  it("keeps a value set before the move: all has none, so the app's copy counts", () => {
    expect(
      joinSettings(
        { reduceMotion: true },
        { showMinimap: false, presentation: { loop: true }, tourSeen: true },
      ),
    ).toEqual({
      reduceMotion: true,
      showMinimap: false,
      presentation: { loop: true },
      tourSeen: true,
    });
  });

  it('takes all over the old copy once all has one', () => {
    expect(joinSettings({ showMinimap: true }, { showMinimap: false })).toEqual({
      showMinimap: true,
    });
  });

  it("never lets an app's copy of an older shared key win, even with all empty", () => {
    expect(joinSettings({}, { reduceMotion: true })).toEqual({});
  });

  it("writes a common setting to all and deletes the app's old copy", () => {
    expect(splitSettings({ mapSize: 'large', tourSeen: true })).toEqual({
      all: { mapSize: 'large' },
      app: { mapSize: null, tourSeen: true },
    });
    // A reset (deleting the key) deletes both, so the old copy can't come back.
    expect(splitSettings({ presentation: null })).toEqual({
      all: { presentation: null },
      app: { presentation: null },
    });
  });

  it('round-trips through a write and a read', () => {
    // As the accounts Worker applies a patch: a key set to null is deleted.
    const apply = (stored: Record<string, unknown>, patch: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries({ ...stored, ...patch }).filter(([, value]) => value !== null),
      );
    const stored = { all: {}, app: { showMinimap: false, homeBanner: false } };
    expect(joinSettings(stored.all, stored.app)).toEqual({
      showMinimap: false,
      homeBanner: false,
    });
    const patch = splitSettings({ showMinimap: true });
    const next = { all: apply(stored.all, patch.all), app: apply(stored.app, patch.app) };
    expect(next).toEqual({ all: { showMinimap: true }, app: { homeBanner: false } });
    expect(joinSettings(next.all, next.app)).toEqual({ showMinimap: true, homeBanner: false });
  });
});

describe('settingKeyOfRow', () => {
  it('names the preference a row stands for', () => {
    expect(settingKeyOfRow('uiScale-panels')).toBe('uiScalePanels');
    expect(settingKeyOfRow('uiScale-cornerButtons')).toBe('uiScaleCornerButtons');
    expect(settingKeyOfRow('presentation-loop')).toBe('presentation');
    expect(settingKeyOfRow('presentationAutoAdvance')).toBe('presentation');
    expect(settingKeyOfRow('showMinimap')).toBe('showMinimap');
    expect(isAllSettingRow('presentation-transition')).toBe(true);
    expect(isAllSettingRow('uiScale-toolbar')).toBe(true);
    expect(isAllSettingRow('notifyDocumentJoin')).toBe(false);
  });
});
