import { describe, expect, it } from 'vitest';
import {
  A4_LONG_SIDE,
  A4_SHORT_SIDE,
  ILLUSTRATE_PAGE_GAP,
  MAX_ILLUSTRATE_PAGES,
  illustratePageAt,
  isArticlePage,
  pageKindOf,
  illustratePageFitBox,
  illustratePagesOf,
  layOutIllustratePages,
  nextIllustratePageId,
  withIllustratePages,
  type IllustratePage,
} from './illustrate-page';
import type { Element } from './index';

// Illustrate mode's pages (docs/specs/007-editor/editor-modes.md "The pages").
const P = (id: string, orientation: 'portrait' | 'landscape' = 'portrait'): IllustratePage => ({
  id,
  orientation,
});
const box = (id: string, cx: number, cy: number) =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x: cx - 10,
    y: cy - 10,
    width: 20,
    height: 20,
  }) as Element;
const centreOf = (el: Element) =>
  el.type === 'arrow' ? null : { x: el.x + el.width / 2, y: el.y + el.height / 2 };

describe('Illustrate pages', () => {
  it('are A4 at 96 px per inch', () => {
    expect(A4_LONG_SIDE / A4_SHORT_SIDE).toBeCloseTo(297 / 210, 2);
  });

  it('read a tab without pages as one, in its legacy orientation', () => {
    expect(illustratePagesOf(undefined)).toEqual([P('page-1')]);
    expect(illustratePagesOf({ pageOrientation: 'landscape' })).toEqual([P('page-1', 'landscape')]);
    expect(illustratePagesOf({ pages: [], pageOrientation: 'sideways' })).toEqual([P('page-1')]);
    expect(illustratePagesOf({ pages: [P('a'), { id: 1 }, P('b', 'landscape')] })).toEqual([
      P('a'),
      P('b', 'landscape'),
    ]);
    const many = Array.from({ length: MAX_ILLUSTRATE_PAGES + 3 }, (_, i) => P(`p${i}`));
    expect(illustratePagesOf({ pages: many })).toHaveLength(MAX_ILLUSTRATE_PAGES);
  });

  it('lay out in a row: the first centred on the origin, each next a gap to the right', () => {
    const [a, b, c] = layOutIllustratePages([P('a'), P('b', 'landscape'), P('c')]);
    expect(a!.rect).toEqual({ x: -397, y: -561.5, width: 794, height: 1123 });
    expect(b!.rect).toEqual({ x: 397 + ILLUSTRATE_PAGE_GAP, y: -397, width: 1123, height: 794 });
    expect(c!.rect.x).toBe(397 + ILLUSTRATE_PAGE_GAP + 1123 + ILLUSTRATE_PAGE_GAP);
    expect(c!.index).toBe(2);
  });

  it('frame the first page in either orientation with one square fit box', () => {
    const box = illustratePageFitBox();
    for (const o of ['portrait', 'landscape'] as const) {
      const r = layOutIllustratePages([P('a', o)])[0]!.rect;
      expect(r.x).toBeGreaterThanOrEqual(box.x);
      expect(r.y).toBeGreaterThanOrEqual(box.y);
      expect(r.x + r.width).toBeLessThanOrEqual(box.x + box.width);
      expect(r.y + r.height).toBeLessThanOrEqual(box.y + box.height);
    }
  });

  it('find the page under a point', () => {
    const pages = layOutIllustratePages([P('a'), P('b')]);
    expect(illustratePageAt(pages, { x: 0, y: 0 })?.id).toBe('a');
    expect(illustratePageAt(pages, { x: 397 + ILLUSTRATE_PAGE_GAP / 2, y: 0 })).toBeUndefined();
    expect(illustratePageAt(pages, { x: 397 + ILLUSTRATE_PAGE_GAP + 10, y: 0 })?.id).toBe('b');
  });

  it('name a new page uniquely, never reusing a page number', () => {
    const pages = [P('page-1'), P('page-2')];
    const id = nextIllustratePageId(pages);
    expect(id).toMatch(/^page-[0-9a-f]{8}$/);
    expect(pages.some((p) => p.id === id)).toBe(false);
    // A deleted page-3's id never comes back for the next page (a page slide may still name it).
    expect(nextIllustratePageId(pages)).not.toBe('page-3');
  });
});

