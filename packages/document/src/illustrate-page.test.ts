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
  pageDimensions,
  pageHasOrientation,
  pageLabel,
  rowAnchorOf,
  withIllustratePages,
  type IllustratePage,
} from './illustrate-page';
import { FIT_PAGE_MAX_SIDE, FIT_PAGE_MIN_SIDE } from './illustrate-page-fit';
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

  it('frame a page by the page itself, so it fills the screen whatever its shape', () => {
    for (const o of ['portrait', 'landscape'] as const) {
      const page = layOutIllustratePages([P('a', o)])[0]!;
      expect(illustratePageFitBox(page)).toEqual(page.rect);
    }
    // With no page, a square of an A4 long side at the origin.
    const box = illustratePageFitBox();
    expect(box.width).toBe(box.height);
    expect(box.x + box.width / 2).toBe(0);
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

// docs/specs/007-editor/illustrate-pages.md "A page", "Sizes": Fit to Content and the row anchor.
describe('Fit to Content pages', () => {
  const fit = (extra: Record<string, unknown> = {}) => ({
    id: 'f',
    orientation: 'landscape',
    size: 'fit',
    fit: { width: 2400.4, height: 1300 },
    ...extra,
  });

  it('reads its own sides, rounded, and lays out at them', () => {
    const [page] = illustratePagesOf({ pages: [fit()] });
    expect(page).toMatchObject({ size: 'fit', fit: { width: 2400, height: 1300 } });
    expect(pageDimensions(page!)).toEqual({ width: 2400, height: 1300 });
    expect(layOutIllustratePages([page!])[0]!.rect).toEqual({
      x: -1200,
      y: -650,
      width: 2400,
      height: 1300,
    });
  });

  it('clamps its sides to the limits', () => {
    const [page] = illustratePagesOf({ pages: [fit({ fit: { width: 99_999, height: 10 } })] });
    expect(page!.fit).toEqual({ width: FIT_PAGE_MAX_SIDE, height: FIT_PAGE_MIN_SIDE });
  });

  it('reads as A4 without valid sides, or on an article page', () => {
    for (const sides of [undefined, { width: 0, height: 10 }, { width: 'x', height: 1 }, 5]) {
      const [page] = illustratePagesOf({ pages: [fit({ fit: sides })] });
      expect(page!.size).toBeUndefined();
      expect(page!.fit).toBeUndefined();
    }
    const [doc] = illustratePagesOf({ pages: [fit({ kind: 'article', flow: 'd' })] });
    expect(doc!.size).toBeUndefined();
  });

  it('keeps an explicit infographic kind', () => {
    const [page] = illustratePagesOf({ pages: [fit({ kind: 'infographic' })] });
    expect(page).toMatchObject({ size: 'fit', kind: 'infographic' });
  });

  it('has no orientation and says Fit to Content', () => {
    const [page] = illustratePagesOf({ pages: [fit()] });
    expect(pageHasOrientation(page!)).toBe(false);
    expect(pageLabel(page!, 0, 1)).toBe('Fit to Content · Infographic');
  });
});

describe('the row anchor', () => {
  it('centres the first page on it, the rest following in the row', () => {
    const pages = illustratePagesOf({
      pages: [P('a'), { ...P('b'), rowAt: { x: 1000.6, y: -40 } }],
    });
    const laid = layOutIllustratePages(pages);
    expect(laid[0]!.rect.x + laid[0]!.rect.width / 2).toBe(1001);
    expect(laid[0]!.rect.y + laid[0]!.rect.height / 2).toBe(-40);
    expect(laid[1]!.rect.x).toBe(laid[0]!.rect.x + laid[0]!.rect.width + ILLUSTRATE_PAGE_GAP);
  });

  it('counts only the first page carrying one, and ignores a malformed one', () => {
    const pages = illustratePagesOf({
      pages: [
        { ...P('a'), rowAt: { x: 'no', y: 0 } },
        { ...P('b'), rowAt: { x: 10, y: 20 } },
        { ...P('c'), rowAt: { x: 99, y: 99 } },
      ],
    });
    expect(pages.map((p) => p.rowAt)).toEqual([undefined, { x: 10, y: 20 }, undefined]);
    expect(rowAnchorOf(pages)).toEqual({ x: 10, y: 20 });
    expect(rowAnchorOf([P('z')])).toEqual({ x: 0, y: 0 });
  });

  it('stays put when the page carrying it is deleted', () => {
    const tab = {
      elements: [] as Element[],
      pages: [{ ...P('a'), rowAt: { x: 500, y: 500 } }, P('b')],
    };
    const out = withIllustratePages(tab, [P('b')]);
    expect(out.pages[0]!.rowAt).toEqual({ x: 500, y: 500 });
  });
});
