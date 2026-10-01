import { describe, expect, it } from 'vitest';
import {
  UI_SCALE_DEFAULT,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  resolveUiScale,
  toSurfacePx,
  uiScaleStyle,
} from './ui-scale';
import type { UserPreferences } from './user-preferences';

// UI scale (docs/specs/007-editor/ui-scale.md "The setting").

const desktop = (uiScale: unknown) =>
  resolveUiScale({ uiScale } as UserPreferences, { mobile: false });

describe('resolveUiScale', () => {
  it('defaults to 100% when unset', () => {
    expect(resolveUiScale({}, { mobile: false })).toBe(UI_SCALE_DEFAULT);
  });

  it('keeps an in-range stepped value', () => {
    expect(desktop(1.25)).toBe(1.25);
    expect(desktop(0.8)).toBe(0.8);
    expect(desktop(1.5)).toBe(1.5);
  });

  it('reads junk as 100%', () => {
    for (const junk of ['1.2', NaN, Infinity, null, true, {}]) {
      expect(desktop(junk)).toBe(UI_SCALE_DEFAULT);
    }
  });

  it('clamps out-of-range values', () => {
    expect(desktop(3)).toBe(UI_SCALE_MAX);
    expect(desktop(0.2)).toBe(UI_SCALE_MIN);
  });

  it('snaps to the nearest 5% step without float noise', () => {
    expect(desktop(1.13)).toBe(1.15);
    expect(desktop(1.1500000000000001)).toBe(1.15);
    expect(desktop(0.96)).toBe(0.95);
  });

  it('always draws a phone at 100%', () => {
    expect(resolveUiScale({ uiScale: 1.5 }, { mobile: true })).toBe(UI_SCALE_DEFAULT);
  });
});

describe('uiScaleStyle', () => {
  it('leaves an unscaled surface untouched', () => {
    expect(uiScaleStyle(1)).toBeUndefined();
  });

  it('zooms a scaled one', () => {
    expect(uiScaleStyle(1.25)).toEqual({ zoom: 1.25 });
  });
});

describe('toSurfacePx', () => {
  it('converts screen px to px inside the zoomed surface', () => {
    expect(toSurfacePx(300, 1.5)).toBe(200);
    expect(toSurfacePx(16, 1)).toBe(16);
  });
});
