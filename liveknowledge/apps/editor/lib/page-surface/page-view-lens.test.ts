import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DRAFT_FLOW,
  draftOf,
  withArticlePageHeight,
  withZonesSettled,
  type ArticleBlock,
  type ArticleFlow,
  type ArticleZoneBlock,
  type Element,
  type Tab,
} from '@liveknowledge/document';
import { liftTabs, lowerTabs } from '@/lib/page-edit/lens';
import {
  isPageViewLens,
  liftViewTabs,
  lowerPageView,
  lowerViewTabs,
  narrowLayoutOf,
  pageViewLens,
  pageViewNarrows,
} from './page-view-lens';
import {
  notePageViewLayout,
  pageViewState,
  resetPageViewStore,
  setPageRoomColumn,
  subscribePageView,
  type NarrowLayout,
} from './page-view-store';

// docs/specs/030-knowledgebase/blueprints/page-surface.md "The narrow view": a page in a window too narrow for its
// column is drawn narrower, its zones fitted to the column, and every change lowered back to the stored page.

const para = (id: string, text: string): ArticleBlock => ({
  id,
  type: 'paragraph',
  runs: text ? [{ text }] : [],
});
// A picture as wide as the column, stood where the full-width layout put it.
const ZONE: ArticleZoneBlock = {
  id: 'z1',
  type: 'zone',
  zone: 'object',
  width: 760,
  height: 380,
  at: { page: 'p1', x: 48, y: 200 },
};
// The page is 856 wide, centred on the canvas's axis: its left at -428, its column's at -380.
const IMAGE = { id: 'img', type: 'image', x: -380, y: 200, width: 760, height: 380 } as Element;
const NOTE = { id: 'n1', type: 'article-note', x: 436, y: 60, width: 24, height: 24 } as Element;

const page = (text = 'Saved'): Tab => ({
  id: 't1',
  name: 'On-Call',
  elements: [IMAGE, NOTE],
  pages: [
    {
      id: 'p1',
      orientation: 'portrait',
      kind: 'article',
      flow: 'art-1',
      size: 'fit',
      fit: { width: 856, height: 1200 },
    },
  ],
  articles: { 'art-1': { blocks: [para('a', text), ZONE, para('b', 'After')] } },
});
const flowOf = (tab: Tab) => tab.articles!['art-1'] as ArticleFlow;
const zoneOf = (tab: Tab) => flowOf(tab).blocks.find((b) => b.type === 'zone') as ArticleZoneBlock;
const elementOf = (tab: Tab, id: string) =>
  tab.elements.find((el) => el.id === id) as Element & {
    x: number;
    y: number;
    width: number;
    height: number;
  };
const fitOf = (tab: Tab) => tab.pages![0]!.fit!;
// What a typing commit does: the editor hands back every block, the zone as it was drawn.
const typed = (tab: Tab, text: string): Tab => {
  const blocks = flowOf(tab).blocks.slice();
  blocks[0] = para('a', text);
  return { ...tab, articles: { ...tab.articles, 'art-1': { blocks } } };
};
const EMPTY_LAYOUT: NarrowLayout = { zones: new Map(), notes: new Map() };
const writer = { by: 'Priya', now: () => 1000 };

// A phone's room: 390 px less 20 px either side.
const PHONE = 350;
const S = PHONE / 760;

afterEach(() => resetPageViewStore());

