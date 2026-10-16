import { describe, expect, it } from 'vitest';
import { chartFrame } from './chart-frame';
import {
  chartMarkInk,
  chartPageGrounds,
  chartTextInk,
  CHART_MARK_CONTRAST,
  CHART_TEXT_CONTRAST,
  CHART_TEXT_TARGET,
} from './chart-ink';
import { CHART_PALETTES } from './chart-palettes';
import { contrastRatio, hexToRgb } from './colors';
import { createShape, createSticky, type Element, type ShapeElement } from './index';
import { layOutIllustratePages, type PageFill } from './illustrate-page';
import { worstContrast } from './page-ink-contrast';
import { sankeyFrame } from './sankey-frame';
import { svgBoxed } from './svg-render';
import { svgLineChart } from './svg-render-charts';
import { themeChartPalette } from './theme-presets';
import { THEMES } from './themes-data';

// docs/specs/007-editor/illustrate-pages.md "Charts adapt as they are drawn": a chart's series
// reach 3:1 and its text 4.5:1 against what it sits on, keeping their hue, and a colour that
// already reads is drawn as it is.

const LIGHT = '#ffffff';
const DARK = '#0f172a';
const NAVY = '#1e3a5f';
const TEAL = '#0f766e';
const ROSE = '#e11d48';
const YELLOW = '#facc15';
const GROUNDS = { light: LIGHT, dark: DARK, navy: NAVY, teal: TEAL, rose: ROSE, yellow: YELLOW };

// Hue in degrees, or null for a grey (no hue to keep).
function hue(hex: string): number | null {
  const { r, g, b } = hexToRgb(hex)!;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 8) return null;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

