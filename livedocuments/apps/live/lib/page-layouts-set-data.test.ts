import { describe, expect, it } from 'vitest';
import type { Element, ShapeElement } from '@livedocuments/document';
import { PAGE_LAYOUTS } from '@livedocuments/templates';

// docs/specs/007-editor/pages-mode.md "Layouts": the further Data layouts, each a real
// chart or table with the source line its numbers owe, arranged side by side on a wide page.
const PORTRAIT = { x: 0, y: 0, width: 1000, height: 1414 };
const LANDSCAPE = { x: 0, y: 0, width: 1414, height: 1000 };
const STORY = { x: 0, y: 0, width: 900, height: 1600 };
const SQUARE = { x: 0, y: 0, width: 1000, height: 1000 };

const layout = (id: string) => {
  const l = PAGE_LAYOUTS.find((p) => p.id === id);
  if (!l) throw new Error(`no layout ${id}`);
  return l;
};
const shapes = (els: Element[], kind: string) =>
  els.filter((e): e is ShapeElement => e.type === 'shape' && e.shape === kind);
const labels = (els: Element[]) =>
  els.flatMap((e) => ('label' in e && typeof e.label === 'string' ? [e.label] : []));
const hasSource = (els: Element[]) => labels(els).some((l) => l.startsWith('Source:'));

describe('Data set layouts', () => {
  const ids = ['kpi-dashboard', 'trend-story', 'market-share', 'stat-mosaic'];

  it('are all in the Data category, which holds twelve', () => {
    for (const id of ids) expect(layout(id).category).toBe('data');
    expect(PAGE_LAYOUTS.filter((l) => l.category === 'data')).toHaveLength(12);
  });

  for (const id of ids) {
    it(`${id} cites a source on every page shape`, () => {
      for (const box of [PORTRAIT, LANDSCAPE, STORY, SQUARE]) {
        expect(hasSource(layout(id).build(box))).toBe(true);
      }
    });
  }

  it('KPI Dashboard: four cards, each a sparkline, four across when wide', () => {
    const tall = layout('kpi-dashboard').build(PORTRAIT);
    expect(shapes(tall, 'line-chart')).toHaveLength(4);
    const wide = layout('kpi-dashboard').build(LANDSCAPE);
    const ys = new Set(shapes(wide, 'line-chart').map((s) => s.y));
    expect(ys.size).toBe(1);
    expect(new Set(shapes(tall, 'line-chart').map((s) => s.y)).size).toBe(2);
  });

  it('Trend Story: two series over twelve months, the moments beside the chart when wide', () => {
    const tall = layout('trend-story').build(PORTRAIT);
    const [chart] = shapes(tall, 'line-chart');
    expect(chart!.lineSeries).toHaveLength(2);
    expect(chart!.lineCategories).toHaveLength(12);
    const wide = layout('trend-story').build(LANDSCAPE);
    const [wideChart] = shapes(wide, 'line-chart');
    const discs = shapes(wide, 'circle');
    expect(discs).toHaveLength(3);
    for (const d of discs) expect(d.x).toBeGreaterThan(wideChart!.x + wideChart!.width);
    for (const d of shapes(tall, 'circle')) expect(d.y).toBeGreaterThan(chart!.y + chart!.height);
  });

  it('Market Share: a doughnut and a table of the same five shares', () => {
    for (const box of [PORTRAIT, LANDSCAPE]) {
      const els = layout('market-share').build(box);
      const [pie] = shapes(els, 'pie-chart');
      expect(pie!.chartVariant).toBe('doughnut');
      const table = els.find((e) => e.type === 'table');
      expect(table && table.type === 'table' && table.cells.length).toBe(
        pie!.pieSlices!.length + 1,
      );
    }
  });

  it('Stat Mosaic: six tiles of mixed sizes, holding a ring, stars and a chart', () => {
    for (const box of [PORTRAIT, LANDSCAPE, STORY, SQUARE]) {
      const els = layout('stat-mosaic').build(box);
      const tiles = shapes(els, 'square');
      expect(tiles).toHaveLength(6);
      expect(new Set(tiles.map((t) => Math.round(t.width * t.height))).size).toBeGreaterThan(1);
      expect(shapes(els, 'progress-ring')).toHaveLength(1);
      expect(shapes(els, 'rating')).toHaveLength(1);
      expect(shapes(els, 'line-chart')).toHaveLength(1);
      // No two tiles overlap.
      for (let i = 0; i < tiles.length; i += 1) {
        for (let j = i + 1; j < tiles.length; j += 1) {
          const a = tiles[i]!;
          const b = tiles[j]!;
          const apart =
            a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y;
          expect(apart).toBe(true);
        }
      }
    }
  });
});
