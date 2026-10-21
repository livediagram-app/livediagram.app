import { describe, expect, it } from 'vitest';
import type { Tab } from '@liveplanner/document';
import { planImageOf } from './plan-export-tab';
import { NOW, shape } from './test-fixtures';

// docs/specs/026-plan/plan-tabs.md "Export": an image draws a Plan tab as laid out, never the canvas under it.
const input = { tabs: [], now: NOW, renderDiagram: () => '' };

describe('the image of a Plan tab', () => {
  it('is a Board tab’s board alone', () => {
    const tab: Tab = {
      id: 't',
      name: 'Roadmap',
      kind: 'board',
      elements: [shape('stray', 'square'), shape('b', 'plan-board', { layerId: 'L' })],
      layers: [{ id: 'L', name: 'Hidden', visible: false }] as never,
    };
    const image = planImageOf(tab, input)!;
    expect(image.tab.elements.map((e) => e.id)).toEqual(['b']);
    expect(image.tab.layers).toBeUndefined();
  });

  it('is a Sheet tab’s Sheet and its charts at their anchors in its grid', () => {
    const sheet = shape('s', 'plan-sheet', {
      x: 100,
      y: 50,
      width: 960,
      height: 560,
      planSheet: { sheetId: 'sheet-1' },
    });
    const anchored = shape('c1', 'pie-chart', {
      x: 9999,
      y: 9999,
      width: 200,
      height: 150,
      chartSource: { sheetId: 'sheet-1', range: { r1: 'a', c1: 'b', r2: 'c', c2: 'd' } },
      sheetAnchor: { x: 300, y: 120 },
    });
    const outOfView = { ...anchored, id: 'c2', sheetAnchor: { x: 5000, y: 0 } };
    const below = { ...anchored, id: 'c5', sheetAnchor: { x: 0, y: 600 } };
    const floating = { ...anchored, id: 'c3', sheetAnchor: undefined, x: 10, y: 20 };
    const other = {
      ...anchored,
      id: 'c4',
      chartSource: { sheetId: 'x', range: { r1: 'a', c1: 'b', r2: 'c', c2: 'd' } },
    };
    const tab: Tab = {
      id: 't',
      name: 'Budget',
      kind: 'sheet',
      elements: [sheet, anchored, outOfView, floating, other, below] as never,
    };
    const image = planImageOf(tab, input)!;
    expect(image.tab.elements.map((e) => e.id)).toEqual(['s', 'c1', 'c3', 'c5']);
    // The Sheet grows to take in a chart below its frame, and to the image limit across.
    expect(image.tab.elements[0]).toMatchObject({ width: 4000, height: 62 + 600 + 150 + 24 });
    // Inside the frame: 46 px of row heads, a 40 px title and 22 px of column heads.
    expect(image.tab.elements[1]).toMatchObject({ x: 100 + 46 + 300, y: 50 + 62 + 120 });
    expect(image.tab.elements[2]).toMatchObject({ x: 10, y: 20 });
    const bare = planImageOf(tab, { ...input, sheetHeads: () => false })!;
    expect(bare.tab.elements[1]).toMatchObject({ x: 400, y: 50 + 40 + 120 });
  });

  it('grows a Sheet tab’s Sheet to the grid its cells fill, never shrinking it', () => {
    const sheet = shape('s', 'plan-sheet', {
      x: 0,
      y: 0,
      width: 960,
      height: 560,
      planSheet: { sheetId: 'sheet-1' },
    });
    const tab: Tab = { id: 't', name: 'S', kind: 'sheet', elements: [sheet] };
    const wide = planImageOf(tab, {
      ...input,
      sheetContent: (id) => (id === 'sheet-1' ? { width: 1400, height: 300 } : null),
    })!;
    expect(wide.tab.elements[0]).toMatchObject({ width: 46 + 1400, height: 560 });
    const unknown = planImageOf(tab, { ...input, sheetContent: () => null })!;
    expect(unknown.tab.elements[0]).toMatchObject({ width: 960, height: 560 });
  });

  it('never shrinks a Sheet larger than the growth limit', () => {
    const big = shape('s', 'plan-sheet', {
      x: 0,
      y: 0,
      width: 5000,
      height: 4500,
      planSheet: { sheetId: 'sheet-1' },
    });
    const image = planImageOf({ id: 't', name: 'S', kind: 'sheet', elements: [big] }, input)!;
    expect(image.tab.elements[0]).toMatchObject({ width: 5000, height: 4500 });
  });

  it('is nothing on a Sheet tab whose Sheet is gone, and null on any other tab', () => {
    expect(
      planImageOf({ id: 't', name: 'S', kind: 'sheet', elements: [] }, input)!.tab.elements,
    ).toEqual([]);
    expect(planImageOf({ id: 't', name: 'D', elements: [shape('a', 'square')] }, input)).toBeNull();
  });

  it('is a Dashboard’s page', () => {
    const image = planImageOf(
      {
        id: 't',
        name: 'O',
        kind: 'dashboard',
        elements: [],
        dashboard: { rows: [{ id: 'r', height: 320, slots: [{ id: 'a', span: 12 }] }] },
      },
      input,
    )!;
    expect(image.art.get('export-slot-a')).toContain('Empty Slot');
  });
});
