import { describe, expect, it } from 'vitest';
import {
  CONTINUOUS_PAGE_WIDTH,
  articlesOf,
  draftOf,
  layOutPages,
  pagesOf,
  withZonesFitted,
  type ArticleBlock,
  type ArticleFlow,
  type ArticleZoneBlock,
  type Element,
  type Tab,
} from '@liveknowledge/document';
import { articleTextBox } from '@/lib/article/article-flow-geometry';
import type { PageViewState } from '@/lib/page-surface/page-view-store';
import { pageEditLens } from './lens';
import { pageViewLens } from '@/lib/page-surface/page-view-lens';
import { pageEditDirty, withTypedWriting } from './page-edit-dirty';
import { throughPageLens } from './through-lens';

// docs/specs/030-knowledgebase/blueprints/editing.md "Errors and edge cases" (Cancel in the narrow view) and
// page-surface.md "The narrow view": a picture wider than the narrow column is drawn fitted to it, and neither the
// intake's zone fit nor Cancel's dirty check may take that narrow measure for a change (Work Tracker 1432).

const para = (id: string, text: string): ArticleBlock => ({
  id,
  type: 'paragraph',
  runs: [{ text }],
});
// A 900 x 420 picture, wider than the 756 px column of a 1,440 px window with the page tree and rail open.
const ZONE: ArticleZoneBlock = {
  id: 'z1',
  type: 'zone',
  zone: 'object',
  width: 900,
  height: 420,
  at: { page: 'p1', x: 48, y: 200 },
};
const IMAGE = { id: 'img', type: 'image', x: -380, y: 200, width: 900, height: 420 } as Element;
const NARROW = 756;
const page = (): Tab => ({
  id: 't1',
  name: 'Runbook',
  elements: [IMAGE],
  pages: [
    {
      id: 'p1',
      orientation: 'portrait',
      kind: 'article',
      flow: 'art-1',
      size: 'fit',
      fit: { width: CONTINUOUS_PAGE_WIDTH, height: 1200 },
    },
  ],
  articles: { 'art-1': { blocks: [para('a', 'Saved'), ZONE, para('b', 'After')] } },
});
const flowOf = (tab: Tab) => tab.articles!['art-1'] as ArticleFlow;
const zoneOf = (blocks: readonly ArticleBlock[]) =>
  blocks.find((b): b is ArticleZoneBlock => b.type === 'zone')!;

const editing = { current: { tabId: 't1', writer: { by: 'Priya', now: () => 1000 } } };
const drawn = { current: 't1' };
const viewAt = (room: number | null): (() => PageViewState) => {
  const state: PageViewState = { room, layouts: new Map() };
  return () => state;
};
const through = (room: number | null) => (map: (ts: Tab[]) => Tab[]) =>
  throughPageLens(editing, drawn, map, viewAt(room));

// What the article editor hands back from the page it draws: every block, a zone's sides read back whole px and the
// zone where the narrow layout stood it (seen in the browser: 757 x 353 at y 262 for a stored 900 x 420 at y 200).
const takenFrom = (lens: Tab): ArticleBlock[] =>
  flowOf(lens).blocks.map((b) =>
    b.type === 'zone'
      ? {
          ...b,
          width: Math.round(b.width),
          height: Math.round(b.height),
          at: { ...b.at!, y: b.at!.y + 62 },
        }
      : b,
  );
const drawnNarrow = (real: Tab) => pageViewLens(pageEditLens(real), NARROW);

describe('the narrow view draws a wide picture fitted to its column', () => {
  it('fits the zone and its picture to the 756 px column, the stored page untouched', () => {
    const real = page();
    const lens = drawnNarrow(real);
    expect(zoneOf(flowOf(lens).blocks).width).toBeCloseTo(NARROW, 6);
    const img = lens.elements.find((e) => e.id === 'img') as { width: number; height: number };
    expect(img.width).toBeCloseTo(NARROW, 6);
    expect(img.height).toBeCloseTo((420 * NARROW) / 900, 6);
    expect(zoneOf(flowOf(real).blocks)).toBe(ZONE);
  });

  it("stores nothing from the intake's zone fit at the narrow text width", () => {
    const ts = [page()];
    let fitted: Tab | undefined;
    // The intake's tick (useArticleIntake): each zone fitted to its elements at the drawn page's text width.
    const out = through(NARROW)((lifted) =>
      lifted.map((t) => {
        const laid = layOutPages(pagesOf(t));
        const doc = articlesOf(t)['art-1']!;
        const box = articleTextBox(laid, 'art-1', doc.style);
        expect(box.width).toBe(NARROW);
        fitted = withZonesFitted(t, 'art-1', box.width, box.height, laid);
        return fitted;
      }),
    )(ts);
    expect(fitted).toBeDefined();
    expect(out).toBe(ts);
  });
});

