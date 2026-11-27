import { describe, expect, it } from 'vitest';
import { chartCategorical, chartDeltaE, chartPaletteFailures } from './chart-categorical';
import { chartFrame } from './chart-frame';
import { chartMarkInk } from './chart-mark-ink';
import { canvasSurface } from './colour-math';
import type { ShapeElement } from './element';
import { getBuiltInTheme } from './themes';
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

  // What is drawn is what passes: on a filled page chartMarkInk's 3:1 step can move a colour, so the palette is picked
  // after the step (chart-frame.ts) and the gates judge the drawn colours, on each theme's light and dark halves and on
  // a white and a near-black page.
  const pie = (n: number): ShapeElement => ({
    id: 'p',
    type: 'shape',
    shape: 'pie-chart',
    x: 0,
    y: 0,
    width: 300,
    height: 300,
    pieSlices: Array.from({ length: n }, (_, i) => ({ label: `S${i}`, value: 1 })),
  });
  for (const base of [...THEMES, ...BOARD_THEMES]) {
    for (const half of ['light', 'dark'] as const) {
      const theme = THEMES.includes(base) ? getBuiltInTheme(base.id, half) : base;
      if (half === 'dark' && theme === base) continue;
      for (const ground of [theme.backgroundColor ?? '#ffffff', '#ffffff', '#0b0f17']) {
        it(`${base.id} (${half}) on ${ground}: the drawn colours pass every gate`, () => {
          const palette = themeChartPalette(theme);
          const f = chartFrame(pie(8), palette, [ground]);
          const drawn = [...new Set(f.data.map((d, i) => f.colorAt(i, d)))];
          const n = chartCategorical(palette, canvasSurface(ground), [ground]).length;
          const run = drawn.slice(0, n);
          expect(run.length).toBeGreaterThanOrEqual(4);
          expect(chartPaletteFailures(run, canvasSurface(ground))).toEqual([]);
          for (const c of run) expect(chartMarkInk(c, [ground])).toBe(c);
        });
      }
    }
  }
});
