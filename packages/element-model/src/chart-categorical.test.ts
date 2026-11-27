import { describe, expect, it } from 'vitest';
import { chartCategorical, chartDeltaE, chartPaletteFailures } from './chart-categorical';
import { canvasSurface } from './colour-math';
import { themeChartPalette } from './theme-presets';
import { BOARD_THEMES, THEMES } from './themes-data';

// Every theme's chart colours tell apart for every reader (docs/specs/009-elements/pie-chart.md "Chart palettes"):
// the dataviz validator's hard gates, on the theme's own surface.
describe('chart categorical colours', () => {
  for (const theme of [...THEMES, ...BOARD_THEMES]) {
    it(`${theme.id}: passes every gate with at least five colours, its lead first`, () => {
      const palette = themeChartPalette(theme);
      expect(chartPaletteFailures(palette, canvasSurface(theme.backgroundColor))).toEqual([]);
      expect(palette.length).toBeGreaterThanOrEqual(5);
      expect(new Set(palette).size).toBe(palette.length);
    });
  }

  it('keeps a theme hue that already reads, and steps a pale one into the band', () => {
    expect(chartCategorical(['#257de0'], 'light')[0]).toBe('#257de0');
    const pale = chartCategorical(['#bfdbfe'], 'light')[0]!;
    expect(pale).not.toBe('#bfdbfe');
    expect(chartPaletteFailures([pale], 'light')).toEqual([]);
  });

  it('drops a grey seed and a near twin of the lead', () => {
    const out = chartCategorical(['#64748b', '#0b81b7', '#0a73a3'], 'light');
    expect(out).not.toContain('#64748b');
    expect(out[0]).toBe('#0b81b7');
    for (let i = 1; i < out.length; i++) expect(chartDeltaE(out[i]!, out[0]!)).toBeGreaterThan(15);
  });

  it('names the gates a palette fails', () => {
    expect(chartPaletteFailures(['#0b81b7', '#0a73a3', '#9ca3af', '#f8fafc'], 'light')).toEqual(
      expect.arrayContaining(['normal #0b81b7/#0a73a3', 'chroma #9ca3af', 'band #f8fafc']),
    );
    expect(chartDeltaE('nope', '#000000')).toBe(0);
  });
});
