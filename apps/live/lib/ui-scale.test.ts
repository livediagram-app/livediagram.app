import { describe, expect, it } from 'vitest';
import {
  UI_SCALE_DEFAULT,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  UI_SCALE_TOOLBAR_BASE,
  UI_SCALE_TOOLBAR_MAX,
  resolveUiScale,
  resolveUiScalePart,
  resolveUiScales,
  toSurfacePx,
  uiScalePartPatch,
  uiScalePatch,
  uiScaleMax,
  uiScaleStyle,
  uiUnscaleStyle,
  withUiScalePatch,
} from './ui-scale';
import type { UserPreferences } from './user-preferences';

// UI scale (docs/specs/007-editor/ui-scale.md "The setting").

const master = (uiScale: unknown) => resolveUiScale({ uiScale } as UserPreferences);
const desktop = (prefs: UserPreferences) => resolveUiScales(prefs, { mobile: false });

describe('resolveUiScale', () => {
  it('defaults to 100% when unset', () => {
    expect(resolveUiScale({})).toBe(UI_SCALE_DEFAULT);
  });

  it('runs 80% to 120%, with 100% in the middle of the slider', () => {
    expect(UI_SCALE_MIN).toBe(0.8);
    expect(UI_SCALE_MAX).toBe(1.2);
    expect((UI_SCALE_MIN + UI_SCALE_MAX) / 2).toBe(UI_SCALE_DEFAULT);
  });

  it('keeps an in-range stepped value', () => {
    expect(master(0.8)).toBe(0.8);
    expect(master(1.15)).toBe(1.15);
    expect(master(1.2)).toBe(1.2);
  });

  it('reads junk as 100%', () => {
    for (const junk of ['1.2', NaN, Infinity, null, true, {}]) {
      expect(master(junk)).toBe(UI_SCALE_DEFAULT);
    }
  });

  it('clamps out-of-range values', () => {
    expect(master(3)).toBe(UI_SCALE_MAX);
    expect(master(0.2)).toBe(UI_SCALE_MIN);
  });

  it('snaps to the nearest 5% step without float noise', () => {
    expect(master(1.13)).toBe(1.15);
    expect(master(1.1500000000000001)).toBe(1.15);
    expect(master(0.96)).toBe(0.95);
  });
});

describe('resolveUiScales', () => {
  it('gives every part the master scale', () => {
    expect(desktop({ uiScale: 0.9 })).toEqual({ panels: 0.9, toolbar: 1.03, cornerButtons: 0.9 });
  });

  it("draws the toolbar's 100% at what was 115%", () => {
    expect(UI_SCALE_TOOLBAR_BASE).toBe(1.15);
    expect(desktop({}).toolbar).toBe(1.15);
    // The slider still reads 100%.
    expect(resolveUiScalePart({}, 'toolbar')).toBe(1);
  });

  it('runs the toolbar up to 140%, the master and the other parts to 120%', () => {
    expect(UI_SCALE_TOOLBAR_MAX).toBe(1.4);
    expect(uiScaleMax('toolbar')).toBe(1.4);
    expect(uiScaleMax()).toBe(UI_SCALE_MAX);
    expect(uiScaleMax('panels')).toBe(UI_SCALE_MAX);
    expect(resolveUiScalePart({ uiScaleToolbar: 1.4 }, 'toolbar')).toBe(1.4);
    expect(resolveUiScalePart({ uiScaleToolbar: 3 }, 'toolbar')).toBe(1.4);
    expect(resolveUiScalePart({ uiScalePanels: 1.4 }, 'panels')).toBe(1.2);
    expect(desktop({ uiScaleToolbar: 1.4 }).toolbar).toBe(1.61);
  });

  it("lets a part's own value override the master for that part alone", () => {
    expect(desktop({ uiScale: 0.9, uiScaleToolbar: 1.2 })).toEqual({
      panels: 0.9,
      toolbar: 1.38,
      cornerButtons: 0.9,
    });
  });

  it('resolves a junk part value as 100%, not as the master', () => {
    expect(desktop({ uiScale: 0.9, uiScalePanels: NaN }).panels).toBe(1);
  });

  it('always draws a phone at 100%', () => {
    expect(resolveUiScales({ uiScale: 1.2, uiScaleToolbar: 0.8 }, { mobile: true })).toEqual({
      panels: 1,
      toolbar: 1,
      cornerButtons: 1,
    });
  });
});

describe('writing', () => {
  it('the master sets everything, clearing each part', () => {
    const prefs: UserPreferences = { uiScale: 1, uiScaleToolbar: 1.2, uiScalePanels: 0.8 };
    const next = withUiScalePatch(prefs, uiScalePatch(0.9));
    expect(next).toEqual({ uiScale: 0.9 });
    expect(desktop(next)).toEqual({ panels: 0.9, toolbar: 1.03, cornerButtons: 0.9 });
  });

  it('a part writes only its own value', () => {
    const next = withUiScalePatch({ uiScale: 0.9 }, uiScalePartPatch('cornerButtons', 1.1));
    expect(next).toEqual({ uiScale: 0.9, uiScaleCornerButtons: 1.1 });
  });
});

describe('uiScaleStyle', () => {
  it('leaves an unscaled surface untouched', () => {
    expect(uiScaleStyle(1)).toBeUndefined();
  });

  it('zooms a scaled one', () => {
    expect(uiScaleStyle(1.15)).toEqual({ zoom: 1.15 });
  });
});

describe('uiUnscaleStyle', () => {
  it('leaves a menu in an unscaled surface untouched', () => {
    expect(uiUnscaleStyle(1)).toBeUndefined();
  });

  it('cancels the surface zoom, so the menu draws at design size', () => {
    for (const scale of [0.8, 1.2]) {
      const zoom = uiUnscaleStyle(scale)?.zoom as number;
      expect(zoom * scale).toBeCloseTo(1);
    }
  });
});

describe('toSurfacePx', () => {
  it('converts screen px to px inside the zoomed surface', () => {
    expect(toSurfacePx(300, 1.5)).toBe(200);
    expect(toSurfacePx(16, 1)).toBe(16);
  });
});