describe('the narrow view lens', () => {
  it('is the page itself before the room is measured and while the room holds the column', () => {
    const tab = page();
    expect(pageViewLens(tab, null)).toBe(tab);
    expect(pageViewLens(tab, 760)).toBe(tab);
    expect(pageViewLens(tab, 1400)).toBe(tab);
    expect(pageViewNarrows(tab, 760)).toBe(false);
    expect(isPageViewLens(tab)).toBe(false);
  });

  it('draws the page narrower, as tall as stored until measured, then as measured', () => {
    const tab = page();
    const lens = pageViewLens(tab, PHONE, undefined);
    expect(isPageViewLens(lens)).toBe(true);
    expect(pageViewNarrows(tab, PHONE)).toBe(true);
    expect(fitOf(lens)).toEqual({ width: PHONE + 96, height: 1200 });
    const measured = pageViewLens(tab, PHONE, { ...EMPTY_LAYOUT, height: 2600 });
    expect(fitOf(measured)).toEqual({ width: PHONE + 96, height: 2600 });
    // The stored tab is untouched.
    expect(fitOf(tab)).toEqual({ width: 856, height: 1200 });
  });

  it('fits a wide zone and its picture to the column, kept inside it', () => {
    const lens = pageViewLens(page(), PHONE);
    const zone = zoneOf(lens);
    expect(zone.width).toBeCloseTo(PHONE, 6);
    expect(zone.height).toBeCloseTo(380 * S, 6);
    expect(zone.at).toEqual({ page: 'p1', x: 48, y: 200 });
    // The narrow page's left is -(350 + 96) / 2 = -223, its column's 48 further in.
    const img = elementOf(lens, 'img');
    expect(img.x).toBeCloseTo(-223 + 48, 6);
    expect(img.width).toBeCloseTo(PHONE, 6);
    expect(img.height).toBeCloseTo(380 * S, 6);
    expect(img.x + img.width).toBeLessThanOrEqual(-223 + 48 + PHONE + 1e-6);
  });

  it('stands a zone where this window measured it, and a note at its measured corner', () => {
    const layout: NarrowLayout = {
      height: 3000,
      zones: new Map([['z1', { page: 'p1', x: 48, y: 640 }]]),
      notes: new Map([['n1', { x: 230, y: 120 }]]),
    };
    const lens = pageViewLens(page(), PHONE, layout);
    expect(zoneOf(lens).at).toEqual({ page: 'p1', x: 48, y: 640 });
    expect(elementOf(lens, 'img').y).toBeCloseTo(640, 6);
    expect(elementOf(lens, 'n1')).toMatchObject({ x: 230, y: 120 });
  });

  it('keeps a margin note as far from the right edge as it was until measured', () => {
    const lens = pageViewLens(page(), PHONE);
    // The right edge moved from 428 to 223.
    expect(elementOf(lens, 'n1').x).toBeCloseTo(436 - 205, 6);
  });

  it('is one cached lens per stored tab, room and layout', () => {
    const tab = page();
    const layout: NarrowLayout = { ...EMPTY_LAYOUT, height: 2000 };
    const first = pageViewLens(tab, PHONE, layout);
    expect(pageViewLens(tab, PHONE, layout)).toBe(first);
    expect(pageViewLens(tab, PHONE + 10, layout)).not.toBe(first);
    expect(pageViewLens(tab, PHONE, { ...layout })).not.toBe(first);
  });
});

