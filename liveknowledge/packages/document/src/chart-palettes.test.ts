import { describe, expect, it } from 'vitest';
import { CHART_PALETTES, chartPaletteColors, chartRamp, isChartPaletteId } from './chart-palettes';
import { createShape, PIE_PALETTE } from './index';
import { svgLegendShape } from './svg-render-shapes';

// Palette ids are stored on elements, so they are permanent, and an absent or
// unknown one must fall THROUGH rather than resolve to something: a chart with
// no palette follows the tab theme, exactly as every chart did before this
// existed, so nothing already on a canvas changes appearance.

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

// docs/specs/009-elements/pie-chart.md "Legend": a legend dropped beside a chart matches it, so both take the same
// ladder: their own palette, then the tab theme's ramp, then the built-in one.
describe('chartRamp', () => {
  const theme = ['#111111', '#222222'];

  it('takes the element palette, then the theme ramp, then the built-in ramp', () => {
    expect(chartRamp('ocean', theme)).toBe(chartPaletteColors('ocean'));
    expect(chartRamp(undefined, theme)).toBe(theme);
    expect(chartRamp(undefined, [])).toBe(PIE_PALETTE);
    expect(chartRamp(undefined, undefined)).toBe(PIE_PALETTE);
  });

  it('colours an exported legend from the theme ramp, as the chart beside it is', () => {
    const legend = createShape('legend', 0, 0);
    expect(svgLegendShape(legend, '#fff', '#000', '#000', theme)).toContain('#111111');
  });
});