// Every colour a chart may be drawn in: each preset palette and each theme's ramp, both halves.
const SERIES = [
  ...new Set([
    ...CHART_PALETTES.flatMap((p) => p.colors),
    ...THEMES.flatMap((t) => themeChartPalette(t)),
  ]),
].filter((c) => /^#[0-9a-f]{6}$/i.test(c));

describe('chartMarkInk', () => {
  it('draws a colour as it is with no ground', () => {
    expect(chartMarkInk('#334155', undefined)).toBe('#334155');
    expect(chartMarkInk('#334155', [])).toBe('#334155');
  });

  it("lifts Boardroom's dark slate line off a dark page, keeping its hue", () => {
    const out = chartMarkInk('#334155', [DARK]);
    expect(out).not.toBe('#334155');
    expect(contrastRatio(out, DARK)).toBeGreaterThanOrEqual(CHART_MARK_CONTRAST);
    expect(hueGap(hue(out)!, hue('#334155')!)).toBeLessThan(12);
  });

  it('moves by the least: just past 3:1, not to white', () => {
    const out = chartMarkInk('#334155', [DARK]);
    expect(contrastRatio(out, DARK)).toBeLessThan(CHART_MARK_CONTRAST + 0.2);
  });

  it.each(Object.entries(GROUNDS))('every series colour reaches 3:1 on a %s page', (_, ground) => {
    for (const color of SERIES) {
      const out = chartMarkInk(color, [ground]);
      const ratio = contrastRatio(out, ground);
      // A colour that cannot reach 3:1 either way on this ground (none on these) goes to the end
      // that reads best; every one here reaches it.
      expect(ratio, `${color} on ${ground} -> ${out}`).toBeGreaterThanOrEqual(CHART_MARK_CONTRAST);
      const before = hue(color);
      const after = hue(out);
      if (before !== null && after !== null) expect(hueGap(before, after)).toBeLessThan(15);
    }
  });

  it('leaves a colour that already reads exactly as it is', () => {
    for (const ground of Object.values(GROUNDS)) {
      for (const color of SERIES) {
        if (contrastRatio(color, ground) >= CHART_MARK_CONTRAST)
          expect(chartMarkInk(color, [ground])).toBe(color);
      }
    }
  });

  it('reads at the worst point of a gradient under the chart', () => {
    const tones = ['#0f172a', '#334155', '#64748b'];
    const out = chartMarkInk('#475569', tones);
    expect(worstContrast(out, tones)).toBeGreaterThanOrEqual(CHART_MARK_CONTRAST);
  });
});

describe('chartTextInk', () => {
  it.each(Object.entries(GROUNDS))(
    'keeps a chart label at 4.5:1 or over, else takes it to 7:1, on a %s page',
    (_, ground) => {
      for (const color of ['#0f172a', '#334155', '#64748b', '#94a3b8', '#f8fafc']) {
        const out = chartTextInk(color, [ground]);
        const kept = contrastRatio(color, ground) >= CHART_TEXT_CONTRAST;
        // 7:1 where any lightness of the hue reaches it (white or black does), else AA.
        const reachable =
          Math.max(contrastRatio('#ffffff', ground), contrastRatio('#000000', ground)) >=
          CHART_TEXT_TARGET;
        if (kept) expect(out, `${color} on ${ground}`).toBe(color);
        else
          expect(contrastRatio(out, ground), `${color} on ${ground}`).toBeGreaterThanOrEqual(
            reachable ? CHART_TEXT_TARGET : CHART_TEXT_CONTRAST,
          );
      }
    },
  );

  it('keeps text that already reads, and anything it cannot measure', () => {
    expect(chartTextInk('#0f172a', [LIGHT])).toBe('#0f172a');
    expect(chartTextInk('currentColor', [DARK])).toBe('currentColor');
  });
});

describe('chartFrame and sankeyFrame with a ground', () => {
  const line = { ...createShape('line-chart', 0, 0), width: 300, height: 200 } as ShapeElement;

  it('adapts every palette and per-series colour', () => {
    const { colorAt } = chartFrame(line, ['#334155', '#1e293b'], [DARK]);
    expect(contrastRatio(colorAt(0, {}), DARK)).toBeGreaterThanOrEqual(CHART_MARK_CONTRAST);
    expect(contrastRatio(colorAt(1, {}), DARK)).toBeGreaterThanOrEqual(CHART_MARK_CONTRAST);
    expect(contrastRatio(colorAt(0, { color: '#111827' }), DARK)).toBeGreaterThanOrEqual(
      CHART_MARK_CONTRAST,
    );
  });

  it('is unchanged without a ground', () => {
    const { colorAt } = chartFrame(line, ['#334155']);
    expect(colorAt(0, {})).toBe('#334155');
  });

  it("adapts a Sankey's node colours", () => {
    const el = {
      ...createShape('sankey', 0, 0),
      width: 400,
      height: 240,
      sankeyFlows: [{ from: 'A', to: 'B', value: 3 }],
    } as ShapeElement;
    const f = sankeyFrame(el, ['#1e293b'], [DARK]);
    for (let i = 0; i < f.layout.nodes.length; i += 1)
      expect(contrastRatio(f.nodeColor(i), DARK)).toBeGreaterThanOrEqual(CHART_MARK_CONTRAST);
  });
});

describe('chartPageGrounds', () => {
  const pageWith = (fill?: PageFill) =>
    layOutIllustratePages([
      { id: 'p', orientation: 'portrait', ...(fill ? { background: { fill } } : {}) },
    ])[0]!;
  const chartAt = (page: ReturnType<typeof pageWith>, id = 'c'): Element => ({
    ...createShape('line-chart', page.rect.x + 40, page.rect.y + 300),
    id,
    width: 300,
    height: 200,
  });
  const cardUnder = (page: ReturnType<typeof pageWith>, fillColor: string): Element => ({
    ...createShape('square', page.rect.x + 20, page.rect.y + 280),
    id: 'card',
    width: 400,
    height: 260,
    fillColor,
  });

  it('is empty on the plain paper', () => {
    const page = pageWith();
    expect(chartPageGrounds([chartAt(page)], [page]).size).toBe(0);
  });

  it("is a solid page's colour", () => {
    const page = pageWith({ kind: 'solid', color: NAVY });
    expect(chartPageGrounds([chartAt(page)], [page]).get('c')).toEqual([NAVY]);
  });

  it("is the card's fill when the chart sits on one", () => {
    const page = pageWith({ kind: 'solid', color: NAVY });
    const grounds = chartPageGrounds([cardUnder(page, '#f8fafc'), chartAt(page)], [page]);
    expect(grounds.get('c')).toEqual(['#f8fafc']);
  });

  it('ignores a card drawn over the chart', () => {
    const page = pageWith({ kind: 'solid', color: NAVY });
    const grounds = chartPageGrounds([chartAt(page), cardUnder(page, '#f8fafc')], [page]);
    expect(grounds.get('c')).toEqual([NAVY]);
  });

  it('leaves a chart over a surface of unknown tone as it is', () => {
    const page = pageWith({ kind: 'solid', color: NAVY });
    const image = {
      ...createShape('plan-sheet', page.rect.x, page.rect.y + 260),
      id: 'widget',
      width: 500,
      height: 300,
    } as Element;
    expect(chartPageGrounds([image, chartAt(page)], [page]).has('c')).toBe(false);
  });

  it('takes a sticky note under it as its ground', () => {
    const page = pageWith({ kind: 'solid', color: DARK });
    const note = {
      ...createSticky(page.rect.x + 20, page.rect.y + 280),
      id: 'note',
      width: 400,
      height: 260,
      fillColor: '#fef08a',
    } as Element;
    expect(chartPageGrounds([note, chartAt(page)], [page]).get('c')).toEqual(['#fef08a']);
  });

  it("reads a gradient as every tone across the chart's box", () => {
    const page = pageWith({ kind: 'gradient', from: '#000000', to: '#ffffff', angle: 180 });
    expect(chartPageGrounds([chartAt(page)], [page]).get('c')!.length).toBeGreaterThan(1);
  });
});

describe('the export draws charts as the canvas does', () => {
  const el = {
    ...createShape('line-chart', 0, 0),
    id: 'c',
    width: 300,
    height: 200,
    lineSeries: [{ name: 'Revenue', values: [1, 2, 3], color: '#334155' }],
    lineCategories: ['Jan', 'Feb', 'Mar'],
  } as ShapeElement & { x: number; y: number };

  it('draws the series and labels adapted on a dark ground', () => {
    const svg = svgLineChart(el, '#475569', undefined, undefined, [DARK]);
    expect(svg).not.toContain('stroke="#334155"');
    // A tag's attribute, read by slicing the tag out first (no backtracking pattern over the markup).
    const attrOf = (tagStart: number, attr: string) => {
      const tag = svg.slice(tagStart, svg.indexOf('>', tagStart));
      const at = tag.indexOf(`${attr}="`);
      return tag.slice(at + attr.length + 2, at + attr.length + 9);
    };
    const stroke = attrOf(svg.indexOf('<polyline'), 'stroke');
    expect(contrastRatio(stroke, DARK)).toBeGreaterThanOrEqual(CHART_MARK_CONTRAST);
    const label = attrOf(svg.lastIndexOf('<text', svg.indexOf('>Jan<')), 'fill');
    expect(contrastRatio(label, DARK)).toBeGreaterThanOrEqual(CHART_TEXT_CONTRAST);
  });

  it('svgBoxed takes the chart ground from chartGrounds', () => {
    const plain = svgBoxed(el);
    const onDark = svgBoxed(el, { surface: 'dark', chartGrounds: new Map([['c', [DARK]]]) });
    expect(plain).toContain('stroke="#334155"');
    expect(onDark).not.toContain('stroke="#334155"');
  });
});

describe('cost', () => {
  it('finds the grounds of 40 charts among 600 elements well inside a frame budget', () => {
    const page = layOutIllustratePages([
      { id: 'p', orientation: 'portrait', background: { fill: { kind: 'solid', color: NAVY } } },
    ])[0]!;
    const els: Element[] = [];
    for (let i = 0; i < 600; i += 1) {
      const x = page.rect.x + (i % 20) * 30;
      const y = page.rect.y + Math.floor(i / 20) * 30;
      els.push({
        ...createShape(i % 15 === 0 ? 'line-chart' : 'square', x, y),
        id: `e${i}`,
        width: 60,
        height: 40,
        fillColor: '#f1f5f9',
      });
    }
    chartPageGrounds(els, [page]);
    const start = performance.now();
    for (let k = 0; k < 10; k += 1) chartPageGrounds(els, [page]);
    const each = (performance.now() - start) / 10;
    // Measured about 0.5 ms on an M-series Mac; the budget leaves room for loaded CI.
    expect(each).toBeLessThan(50);
  });
});
