import { describe, expect, it } from 'vitest';
import {
  offersPageKindChoice,
  pageUnits,
  withPageKindChosen,
  withArticleAdded,
  withArticleDuplicated,
  withArticlePageCount,
  withArticleRemoved,
  withUnitMoved,
} from './article-pages';
import { articlesOf } from './article-flow';
import { absentWriterPageCount } from './article-pages';
import { pagesOf, layOutPages, type Page } from './page';
import type { Element } from './index';

const I = (id: string): Page => ({ id, orientation: 'portrait' });
const D = (id: string, flow: string): Page => ({
  id,
  orientation: 'portrait',
  kind: 'article',
  flow,
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
const centreOn = (pages: Page[], pageId: string) => {
  const r = layOutPages(pages).find((p) => p.id === pageId)!.rect;
  return { x: r.x + 100, y: r.y + 100 };
};

describe('articles in the row', () => {
  it('read the row as units', () => {
    expect(pageUnits([I('a'), D('b', 'f'), D('c', 'f'), I('d'), D('e', 'g')])).toEqual([
      { pageIds: ['a'] },
      { pageIds: ['b', 'c'], flow: 'f' },
      { pageIds: ['d'] },
      { pageIds: ['e'], flow: 'g' },
    ]);
  });

  it('add an article with a title and a paragraph', () => {
    const tab = withArticleAdded({ elements: [], pages: [I('a')] }, I('n'), 'f')!;
    expect(tab.pages.map((p) => p.id)).toEqual(['a', 'n']);
    expect(tab.pages[1]).toEqual(D('n', 'f'));
    expect(articlesOf(tab)['f']!.blocks).toHaveLength(2);
  });

  it('remove an article with its pages, content and writing', () => {
    const pages = [I('a'), D('b', 'f'), D('c', 'f')];
    const on = centreOn(pages, 'c');
    const tab = { elements: [box('x', on.x, on.y)], pages, articles: { f: { blocks: [] } } };
    const out = withArticleRemoved(tab, 'f')!;
    expect(pagesOf(out).map((p) => p.id)).toEqual(['a']);
    expect(out.elements).toEqual([]);
    expect(out.articles).toBeUndefined();
    expect(withArticleRemoved({ elements: [], pages: [D('b', 'f')] }, 'f')).toBeNull();
  });

  it('move a whole article as one', () => {
    const tab = { elements: [], pages: [D('b', 'f'), D('c', 'f'), I('a')] };
    expect(withUnitMoved(tab, 'c', 1)!.pages.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(withUnitMoved(tab, 'a', 0)!.pages.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(withUnitMoved(tab, 'b', 0)).toBeNull();
  });

  it('duplicate an article after itself, its writing and content copied', () => {
    const pages = [D('b', 'f'), D('c', 'f'), I('a')];
    const on = centreOn(pages, 'c');
    const tab = {
      elements: [box('x', on.x, on.y)],
      pages,
      articles: {
        f: {
          blocks: [
            {
              id: 'z',
              type: 'zone',
              zone: 'drawing',
              width: 100,
              height: 100,
              at: { page: 'c', x: 0, y: 0 },
            },
          ],
        },
      },
    };
    const out = withArticleDuplicated(tab, 'f', 'g')!;
    const ids = out.pages.map((p) => p.flow ?? p.id);
    expect(ids).toEqual(['f', 'f', 'g', 'g', 'a']);
    expect(out.elements).toHaveLength(2);
    const copy = articlesOf(out)['g']!.blocks[0]!;
    expect(copy.id).not.toBe('z');
    const copiedPage = out.pages[3]!.id;
    expect(copy.type === 'zone' && copy.at?.page).toBe(copiedPage);
    // The copy sits on the copied page, as the original on its own.
    const laid = layOutPages(out.pages);
    const r = laid[3]!.rect;
    const el = out.elements[1] as Extract<Element, { x: number }>;
    expect(el.x + 10).toBeCloseTo(r.x + 100);
  });

  it('grow and shrink an article to the pages its writing reaches, keeping pages with content', () => {
    const tab = { elements: [] as Element[], pages: [I('a'), D('b', 'f'), I('z')] };
    const grown = withArticlePageCount(tab, 'f', 3);
    expect(grown.pages.map((p) => p.flow ?? p.id)).toEqual(['a', 'f', 'f', 'f', 'z']);
    const third = grown.pages[3]!.id;
    expect(withArticlePageCount(grown, 'f', 1).pages.map((p) => p.flow ?? p.id)).toEqual([
      'a',
      'f',
      'z',
    ]);
    const on = centreOn(grown.pages, third);
    const busy = { ...grown, elements: [box('x', on.x, on.y)] };
    expect(withArticlePageCount(busy, 'f', 1).pages.map((p) => p.flow ?? p.id)).toEqual([
      'a',
      'f',
      'f',
      'f',
      'z',
    ]);
    expect(withArticlePageCount(tab, 'f', 1)).toBe(tab);
  });
});

describe("the first page's own choice of kind", () => {
  const only = [{ id: 'p1', orientation: 'portrait' as const }];
  it('is offered while the only page is unchosen and empty', () => {
    expect(offersPageKindChoice(only, 'p1', 0)).toBe(true);
    expect(offersPageKindChoice(only, 'p1', 2)).toBe(false);
    expect(offersPageKindChoice([{ ...only[0]!, kind: 'infographic' }], 'p1', 0)).toBe(false);
    expect(offersPageKindChoice([...only, { id: 'p2', orientation: 'portrait' }], 'p1', 0)).toBe(
      false,
    );
  });
  it('keeps an infographic page chosen, or makes the page an article', () => {
    const tab = { elements: [], pages: only };
    expect(withPageKindChosen(tab, 'p1', 'infographic', 'f')!.pages[0]!.kind).toBe('infographic');
    const art = withPageKindChosen(tab, 'p1', 'article', 'f')!;
    expect(art.pages[0]).toMatchObject({ kind: 'article', flow: 'f' });
    expect(articlesOf(art).f!.blocks.length).toBeGreaterThan(0);
    expect(withPageKindChosen(art, 'p1', 'article', 'g')).toBeNull();
  });
  // docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The continuous page".
  it('gives an article chosen on a page of any size the continuous page', () => {
    for (const from of [
      { orientation: 'landscape', size: 'slide' },
      { size: 'square' },
      {},
    ] as Partial<Page>[]) {
      const pages = [{ ...only[0]!, ...from }] as Page[];
      const art = withPageKindChosen({ elements: [], pages }, 'p1', 'article', 'f')!;
      expect(art.pages[0]).toMatchObject({ size: 'fit', orientation: 'portrait', kind: 'article' });
      expect(art.pages[0]!.fit!.width).toBe(820);
    }
  });
  it('turns the page into a 16:9 landscape slide, keeping its name and background', () => {
    const named = [
      { ...only[0]!, name: 'Intro', background: { fill: { kind: 'solid', color: '#0f172a' } } },
    ] as Page[];
    const slide = withPageKindChosen({ elements: [], pages: named }, 'p1', 'slide', 'f')!;
    expect(slide.pages).toEqual([
      {
        id: 'p1',
        orientation: 'landscape',
        size: 'slide',
        kind: 'slide',
        name: 'Intro',
        background: { fill: { kind: 'solid', color: '#0f172a' } },
      },
    ]);
    expect(withPageKindChosen(slide, 'p1', 'slide', 'g')).toBeNull();
  });
});

describe('a duplicated article keeps its margin notes to itself', () => {
  it('points the copy at the copies of its markers', () => {
    const pages = [D('p', 'f')];
    const r = layOutPages(pages)[0]!.rect;
    const marker = {
      ...box('m1', r.x + r.width - 40, r.y + 120),
      type: 'article-note',
      articleNote: 'comment',
    } as unknown as Element;
    const tab = {
      elements: [marker],
      pages,
      articles: {
        f: {
          blocks: [{ id: 'b', type: 'paragraph' as const, runs: [{ text: 'hi', note: 'm1' }] }],
        },
      },
    };
    const out = withArticleDuplicated(tab, 'f', 'g')!;
    const copyMarker = out.elements.find((e) => e.id !== 'm1')!;
    const run = (articlesOf(out)['g']!.blocks[0] as { runs: { note?: string }[] }).runs[0]!;
    expect(run.note).toBe(copyMarker.id);
    const original = (articlesOf(out)['f']!.blocks[0] as { runs: { note?: string }[] }).runs[0]!;
    expect(original.note).toBe('m1');
  });
});

describe('growing an article for an absent writer', () => {
  const base = { local: false, pending: true, needed: 3, have: 1, locked: false, floor: null };

  it('grows only when waiting to, short of pages, unlocked and not the writer', () => {
    expect(absentWriterPageCount(base)).toBe(3);
    expect(absentWriterPageCount({ ...base, local: true })).toBeNull();
    expect(absentWriterPageCount({ ...base, pending: false })).toBeNull();
    expect(absentWriterPageCount({ ...base, locked: true })).toBeNull();
    expect(absentWriterPageCount({ ...base, needed: 1 })).toBeNull();
    expect(absentWriterPageCount({ ...base, needed: 0, have: 2 })).toBeNull();
  });

  it('once grown, settles the pages it added: more, fewer, never under its floor', () => {
    // Grown from 1 to 3: measured on 3 real pages it needs 4 (a footnote's room), or 2 (a page over).
    expect(absentWriterPageCount({ ...base, have: 3, needed: 4, floor: 1 })).toBe(4);
    expect(absentWriterPageCount({ ...base, have: 3, needed: 2, floor: 1 })).toBe(2);
    // Never under the pages it found, and nothing when it already fits.
    expect(absentWriterPageCount({ ...base, have: 4, needed: 1, floor: 2 })).toBe(2);
    expect(absentWriterPageCount({ ...base, have: 2, needed: 1, floor: 2 })).toBeNull();
    expect(absentWriterPageCount({ ...base, have: 3, needed: 3, floor: 1 })).toBeNull();
    expect(
      absentWriterPageCount({ ...base, have: 3, needed: 2, floor: 1, locked: true }),
    ).toBeNull();
  });
});
