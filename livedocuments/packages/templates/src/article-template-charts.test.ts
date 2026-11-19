import { describe, expect, it } from 'vitest';
import {
  articlesOf,
  layOutPages,
  pagesOf,
  withZonesSettled,
  zoneCanvasRect,
  zoneMemberIds,
  type ArticleParagraphBlock,
  type ArticleZoneBlock,
  type Element,
  type Tab,
} from '@livedocuments/document';
import { chartMarkerOf, withTemplateCharts } from './article-template-charts';
import { articleTemplateElements, articleTemplateOverridesFor } from './article-templates';
import { buildTemplate } from './build-template';

// Work Tracker 1177: the written templates chart what they used to tabulate, each chart a native one in an object zone
// of the writing, and each moves with its zone when the editor settles it.
const para = (id: string, text: string): ArticleParagraphBlock => ({
  id,
  type: 'paragraph',
  runs: [{ text }],
});

describe('chartMarkerOf', () => {
  it('reads a line of its own, and nothing else', () => {
    expect(chartMarkerOf(para('a', '{chart:spend}'))).toBe('spend');
    expect(chartMarkerOf(para('a', ' {chart:q3-sales} '))).toBe('q3-sales');
    expect(chartMarkerOf(para('a', 'See {chart:spend}'))).toBeNull();
    expect(chartMarkerOf(para('a', '{chart:Spend}'))).toBeNull();
    expect(chartMarkerOf({ ...para('a', '{chart:spend}'), style: 'title' })).toBeNull();
    expect(chartMarkerOf({ id: 'a', type: 'paragraph', runs: [] })).toBeNull();
    expect(
      chartMarkerOf({
        id: 'a',
        type: 'paragraph',
        runs: [{ text: '{chart:' }, { text: 'spend}' }],
      }),
    ).toBeNull();
    expect(chartMarkerOf({ id: 'd', type: 'pageBreak' })).toBeNull();
  });
});

describe('withTemplateCharts', () => {
  const chart = { shape: 'bar-chart' as const, height: 200, fields: { chartValues: true } };

  it('reads each marker into a zone on the first page, its chart inside it, one below the other', () => {
    const { blocks, elements } = withTemplateCharts(
      'art-x',
      undefined,
      [para('b1', 'Intro'), para('b2', '{chart:one}'), para('b3', '{chart:two}')],
      { one: chart, two: { ...chart, shape: 'line-chart' } },
    );
    expect(blocks[0]).toEqual(para('b1', 'Intro'));
    const zones = blocks.slice(1) as ArticleZoneBlock[];
    expect(zones.map((z) => [z.id, z.type, z.zone, z.height])).toEqual([
      ['b2', 'zone', 'object', 200],
      ['b3', 'zone', 'object', 200],
    ]);
    expect(elements.map((e) => e.shape)).toEqual(['bar-chart', 'line-chart']);
    expect(elements.every((e) => e.chartValues === true)).toBe(true);
    const pages = layOutPages([
      { id: 'page-1', orientation: 'portrait', kind: 'article', flow: 'art-x' },
    ]);
    const rects = zones.map((z) => zoneCanvasRect(pages, z)!);
    // Each chart is its own zone's, never the other's.
    expect(zoneMemberIds(elements, rects[0]!)).toEqual(new Set([elements[0]!.id]));
    expect(zoneMemberIds(elements, rects[1]!)).toEqual(new Set([elements[1]!.id]));
    expect(rects[1]!.y).toBeGreaterThan(rects[0]!.y + rects[0]!.height);
    // On the page, the width of the text.
    expect(rects[0]!.x).toBeGreaterThan(pages[0]!.rect.x);
    expect(rects[0]!.x + rects[0]!.width).toBeLessThan(pages[0]!.rect.x + pages[0]!.rect.width);
  });

  it('leaves a marker with no chart of its key as written', () => {
    const { blocks, elements } = withTemplateCharts(
      'art-x',
      undefined,
      [para('b', '{chart:none}')],
      {},
    );
    expect(blocks).toEqual([para('b', '{chart:none}')]);
    expect(elements).toEqual([]);
  });
});

describe('the written templates with charts', () => {
  const tabOf = (kind: 'status-report' | 'research-report' | 'case-study'): Tab => ({
    id: 't',
    name: 'Tab',
    ...articleTemplateOverridesFor(kind),
    elements: buildTemplate(kind, 0, 0),
  });

  it.each([
    ['status-report', 'bar-chart'],
    ['research-report', 'line-chart'],
    ['case-study', 'line-chart'],
  ] as const)('%s carries its %s in a zone of its writing', (kind, shape) => {
    const tab = tabOf(kind);
    const [flow, doc] = Object.entries(articlesOf(tab))[0]!;
    const zones = doc.blocks.filter((b): b is ArticleZoneBlock => b.type === 'zone');
    expect(zones).toHaveLength(1);
    expect(tab.elements.map((e) => (e as { shape?: string }).shape)).toEqual([shape]);
    expect(articleTemplateElements(kind)).toHaveLength(1);
    // No marker is left in the writing.
    expect(JSON.stringify(doc.blocks)).not.toContain('{chart:');
    // Settled where the writing lays the zone out (on its third page, say), the chart moves with it.
    const pages = layOutPages(pagesOf(tab)).filter((p) => p.flow === flow);
    const was = zoneCanvasRect(pages, zones[0]!)!;
    const grown = {
      ...tab,
      pages: [0, 1, 2].map((i) => ({ ...pagesOf(tab)[0]!, id: `page-${i + 1}` })),
    } as Tab;
    const settled = withZonesSettled(grown, flow, [{ id: zones[0]!.id, index: 2, x: 80, y: 300 }]);
    const nowPages = layOutPages(pagesOf(settled)).filter((p) => p.flow === flow);
    const chart = settled.elements[0] as Element & { x: number; y: number };
    const before = tab.elements[0] as Element & { x: number; y: number };
    expect(chart.x - before.x).toBe(nowPages[2]!.rect.x + 80 - was.x);
    expect(chart.y - before.y).toBe(nowPages[2]!.rect.y + 300 - was.y);
  });

  it("lands Status Report's spend as a chart not linked to a sheet yet, and the others as plain charts", () => {
    const pending = (kind: 'status-report' | 'research-report' | 'case-study') =>
      (tabOf(kind).elements[0] as { chartSheetPending?: boolean }).chartSheetPending;
    expect(pending('status-report')).toBe(true);
    expect(pending('research-report')).toBeUndefined();
    expect(pending('case-study')).toBeUndefined();
  });

  it('leave the other written templates without elements', () => {
    expect(buildTemplate('design-doc', 0, 0)).toEqual([]);
    expect(buildTemplate('meeting-notes', 0, 0)).toEqual([]);
  });
});
