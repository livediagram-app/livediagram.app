import { describe, expect, it } from 'vitest';
import { ALL_SETTING_KEYS, isAllSetting, joinSettings, splitSettings } from './index';

describe('settings scopes', () => {
  it('splits shared keys into all and the rest into the app', () => {
    expect(splitSettings({ reduceMotion: true, mapSize: 'large', notifyTips: false })).toEqual({
      all: { reduceMotion: true, notifyTips: false },
      app: { mapSize: 'large' },
    });
  });

  it('joins the scopes back, a shared key coming only from all', () => {
    expect(
      joinSettings(
        { reduceMotion: true, mapSize: 'stray' },
        { reduceMotion: false, mapSize: 'small' },
      ),
    ).toEqual({ reduceMotion: true, mapSize: 'small' });
  });

  it('round-trips', () => {
    const prefs = { telemetryEnabled: false, homeBanner: false, customSwatches: ['#fff'] };
    const { all, app } = splitSettings(prefs);
    expect(joinSettings(all, app)).toEqual(prefs);
  });

  it('lists each key once, and knows them', () => {
    expect(new Set(ALL_SETTING_KEYS).size).toBe(ALL_SETTING_KEYS.length);
    expect(isAllSetting('notifyTips')).toBe(true);
    expect(isAllSetting('mapSize')).toBe(false);
  });
});