describe('withIllustratePages', () => {
  const second = 397 + ILLUSTRATE_PAGE_GAP + 397; // the second portrait page's centre x

  it('adds a page, leaving every element where it was', () => {
    const tab = { elements: [box('a', 0, 0)], pageOrientation: 'portrait' as const };
    const next = withIllustratePages(tab, [P('page-1'), P('page-2')]);
    expect(next.pages).toEqual([P('page-1'), P('page-2')]);
    expect(next.elements).toEqual(tab.elements);
    expect('pageOrientation' in next).toBe(false);
  });

  it('moves the pages after a turned page, and their elements with them', () => {
    const tab = {
      elements: [box('on-first', 0, 0), box('on-second', second, 100), box('off', 0, 5000)],
      pages: [P('a'), P('b')],
    };
    const next = withIllustratePages(tab, [P('a', 'landscape'), P('b')]);
    // The first page turns about the origin, so it grows half the difference on each side.
    const dx = (A4_LONG_SIDE - A4_SHORT_SIDE) / 2;
    expect(centreOf(next.elements[0]!)).toEqual({ x: 0, y: 0 });
    expect(centreOf(next.elements[1]!)).toEqual({ x: second + dx, y: 100 });
    expect(centreOf(next.elements[2]!)).toEqual({ x: 0, y: 5000 });
  });

  it('keeps a turned page centred on its content', () => {
    const tab = { elements: [box('on-second', second, 0)], pages: [P('a'), P('b')] };
    const next = withIllustratePages(tab, [P('a'), P('b', 'landscape')]);
    const b = layOutIllustratePages(next.pages)[1]!.rect;
    expect(centreOf(next.elements[0]!)!.x).toBe(b.x + b.width / 2);
  });

  it('closes the gap a removed page leaves, leaving its own elements behind', () => {
    const third = second + 397 + ILLUSTRATE_PAGE_GAP + 397;
    const tab = {
      elements: [box('on-second', second, 0), box('on-third', third, 0)],
      pages: [P('a'), P('b'), P('c')],
    };
    const next = withIllustratePages(tab, [P('a'), P('c')]);
    expect(centreOf(next.elements[0]!)).toEqual({ x: second, y: 0 });
    expect(centreOf(next.elements[1]!)).toEqual({ x: second, y: 0 });
  });

  it('moves the free ends of an arrow with their page, not its pinned ends', () => {
    const arrow = {
      id: 'ar',
      type: 'arrow',
      from: { kind: 'free', x: second, y: 0 },
      to: { kind: 'pinned', elementId: 'x', anchor: 'top' },
    } as unknown as Element;
    const next = withIllustratePages({ elements: [arrow], pages: [P('a'), P('b')] }, [
      P('a', 'landscape'),
      P('b'),
    ]);
    const moved = next.elements[0] as Extract<Element, { type: 'arrow' }>;
    expect(moved.from).toEqual({
      kind: 'free',
      x: second + (A4_LONG_SIDE - A4_SHORT_SIDE) / 2,
      y: 0,
    });
    expect(moved.to).toBe(arrow.type === 'arrow' ? arrow.to : null);
  });
});

describe('page kinds', () => {
  const D = (id: string, flow?: string, extra: Partial<IllustratePage> = {}): IllustratePage => ({
    id,
    orientation: 'portrait',
    kind: 'article',
    ...(flow ? { flow } : {}),
    ...extra,
  });

  it('read a page with no kind as an infographic, and an article page with its flow', () => {
    const [a, b, c] = illustratePagesOf({
      pages: [P('a'), D('b', 'art-1'), { ...P('c'), kind: 'poster', flow: 'art-9' }],
    });
    expect(pageKindOf(a!)).toBe('infographic');
    expect(b).toEqual(D('b', 'art-1'));
    expect(c).toEqual(P('c'));
  });

  it('read an article page with no flow as an article of its own', () => {
    expect(illustratePagesOf({ pages: [D('b')] })).toEqual([D('b', 'b')]);
  });

  it("keep a document's pages together, each like its first", () => {
    const pages = illustratePagesOf({
      pages: [
        D('d1', 'doc', { size: 'letter' }),
        P('x'),
        D('d2', 'doc', { orientation: 'landscape', background: { pattern: 'dots' } }),
        P('y'),
      ],
    });
    expect(pages.map((p) => p.id)).toEqual(['d1', 'd2', 'x', 'y']);
    expect(pages[1]).toEqual(D('d2', 'doc', { size: 'letter' }));
    expect(isArticlePage(pages[1]!)).toBe(true);
  });

  it('give back the same pages when a document is already together', () => {
    const stored = [P('x'), D('d1', 'doc'), D('d2', 'doc')];
    const read = illustratePagesOf({ pages: stored });
    expect(read).toEqual(stored);
  });
});
