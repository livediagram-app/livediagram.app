import { describe, expect, it } from 'vitest';
import {
  A4_LONG_SIDE,
  A4_SHORT_SIDE,
  INFOGRAPHIC_PAGE_GAP,
  MAX_INFOGRAPHIC_PAGES,
  infographicPageAt,
  infographicPageFitBox,
  infographicPagesOf,
  layOutInfographicPages,
  nextInfographicPageId,
  withInfographicPages,
  type InfographicPage,
} from './infographic-page';
import type { Element } from './index';

// Infographic mode's pages (docs/specs/007-editor/editor-modes.md "The pages").
const P = (id: string, orientation: 'portrait' | 'landscape' = 'portrait'): InfographicPage => ({
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

describe('infographic pages', () => {
  it('are A4 at 96 px per inch', () => {
    expect(A4_LONG_SIDE / A4_SHORT_SIDE).toBeCloseTo(297 / 210, 2);
  });

  it('read a tab without pages as one, in its legacy orientation', () => {
    expect(infographicPagesOf(undefined)).toEqual([P('page-1')]);
    expect(infographicPagesOf({ pageOrientation: 'landscape' })).toEqual([
      P('page-1', 'landscape'),
    ]);
    expect(infographicPagesOf({ pages: [], pageOrientation: 'sideways' })).toEqual([P('page-1')]);
    expect(infographicPagesOf({ pages: [P('a'), { id: 1 }, P('b', 'landscape')] })).toEqual([
      P('a'),
      P('b', 'landscape'),
    ]);
    const many = Array.from({ length: MAX_INFOGRAPHIC_PAGES + 3 }, (_, i) => P(`p${i}`));
    expect(infographicPagesOf({ pages: many })).toHaveLength(MAX_INFOGRAPHIC_PAGES);
  });

  it('lay out in a row: the first centred on the origin, each next a gap to the right', () => {
    const [a, b, c] = layOutInfographicPages([P('a'), P('b', 'landscape'), P('c')]);
    expect(a!.rect).toEqual({ x: -397, y: -561.5, width: 794, height: 1123 });
    expect(b!.rect).toEqual({ x: 397 + INFOGRAPHIC_PAGE_GAP, y: -397, width: 1123, height: 794 });
    expect(c!.rect.x).toBe(397 + INFOGRAPHIC_PAGE_GAP + 1123 + INFOGRAPHIC_PAGE_GAP);
    expect(c!.index).toBe(2);
  });

  it('frame the first page in either orientation with one square fit box', () => {
    const box = infographicPageFitBox();
    for (const o of ['portrait', 'landscape'] as const) {
      const r = layOutInfographicPages([P('a', o)])[0]!.rect;
      expect(r.x).toBeGreaterThanOrEqual(box.x);
      expect(r.y).toBeGreaterThanOrEqual(box.y);
      expect(r.x + r.width).toBeLessThanOrEqual(box.x + box.width);
      expect(r.y + r.height).toBeLessThanOrEqual(box.y + box.height);
    }
  });

  it('find the page under a point', () => {
    const pages = layOutInfographicPages([P('a'), P('b')]);
    expect(infographicPageAt(pages, { x: 0, y: 0 })?.id).toBe('a');
    expect(infographicPageAt(pages, { x: 397 + INFOGRAPHIC_PAGE_GAP / 2, y: 0 })).toBeUndefined();
    expect(infographicPageAt(pages, { x: 397 + INFOGRAPHIC_PAGE_GAP + 10, y: 0 })?.id).toBe('b');
  });

  it('name a new page uniquely', () => {
    expect(nextInfographicPageId([P('page-1')])).toBe('page-2');
    expect(nextInfographicPageId([P('page-1'), P('page-3')])).toBe('page-4');
    expect(nextInfographicPageId([P('page-2'), P('page-3')])).toBe('page-4');
  });
});

describe('withInfographicPages', () => {
  const second = 397 + INFOGRAPHIC_PAGE_GAP + 397; // the second portrait page's centre x

  it('adds a page, leaving every element where it was', () => {
    const tab = { elements: [box('a', 0, 0)], pageOrientation: 'portrait' as const };
    const next = withInfographicPages(tab, [P('page-1'), P('page-2')]);
    expect(next.pages).toEqual([P('page-1'), P('page-2')]);
    expect(next.elements).toEqual(tab.elements);
    expect('pageOrientation' in next).toBe(false);
  });

  it('moves the pages after a turned page, and their elements with them', () => {
    const tab = {
      elements: [box('on-first', 0, 0), box('on-second', second, 100), box('off', 0, 5000)],
      pages: [P('a'), P('b')],
    };
    const next = withInfographicPages(tab, [P('a', 'landscape'), P('b')]);
    // The first page turns about the origin, so it grows half the difference on each side.
    const dx = (A4_LONG_SIDE - A4_SHORT_SIDE) / 2;
    expect(centreOf(next.elements[0]!)).toEqual({ x: 0, y: 0 });
    expect(centreOf(next.elements[1]!)).toEqual({ x: second + dx, y: 100 });
    expect(centreOf(next.elements[2]!)).toEqual({ x: 0, y: 5000 });
  });

  it('keeps a turned page centred on its content', () => {
    const tab = { elements: [box('on-second', second, 0)], pages: [P('a'), P('b')] };
    const next = withInfographicPages(tab, [P('a'), P('b', 'landscape')]);
    const b = layOutInfographicPages(next.pages)[1]!.rect;
    expect(centreOf(next.elements[0]!)!.x).toBe(b.x + b.width / 2);
  });

  it('closes the gap a removed page leaves, leaving its own elements behind', () => {
    const third = second + 397 + INFOGRAPHIC_PAGE_GAP + 397;
    const tab = {
      elements: [box('on-second', second, 0), box('on-third', third, 0)],
      pages: [P('a'), P('b'), P('c')],
    };
    const next = withInfographicPages(tab, [P('a'), P('c')]);
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
    const next = withInfographicPages({ elements: [arrow], pages: [P('a'), P('b')] }, [
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
