import { describe, expect, it } from 'vitest';
import { contentClusters, withContentPaginated } from './illustrate-paginate';
import { elementIdsOnPage } from './illustrate-page-content';
import { layOutIllustratePages, MAX_ILLUSTRATE_PAGES } from './illustrate-page';
import type { Element } from './index';

// docs/specs/007-editor/illustrate-pages.md "Into pages".
const box = (id: string, x: number, y: number, w = 100, h = 60) =>
  ({ id, type: 'shape', shape: 'square', x, y, width: w, height: h }) as Element;
const arrow = (id: string, from: string, to: string) =>
  ({
    id,
    type: 'arrow',
    from: { kind: 'pinned', elementId: from, anchor: 'e' },
    to: { kind: 'pinned', elementId: to, anchor: 'w' },
  }) as Element;

describe('contentClusters', () => {
  it('joins what arrows connect and what sits close, in reading order', () => {
    const els = [
      box('b1', 3000, 0),
      box('b2', 3600, 0),
      arrow('ab', 'b1', 'b2'),
      box('a1', 0, 0),
      box('a2', 150, 0),
      box('c1', 0, 2000),
    ];
    expect(contentClusters(els)).toEqual([['a1', 'a2'], ['b1', 'b2', 'ab'], ['c1']]);
  });
});

describe('withContentPaginated', () => {
  it('gives each cluster a page, turned to its shape, fitted inside it', () => {
    const tab = {
      elements: [
        box('wide1', 3000, 0, 1600, 200),
        box('tall1', 0, 3000, 100, 900),
        box('tall2', 0, 4000, 100, 900),
      ],
    };
    const out = withContentPaginated(tab)!;
    expect(out.pages.map((p) => p.orientation)).toEqual(['landscape', 'portrait']);
    const laid = layOutIllustratePages(out.pages);
    expect([...elementIdsOnPage(out.elements, laid, laid[0]!.id)]).toEqual(['wide1']);
    expect([...elementIdsOnPage(out.elements, laid, laid[1]!.id)].sort()).toEqual([
      'tall1',
      'tall2',
    ]);
    for (const el of out.elements as (Element & { x: number; width: number })[]) {
      const page = laid.find((p) => elementIdsOnPage(out.elements, laid, p.id).has(el.id))!;
      expect(el.x).toBeGreaterThanOrEqual(page.rect.x);
      expect(el.x + el.width).toBeLessThanOrEqual(page.rect.x + page.rect.width);
    }
  });

  it('lays out content that spills over the first page onto one page, fitted', () => {
    const out = withContentPaginated({ elements: [box('big', -600, -100, 1200, 200)] })!;
    expect(out.pages.map((p) => p.orientation)).toEqual(['landscape']);
  });

  it('leaves alone a tab already inside its first page, or one with nothing', () => {
    expect(withContentPaginated({ elements: [box('a', -50, -30)] })).toBeNull();
    expect(withContentPaginated({ elements: [], pages: [] })).toBeNull();
  });

  it('with pages stored, lays out only what is on no page: afresh when every page is empty', () => {
    const out = withContentPaginated({
      elements: [box('a', 5000, 0, 60, 200)],
      pages: [{ id: 'page-1', orientation: 'landscape' }],
    })!;
    expect(out.pages.map((p) => p.orientation)).toEqual(['portrait']);
  });

  it('with pages stored and in use, adds pages after them for stray content', () => {
    const out = withContentPaginated({
      elements: [box('kept', -50, -30), box('stray', 5000, 0)],
      pages: [{ id: 'page-1', orientation: 'portrait' }],
    })!;
    expect(out.pages.map((p) => p.id)[0]).toBe('page-1');
    expect(out.pages).toHaveLength(2);
    expect(out.elements[0]).toMatchObject({ x: -50, y: -30 });
    const laid = layOutIllustratePages(out.pages);
    expect([...elementIdsOnPage(out.elements, laid, laid[1]!.id)]).toEqual(['stray']);
  });

  it('counts a cluster mostly off the pages as stray, and keeps one mostly on', () => {
    // Page 1 spans x -397..397: 'half' pokes 80% past its right edge, 'bleed' only 20%.
    const tab = {
      elements: [box('kept', -50, -30), box('half', 300, 300, 500, 100)],
      pages: [{ id: 'page-1', orientation: 'portrait' as const }],
    };
    expect(withContentPaginated(tab)!.pages).toHaveLength(2);
    const bleed = { ...tab, elements: [tab.elements[0]!, box('bleed', 0, 300, 500, 100)] };
    expect(withContentPaginated(bleed)).toBeNull();
  });

  it('counts a lone straight line on a page as on it', () => {
    const line = {
      id: 'rule',
      type: 'arrow',
      from: { kind: 'free', x: -200, y: 0 },
      to: { kind: 'free', x: 200, y: 0 },
    } as Element;
    expect(
      withContentPaginated({
        elements: [line],
        pages: [{ id: 'page-1', orientation: 'portrait' }],
      }),
    ).toBeNull();
  });

  it('at the page limit, fits stray content onto the last page instead of adding one', () => {
    const pages = Array.from({ length: MAX_ILLUSTRATE_PAGES }, (_, i) => ({
      id: `p${i}`,
      orientation: 'portrait' as const,
    }));
    const out = withContentPaginated({
      elements: [box('kept', -50, -30), box('stray', 0, 9000)],
      pages,
    })!;
    expect(out.pages).toHaveLength(MAX_ILLUSTRATE_PAGES);
    const laid = layOutIllustratePages(out.pages);
    expect(elementIdsOnPage(out.elements, laid, `p${MAX_ILLUSTRATE_PAGES - 1}`).has('stray')).toBe(
      true,
    );
  });
});

describe('withContentPaginated: how many pages', () => {
  it('lays content out onto at most twenty new pages', () => {
    const many = Array.from({ length: 30 }, (_, i) => box(`b${i}`, i * 2000, 9000));
    const out = withContentPaginated({
      elements: many,
      pages: [{ id: 'p0', orientation: 'portrait' }],
    })!;
    // Nothing was on the one page, so the tab is laid out afresh: twenty pages, no more.
    expect(out.pages).toHaveLength(20);
  });
});

describe('into pages never loses an article', () => {
  it('keeps article pages when every element is stray', () => {
    const tab = {
      elements: [
        { id: 's', type: 'shape', shape: 'square', x: 9000, y: 9000, width: 40, height: 40 },
      ] as Element[],
      pages: [{ id: 'a', orientation: 'portrait' as const, kind: 'article' as const, flow: 'f' }],
      articles: { f: { blocks: [{ id: 'b', type: 'paragraph' as const, runs: [] }] } },
    };
    const out = withContentPaginated(tab)!;
    expect(out.pages.some((p) => p.flow === 'f')).toBe(true);
  });
});
