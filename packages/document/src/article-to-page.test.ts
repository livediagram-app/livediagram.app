import { describe, expect, it } from 'vitest';
import { articleBlocksAsRuns, withArticlesAsPages } from './article-to-page';
import type { ArticleBlock } from './article-flow';
import type { IllustratePage } from './illustrate-page';
import type { Element, ShapeElement } from './index';

const blocks: ArticleBlock[] = [
  { id: 't', type: 'paragraph', style: 'title', runs: [{ text: 'Plan' }] },
  { id: 'p', type: 'paragraph', runs: [{ text: 'Hello ' }, { text: 'world', b: true }] },
  { id: 'h', type: 'paragraph', style: 'h2', runs: [{ text: 'Goals' }] },
  { id: 'l1', type: 'list', list: 'bullet', runs: [{ text: 'One' }] },
  { id: 'l2', type: 'list', list: 'numbered', level: 1, runs: [{ text: 'Two' }] },
  { id: 'z', type: 'zone', zone: 'drawing', width: 100, height: 100 },
  { id: 'd', type: 'divider' },
];

describe('articles turned into Page elements', () => {
  it('writes blocks as lines, headings and list markers kept', () => {
    const runs = articleBlocksAsRuns(blocks.slice(1), new Map([['l2', '1.']]));
    expect(runs.map((r) => r.text).join('')).toBe('Hello world\nGoals\n• One\n    1. Two\n———');
    expect(runs.find((r) => r.text === 'world')?.bold).toBe(true);
    expect(runs.find((r) => r.text === 'Goals')?.heading).toBe(2);
  });

  it('makes a Page per article page, the title as its masthead, and drops the writing', () => {
    const pages: IllustratePage[] = [
      { id: 'a', orientation: 'portrait', kind: 'article', flow: 'f' },
      { id: 'b', orientation: 'portrait', kind: 'article', flow: 'f' },
    ];
    const tab = { elements: [], pages, articles: { f: { blocks } } };
    const out = withArticlesAsPages(
      tab,
      new Map([
        [
          'f',
          [
            ['t', 'p'],
            ['h', 'l1', 'l2'],
          ],
        ],
      ]),
    );
    const made = out.elements as ShapeElement[];
    expect(made).toHaveLength(2);
    expect(made[0]!.shape).toBe('page');
    expect(made[0]!.pageTitle).toBe('Plan');
    expect(made[0]!.label).toBe('Hello world');
    expect(made[1]!.label).toContain('Goals');
    expect('articles' in out).toBe(false);
    expect((out.pages as IllustratePage[]).every((p) => p.kind === 'infographic' && !p.flow)).toBe(
      true,
    );
  });

  // docs/specs/007-editor/article-pages.md "Leaving Illustrate": a lock holds an article as it is.
  it('keeps an article with a locked page as an article, its pages and margin notes untouched', () => {
    const pages: IllustratePage[] = [
      { id: 'a', orientation: 'portrait', kind: 'article', flow: 'f' },
      { id: 'b', orientation: 'portrait', kind: 'article', flow: 'g', locked: true },
      { id: 'c', orientation: 'portrait', kind: 'article', flow: 'g' },
    ];
    const held = {
      blocks: [{ id: 'n', type: 'paragraph', runs: [{ text: 'Noted', note: 'm2' }] }],
    };
    const marker = (id: string) =>
      ({
        id,
        type: 'annotation',
        x: 0,
        y: 0,
        width: 32,
        height: 32,
        articleNote: 'comment',
      }) as unknown as Element;
    const tab = {
      elements: [marker('m1'), marker('m2')],
      pages,
      articles: {
        f: { blocks: [{ id: 'p', type: 'paragraph', runs: [{ text: 'Mine', note: 'm1' }] }] },
        g: held,
      },
    };
    const out = withArticlesAsPages(tab, new Map());
    const made = (out.elements as ShapeElement[]).filter((e) => e.shape === 'page');
    expect(made).toHaveLength(1);
    expect(made[0]!.label).toBe('Mine');
    expect(Object.keys(out.articles as object)).toEqual(['g']);
    expect((out.articles as Record<string, unknown>).g).toBe(held);
    const kinds = (out.pages as IllustratePage[]).map((p) => [p.id, p.kind, p.flow]);
    expect(kinds).toEqual([
      ['a', 'infographic', undefined],
      ['b', 'article', 'g'],
      ['c', 'article', 'g'],
    ]);
    const notes = out.elements.filter((e) => (e as { type: string }).type === 'annotation');
    expect(notes.find((e) => e.id === 'm1')).not.toHaveProperty('articleNote');
    expect(notes.find((e) => e.id === 'm2')).toHaveProperty('articleNote', 'comment');
  });

  it('leaves a tab whose every article is locked alone', () => {
    const pages: IllustratePage[] = [
      { id: 'a', orientation: 'portrait', kind: 'article', flow: 'f', locked: true },
    ];
    const tab = { elements: [], pages, articles: { f: { blocks } } };
    expect(withArticlesAsPages(tab, new Map())).toBe(tab);
  });

  it('leaves a tab without articles alone', () => {
    const tab = { elements: [] };
    expect(withArticlesAsPages(tab, new Map())).toBe(tab);
  });
});