describe("Cancel's dirty check (pageEditDirty)", () => {
  it('finds no change after Edit on an untouched page with a wide picture, and the flush stores nothing', () => {
    const ts = [page()];
    const typed = takenFrom(drawnNarrow(ts[0]!));
    // The narrow measure the editor hands back is not the saved one: compared directly it read as a change.
    expect(zoneOf(typed)).toMatchObject({ width: 756, height: 353, at: { y: 262 } });
    expect(pageEditDirty(ts, 't1', 'art-1', typed, through(NARROW))).toBe(false);
    expect(through(NARROW)(withTypedWriting('t1', 'art-1', typed))(ts)).toBe(ts);
  });

  it('finds a real edit made narrow, and its draft keeps every zone at its stored size', () => {
    const ts = [page()];
    const typed = takenFrom(drawnNarrow(ts[0]!));
    typed[0] = para('a', 'Typed at 1,440 px');
    expect(pageEditDirty(ts, 't1', 'art-1', typed, through(NARROW))).toBe(true);
    const saved = through(NARROW)(withTypedWriting('t1', 'art-1', typed))(ts)[0]!;
    const draft = draftOf(saved)!;
    expect(draft.flow.blocks[0]).toEqual(para('a', 'Typed at 1,440 px'));
    expect(zoneOf(draft.flow.blocks)).toEqual(ZONE);
    expect(draft.record.height).toBeUndefined();
    expect(saved.elements).toBe(ts[0]!.elements);
    expect(flowOf(saved)).toBe(flowOf(ts[0]!));
  });

  it('reads a wide window as before: the saved writing is no change, a typed line is one', () => {
    const ts = [page()];
    const typed = flowOf(ts[0]!).blocks.slice();
    expect(pageEditDirty(ts, 't1', 'art-1', typed, through(null))).toBe(false);
    typed[2] = para('b', 'Changed');
    expect(pageEditDirty(ts, 't1', 'art-1', typed, through(null))).toBe(true);
  });

  it('with nothing typed, answers whether the draft already differs', () => {
    const ts = [page()];
    expect(pageEditDirty(ts, 't1', null, null, through(NARROW))).toBe(false);
    expect(pageEditDirty(ts, 'gone', 'art-1', [], through(NARROW))).toBe(false);
    const typed = flowOf(ts[0]!).blocks.slice();
    typed[0] = para('a', 'Drafted');
    const drafted = through(null)(withTypedWriting('t1', 'art-1', typed))(ts);
    expect(pageEditDirty(drafted, 't1', null, null, through(NARROW))).toBe(true);
  });
});

describe('withTypedWriting', () => {
  it('answers the same tabs when the writing is already that, or the page or its article is missing', () => {
    const ts = [page()];
    expect(withTypedWriting('t1', 'art-1', flowOf(ts[0]!).blocks.slice())(ts)).toBe(ts);
    expect(withTypedWriting('t2', 'art-1', [])(ts)).toBe(ts);
    expect(withTypedWriting('t1', 'missing', [])(ts)).toBe(ts);
    const out = withTypedWriting('t1', 'art-1', [para('a', 'New')])(ts);
    expect(flowOf(out[0]!).blocks).toEqual([para('a', 'New')]);
  });
});

describe('throughPageLens', () => {
  const rename = (ts: Tab[]) => ts.map((t) => ({ ...t, name: 'Renamed' }));

  it('runs a map as it is with no page being edited and no page drawn', () => {
    const ts = [page()];
    const out = throughPageLens({ current: null }, { current: null }, rename, viewAt(NARROW))(ts);
    expect(out[0]!.name).toBe('Renamed');
    expect(out[0]!.draft).toBeUndefined();
  });

  it('runs a map on the draft of the page being edited when the page drawn is not narrowed', () => {
    const ts = [page()];
    const typed = flowOf(ts[0]!).blocks.slice();
    typed[0] = para('a', 'Wide');
    const out = throughPageLens(
      editing,
      { current: null },
      withTypedWriting('t1', 'art-1', typed),
      viewAt(NARROW),
    )(ts);
    expect(draftOf(out[0]!)!.flow.blocks[0]).toEqual(para('a', 'Wide'));
    expect(flowOf(out[0]!)).toBe(flowOf(ts[0]!));
  });
});
