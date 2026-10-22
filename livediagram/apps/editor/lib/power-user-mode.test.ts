import { describe, expect, it } from 'vitest';
import {
  POWER_USER_PRESET,
  isMinimalChrome,
  isPowerUserMode,
  setPowerUserMode,
} from './power-user-mode';
import type { UserPreferences } from './user-preferences';

// Power user mode (docs/specs/007-editor/power-user-mode.md): a preset applied once on
// switch-on, and a switch-off that restores only the settings left untouched.

const on = (prefs: UserPreferences) => setPowerUserMode(prefs, true).prefs;
const off = (prefs: UserPreferences) => setPowerUserMode(prefs, false);

describe('setPowerUserMode on', () => {
  it('writes every recommended value and marks the mode on', () => {
    const next = on({ aiSuggestedPrompts: true, panelOpacity: 0.6 });
    expect(next).toMatchObject({
      powerUserMode: true,
      alignmentGuides: true,
      autoRebindArrows: true,
      tourSeen: true,
      aiSuggestedPrompts: false,
      minimalChrome: true,
    });
  });

  it('leaves panel opacity and unrelated settings alone', () => {
    const next = on({ panelOpacity: 0.6, telemetryEnabled: false, customSwatches: ['#fff'] });
    expect(next.panelOpacity).toBe(0.6);
    expect(next.telemetryEnabled).toBe(false);
    expect(next.customSwatches).toEqual(['#fff']);
  });

  it('records the values before and after, per preset setting', () => {
    const next = on({ alignmentGuides: false });
    expect(next.powerUserBaseline?.alignmentGuides).toEqual({
      before: { alignmentGuides: false },
      applied: { alignmentGuides: true },
    });
    // An absent key stays absent in `before`, so restoring can delete it.
    expect(next.powerUserBaseline?.tourSeen).toEqual({ before: {}, applied: { tourSeen: true } });
    expect(Object.keys(next.powerUserBaseline ?? {}).sort()).toEqual(
      Object.keys(POWER_USER_PRESET).sort(),
    );
  });

  it('does nothing when the mode is already on', () => {
    const once = on({ alignmentGuides: false });
    const changed = { ...once, alignmentGuides: false };
    expect(setPowerUserMode(changed, true).prefs).toBe(changed);
  });
});

describe('setPowerUserMode off', () => {
  it('restores every setting the user did not touch', () => {
    const before: UserPreferences = {
      alignmentGuides: false,
      aiSuggestedPrompts: true,
      tourSeen: false,
    };
    const { prefs, restored, kept } = off(on(before));
    expect(prefs).toEqual(before);
    expect(kept).toEqual([]);
    expect(restored.sort()).toEqual(Object.keys(POWER_USER_PRESET).sort());
  });

  it('deletes keys that were never set, rather than writing them', () => {
    const { prefs } = off(on({}));
    expect(prefs).toEqual({});
  });

  it('keeps a setting the user changed while the mode was on', () => {
    const changed = {
      ...on({ alignmentGuides: false, aiSuggestedPrompts: true }),
      aiSuggestedPrompts: true,
    };
    const { prefs, kept, restored } = off(changed);
    expect(prefs.aiSuggestedPrompts).toBe(true);
    expect(kept).toEqual(['aiSuggestedPrompts']);
    // The untouched one still goes back.
    expect(prefs.alignmentGuides).toBe(false);
    expect(restored).toContain('alignmentGuides');
  });

  it('treats a setting changed and changed back as untouched', () => {
    const roundTrip = { ...on({ alignmentGuides: false }), alignmentGuides: false };
    const back = { ...roundTrip, alignmentGuides: true };
    expect(off(back).prefs.alignmentGuides).toBe(false);
  });

  it('clears the mode and its baseline', () => {
    const { prefs } = off(on({ telemetryEnabled: false }));
    expect(prefs.powerUserMode).toBeUndefined();
    expect(prefs.powerUserBaseline).toBeUndefined();
    expect(prefs.telemetryEnabled).toBe(false);
  });

  it('only clears the flag when there is no baseline', () => {
    const { prefs, restored, kept } = off({ powerUserMode: true, alignmentGuides: true });
    expect(prefs).toEqual({ alignmentGuides: true });
    expect(restored).toEqual([]);
    expect(kept).toEqual([]);
  });

  it('does nothing when the mode is already off', () => {
    const prefs: UserPreferences = { alignmentGuides: false };
    expect(off(prefs).prefs).toBe(prefs);
  });

  it('survives the JSON round trip the preferences blob takes', () => {
    const before: UserPreferences = { alignmentGuides: false, aiSuggestedPrompts: true };
    const stored = JSON.parse(JSON.stringify(on(before))) as UserPreferences;
    expect(off(stored).prefs).toEqual(before);
  });

  it('restores a baseline entry it does not know, by the same rule', () => {
    const prefs: UserPreferences = {
      powerUserMode: true,
      powerUserBaseline: {
        futureSetting: { before: {}, applied: { quickAddOnHover: true } },
      },
      quickAddOnHover: true,
    };
    expect(off(prefs).prefs).toEqual({});
  });
});

describe('isPowerUserMode / isMinimalChrome', () => {
  it('reads the mode off only an explicit true', () => {
    expect(isPowerUserMode({})).toBe(false);
    expect(isPowerUserMode({ powerUserMode: true })).toBe(true);
  });

  it('honours Minimal chrome only while the mode is on', () => {
    expect(isMinimalChrome({ minimalChrome: true })).toBe(false);
    expect(isMinimalChrome({ powerUserMode: true })).toBe(true);
    expect(isMinimalChrome({ powerUserMode: true, minimalChrome: false })).toBe(false);
    expect(isMinimalChrome(on({}))).toBe(true);
  });
});