describe('lowering through the narrow view', () => {
  it('stores nothing the narrow layout worked out: height, zones and their elements come back as stored', () => {
    const real = page();
    const lens = pageViewLens(real, PHONE);
    // The article engine's own settles, run on the narrow page.
    const grown = withArticlePageHeight(lens, 'art-1', 2800);
    expect(grown).not.toBe(lens);
    expect(lowerPageView(real, lens, grown)).toBe(real);
    const settled = withZonesSettled(lens, 'art-1', [{ id: 'z1', index: 0, x: 48, y: 700 }]);
    expect(settled).not.toBe(lens);
    // The engine moved the picture with its zone on the narrow page.
    expect(elementOf(settled, 'img').y).toBeCloseTo(700, 6);
    expect(lowerPageView(real, lens, settled)).toBe(real);
    expect(lowerPageView(real, lens, lens)).toBe(real);
  });

  it('answers the real array for a lowered tab equal to the real one, so no commit follows a layout', () => {
    const ts = [page(), { ...page(), id: 't2' }];
    const view = { room: PHONE, layouts: new Map() };
    const lifted = liftViewTabs(ts, 't1', view);
    expect(lifted).not.toBe(ts);
    expect(lifted[1]).toBe(ts[1]);
    const mapped = lifted.map((t) => (t.id === 't1' ? withArticlePageHeight(t, 'art-1', 2800) : t));
    expect(lowerViewTabs(ts, lifted, mapped, 't1')).toBe(ts);
    expect(lowerViewTabs(ts, lifted, lifted, 't1')).toBe(ts);
    // A wide window lifts nothing.
    expect(liftViewTabs(ts, 't1', { room: 1000, layouts: new Map() })).toBe(ts);
  });

  it('lowers writing typed through it as written, the page and the zone as stored', () => {
    const real = page();
    const lens = pageViewLens(real, PHONE);
    const out = lowerPageView(real, lens, typed(lens, 'Typed on a phone'));
    expect(out).not.toBe(real);
    const blocks = flowOf(out).blocks;
    expect(blocks[0]).toEqual(para('a', 'Typed on a phone'));
    expect(blocks[1]).toBe(ZONE);
    expect(blocks[2]).toBe(flowOf(real).blocks[2]);
    expect(out.pages).toBe(real.pages);
    expect(out.elements).toBe(real.elements);
  });

  it('lowers a picture moved or resized on the narrow page through the inverse transform', () => {
    const real = page();
    const lens = pageViewLens(real, PHONE);
    const moved: Tab = {
      ...lens,
      elements: lens.elements.map((el) =>
        el.id === 'img' ? ({ ...el, x: (el as { x: number }).x + 10 } as Element) : el,
      ),
    };
    const out = lowerPageView(real, lens, moved);
    expect(elementOf(out, 'img').x).toBeCloseTo(-380 + 10 / S, 6);
    expect(elementOf(out, 'img').width).toBeCloseTo(760, 6);
    expect(elementOf(out, 'n1')).toBe(NOTE);
    // A zone resized on the narrow page is stored at the size it means at full width.
    const resized: Tab = {
      ...lens,
      articles: {
        'art-1': {
          blocks: flowOf(lens).blocks.map((b) =>
            b.type === 'zone' ? { ...b, width: PHONE / 2 } : b,
          ),
        },
      },
    };
    const zone = zoneOf(lowerPageView(real, lens, resized));
    expect(zone.width).toBe(380);
    expect(zone.height).toBe(380);
    expect(zone.at).toEqual(ZONE.at);
  });

  it('under the edit lens, sends writing typed narrow to the draft and keeps the stored page', () => {
    const real = page();
    const ts = [real];
    const view = { room: PHONE, layouts: new Map() };
    // As useEditorDocument composes them: lift edit, lift view, map, lower view, lower edit.
    const edit = liftTabs(ts, 't1');
    const lifted = liftViewTabs(edit, 't1', view);
    const mapped = lifted.map((t) => withArticlePageHeight(typed(t, 'Draft line'), 'art-1', 3100));
    const out = lowerTabs(ts, edit, lowerViewTabs(edit, lifted, mapped, 't1'), 't1', writer);
    const tab = out[0]!;
    const draft = draftOf(tab)!;
    expect((draft.flow.blocks[0] as { runs: { text: string }[] }).runs[0]!.text).toBe('Draft line');
    // The saved writing, the page's size and the zone are as stored; no narrow height went to the draft record.
    expect(flowOf(tab)).toBe(flowOf(real));
    expect(fitOf(tab)).toEqual({ width: 856, height: 1200 });
    expect(draft.record.height).toBeUndefined();
    expect(tab.articles![DRAFT_FLOW]).toBeDefined();
    expect(tab.elements).toBe(real.elements);
  });
});

describe('what a narrow layout measured', () => {
  it('reads the height, each zone’s place and each note’s corner, and is kept once', () => {
    const lens = pageViewLens(page(), PHONE);
    const layout = narrowLayoutOf(lens, {
      flow: 'art-1',
      heightNeeded: 2999.2,
      zones: [{ id: 'z1', index: 0, x: 48, y: 640 }],
      notes: [{ id: 'n1', index: 0, y: 300, height: 20 }],
    })!;
    expect(layout.height).toBe(3000);
    expect(layout.zones.get('z1')).toEqual({ page: 'p1', x: 48, y: 640 });
    expect(layout.notes.get('n1')).toBeDefined();
    expect(narrowLayoutOf(page(), { flow: 'art-1', zones: [], notes: [] })).toBeNull();
    expect(narrowLayoutOf(lens, { flow: 'other', zones: [], notes: [] })).toBeNull();

    const told = vi.fn();
    const off = subscribePageView(told);
    notePageViewLayout('t1', layout);
    const kept = pageViewState().layouts.get('t1');
    // The same places again, within the layout's noise, tell nobody and keep the kept layout (so the same lens).
    notePageViewLayout('t1', {
      ...layout,
      zones: new Map([['z1', { page: 'p1', x: 48.25, y: 640.5 }]]),
      notes: new Map(layout.notes),
    });
    expect(told).toHaveBeenCalledTimes(1);
    expect(pageViewState().layouts.get('t1')).toBe(kept);
    setPageRoomColumn(PHONE);
    setPageRoomColumn(PHONE);
    expect(told).toHaveBeenCalledTimes(2);
    off();
  });

  it('keeps the layouts of the pages read lately, not every page ever read', () => {
    for (let i = 0; i < 40; i++) notePageViewLayout(`t${i}`, { ...EMPTY_LAYOUT, height: 500 });
    const ids = [...pageViewState().layouts.keys()];
    expect(ids).toHaveLength(32);
    expect(ids[0]).toBe('t8');
    expect(ids.at(-1)).toBe('t39');
  });
});
