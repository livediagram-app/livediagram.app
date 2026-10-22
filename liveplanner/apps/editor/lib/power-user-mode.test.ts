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
    const next = on({ formTourSeen: false, panelOpacity: 0.6 });
    expect(next).toMatchObject({
      powerUserMode: true,
      planTourSeen: true,
      formTourSeen: true,
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
    const next = on({ formTourSeen: false });
    expect(next.powerUserBaseline?.formTourSeen).toEqual({
      before: { formTourSeen: false },
      applied: { formTourSeen: true },
    });
    // An absent key stays absent in `before`, so restoring can delete it.
    expect(next.powerUserBaseline?.planTourSeen).toEqual({
      before: {},
      applied: { planTourSeen: true },
    });
    expect(Object.keys(next.powerUserBaseline ?? {}).sort()).toEqual(
      Object.keys(POWER_USER_PRESET).sort(),
    );
  });

  it('does nothing when the mode is already on', () => {
    const once = on({ formTourSeen: false });
    const changed = { ...once, formTourSeen: false };
    expect(setPowerUserMode(changed, true).prefs).toBe(changed);
  });
});

describe('setPowerUserMode off', () => {
  it('restores every setting the user did not touch', () => {
    const before: UserPreferences = {
      formTourSeen: false,
      minimalChrome: false,
      planTourSeen: false,
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
      ...on({ formTourSeen: false, planTourSeen: false }),
      planTourSeen: false,
    };
    const { prefs, kept, restored } = off(changed);
    expect(prefs.planTourSeen).toBe(false);
    expect(kept).toEqual(['planTourSeen']);
    // The untouched one still goes back.
    expect(prefs.formTourSeen).toBe(false);
    expect(restored).toContain('formTourSeen');
  });

  it('treats a setting changed and changed back as untouched', () => {
    const roundTrip = { ...on({ formTourSeen: false }), formTourSeen: false };
    const back = { ...roundTrip, formTourSeen: true };
    expect(off(back).prefs.formTourSeen).toBe(false);
  });

  it('clears the mode and its baseline', () => {
    const { prefs } = off(on({ telemetryEnabled: false }));
    expect(prefs.powerUserMode).toBeUndefined();
    expect(prefs.powerUserBaseline).toBeUndefined();
    expect(prefs.telemetryEnabled).toBe(false);
  });

  it('only clears the flag when there is no baseline', () => {
    const { prefs, restored, kept } = off({ powerUserMode: true, formTourSeen: true });
    expect(prefs).toEqual({ formTourSeen: true });
    expect(restored).toEqual([]);
    expect(kept).toEqual([]);
  });

  it('does nothing when the mode is already off', () => {
    const prefs: UserPreferences = { formTourSeen: false };
    expect(off(prefs).prefs).toBe(prefs);
  });

  it('survives the JSON round trip the preferences blob takes', () => {
    const before: UserPreferences = { formTourSeen: false, minimalChrome: false };
    const stored = JSON.parse(JSON.stringify(on(before))) as UserPreferences;
    expect(off(stored).prefs).toEqual(before);
  });

  it('restores a baseline entry it does not know, by the same rule', () => {
    const prefs: UserPreferences = {
      powerUserMode: true,
      powerUserBaseline: {
        futureSetting: { before: {}, applied: { homeBanner: false } },
      },
      homeBanner: false,
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
