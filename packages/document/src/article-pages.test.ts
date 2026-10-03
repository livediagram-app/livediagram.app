import { describe, expect, it } from 'vitest';
import {
  pageUnits,
  withArticleAdded,
  withArticleDuplicated,
  withArticlePageCount,
  withArticleRemoved,
  withUnitMoved,
} from './article-pages';
import { articlesOf } from './article-flow';
import { illustratePagesOf, layOutIllustratePages, type IllustratePage } from './illustrate-page';
import type { Element } from './index';

const I = (id: string): IllustratePage => ({ id, orientation: 'portrait' });
const D = (id: string, flow: string): IllustratePage => ({
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
const centreOn = (pages: IllustratePage[], pageId: string) => {
  const r = layOutIllustratePages(pages).find((p) => p.id === pageId)!.rect;
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
    expect(illustratePagesOf(out).map((p) => p.id)).toEqual(['a']);
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
    const laid = layOutIllustratePages(out.pages);
    const r = laid[3]!.rect;
    const el = out.elements[1] as Extract<Element, { x: number }>;
    expect(el.x + 10).toBeCloseTo(r.x + 100);
  });

  it('grow and shrink an article to the pages its writing reaches, keeping pages with content', () => {
    const tab = { elements: [] as Element[], pages: [I('a'), D('b', 'f'), I('z')] };
    const grown = withArticlePageCount(tab, 'f', 3);
    expect(grown.pages!.map((p) => p.flow ?? p.id)).toEqual(['a', 'f', 'f', 'f', 'z']);
    const third = (grown.pages as IllustratePage[])[3]!.id;
    expect(withArticlePageCount(grown, 'f', 1).pages!.map((p) => p.flow ?? p.id)).toEqual([
      'a',
      'f',
      'z',
    ]);
    const on = centreOn(grown.pages as IllustratePage[], third);
    const busy = { ...grown, elements: [box('x', on.x, on.y)] };
    expect(withArticlePageCount(busy, 'f', 1).pages!.map((p) => p.flow ?? p.id)).toEqual([
      'a',
      'f',
      'f',
      'f',
      'z',
    ]);
    expect(withArticlePageCount(tab, 'f', 1)).toBe(tab);
  });
});
