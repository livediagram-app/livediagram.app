import { describe, expect, it } from 'vitest';
import { contentClusters, withContentPaginated } from './infographic-paginate';
import { elementIdsOnPage } from './infographic-page-content';
import { layOutInfographicPages } from './infographic-page';
import type { Element } from './index';

// docs/specs/007-editor/infographic-pages.md "Into pages".
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
    const laid = layOutInfographicPages(out.pages);
    expect([...elementIdsOnPage(out.elements, laid, 'page-1')]).toEqual(['wide1']);
    expect([...elementIdsOnPage(out.elements, laid, 'page-2')].sort()).toEqual(['tall1', 'tall2']);
    for (const el of out.elements as (Element & { x: number; width: number })[]) {
      const page = laid.find((p) => elementIdsOnPage(out.elements, laid, p.id).has(el.id))!;
      expect(el.x).toBeGreaterThanOrEqual(page.rect.x);
      expect(el.x + el.width).toBeLessThanOrEqual(page.rect.x + page.rect.width);
    }
  });

  it('lays out content that spills over the first page onto one page, fitted', () => {
    const out = withContentPaginated({ elements: [box('big', -600, -100, 1200, 200)] })!;
    expect(out.pages).toEqual([{ id: 'page-1', orientation: 'landscape' }]);
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
    expect(out.pages).toEqual([{ id: 'page-1', orientation: 'portrait' }]);
  });

  it('with pages stored and in use, adds pages after them for stray content', () => {
    const out = withContentPaginated({
      elements: [box('kept', -50, -30), box('stray', 5000, 0)],
      pages: [{ id: 'page-1', orientation: 'portrait' }],
    })!;
    expect(out.pages.map((p) => p.id)).toEqual(['page-1', 'page-2']);
    expect(out.elements[0]).toMatchObject({ x: -50, y: -30 });
    const laid = layOutInfographicPages(out.pages);
    expect([...elementIdsOnPage(out.elements, laid, 'page-2')]).toEqual(['stray']);
  });
});
