import { describe, expect, it } from 'vitest';
import { CHART_PALETTES, chartPaletteColors, isChartPaletteId } from './chart-palettes';

// Palette ids are stored on elements, so they are permanent, and an absent or
// unknown one must fall THROUGH rather than resolve to something: a chart with
// no palette follows the tab theme, exactly as every chart did before this
// existed, so nothing already on a board changes appearance.

describe('chart palettes', () => {
  it('gives every palette a full run of colours', () => {
    for (const palette of CHART_PALETTES) {
      expect(palette.colors.length).toBeGreaterThanOrEqual(4);
      for (const color of palette.colors) expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(palette.name.length).toBeGreaterThan(0);
    }
  });

  it('has unique ids, and no repeated colour inside a palette', () => {
    expect(new Set(CHART_PALETTES.map((p) => p.id)).size).toBe(CHART_PALETTES.length);
    for (const palette of CHART_PALETTES) {
      // Two series the same colour is the one thing a categorical ramp
      // must never do.
      const lower = palette.colors.map((c) => c.toLowerCase());
      expect(new Set(lower).size).toBe(lower.length);
    }
  });

  it('returns undefined for an absent or unknown id, so the theme still wins', () => {
    expect(chartPaletteColors(undefined)).toBeUndefined();
    expect(chartPaletteColors('nonsense')).toBeUndefined();
  });

  it('resolves every id it ships', () => {
    for (const palette of CHART_PALETTES) {
      expect(chartPaletteColors(palette.id)).toEqual(palette.colors);
      expect(isChartPaletteId(palette.id)).toBe(true);
    }
    expect(isChartPaletteId('nonsense')).toBe(false);
  });
});
