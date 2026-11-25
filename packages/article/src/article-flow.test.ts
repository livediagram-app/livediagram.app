import { describe, expect, it } from 'vitest';
import {
  articleListMarkers,
  articlesOf,
  MAX_ARTICLE_BLOCK_TEXT,
  newArticleFlow,
  normaliseRuns,
  parseArticleBlock,
  parseArticleFlow,
  parseArticleStyle,
  withFreshArticleBlockIds,
} from './article-flow';
import type { ArticleBlock } from './article-flow';

const P = (id: string, text = id): ArticleBlock => ({
  id,
  type: 'paragraph',
  runs: text ? [{ text }] : [],
});

describe('article writing: reading it', () => {
  it('keeps valid runs, merges same-format neighbours, drops the rest', () => {
    expect(
      normaliseRuns([
        { text: 'a', b: true },
        { text: 'b', b: true },
        { text: '' },
        { text: 'c', href: 'javascript:alert(1)', color: 'red' },
        { text: 'd', href: 'https://x.dev', hl: '#ff0', sup: true, sub: true },
        'nope',
      ]),
    ).toEqual([
      { text: 'ab', b: true },
      { text: 'c' },
      { text: 'd', href: 'https://x.dev', hl: '#ff0', sup: true },
    ]);
  });

  it('caps the text of a block', () => {
    const runs = normaliseRuns([{ text: 'x'.repeat(MAX_ARTICLE_BLOCK_TEXT + 50) }]);
    expect(runs[0]!.text).toHaveLength(MAX_ARTICLE_BLOCK_TEXT);
  });

  it('caps the runs at the count asked for, as a table cell does', () => {
    const runs = normaliseRuns(
      [{ text: 'a', b: true }, { text: 'b' }, { text: 'c', i: true }],
      100,
      2,
    );
    expect(runs.map((r) => r.text)).toEqual(['a', 'b']);
  });

  it('caps the text of a block without cutting an emoji in half', () => {
    const runs = normaliseRuns([{ text: `x${'😀'.repeat(MAX_ARTICLE_BLOCK_TEXT)}` }]);
    const text = runs[0]!.text;
    expect(text).toHaveLength(MAX_ARTICLE_BLOCK_TEXT - 1);
    expect(text.endsWith('😀')).toBe(true);
  });

  it('reads each block type and drops defaults', () => {
    expect(
      parseArticleBlock({ id: 'a', type: 'paragraph', style: 'body', align: 'left', runs: [] }),
    ).toEqual({ id: 'a', type: 'paragraph', runs: [] });
    expect(
      parseArticleBlock({ id: 'a', type: 'list', list: 'todo', level: 9, checked: true, runs: [] }),
    ).toEqual({
      id: 'a',
      type: 'list',
      list: 'todo',
      level: 4,
      checked: true,
      runs: [],
    });
    expect(
      parseArticleBlock({ id: 'a', type: 'list', list: 'bullet', checked: true, runs: [] }),
    ).toEqual({
      id: 'a',
      type: 'list',
      list: 'bullet',
      runs: [],
    });
    expect(
      parseArticleBlock({
        id: 'a',
        type: 'zone',
        zone: 'drawing',
        width: 5,
        height: 99999,
        at: { x: 1, y: 'no' },
      }),
    ).toEqual({
      id: 'a',
      type: 'zone',
      zone: 'drawing',
      width: 24,
      height: 2000,
    });
    expect(
      parseArticleBlock({ id: 'a', type: 'zone', zone: 'other', width: 50, height: 50 }),
    ).toBeUndefined();
    expect(parseArticleBlock({ id: '', type: 'divider' })).toBeUndefined();
    expect(parseArticleBlock({ id: 'a', type: 'video' })).toBeUndefined();
  });

  it("keeps a code block's language when it is one, and reads a block without one as before", () => {
    expect(parseArticleBlock({ id: 'a', type: 'code', text: 'x', lang: 'ts' })).toEqual({
      id: 'a',
      type: 'code',
      text: 'x',
      lang: 'ts',
    });
    for (const lang of [undefined, '', 'a b', 'x'.repeat(33), 7]) {
      expect(parseArticleBlock({ id: 'a', type: 'code', text: 'x', lang })).toEqual({
        id: 'a',
        type: 'code',
        text: 'x',
      });
    }
  });

  it('reads a flow: repeats and junk dropped, never empty', () => {
    const flow = parseArticleFlow({
      blocks: [P('a'), P('a'), { id: 'z' }, { id: 'c', type: 'divider' }],
    });
    expect(flow.blocks.map((b) => b.id)).toEqual(['a', 'c']);
    expect(parseArticleFlow({ blocks: [] }, 'x').blocks).toEqual([
      { id: 'x', type: 'paragraph', runs: [] },
    ]);
    expect(parseArticleFlow(null).blocks).toHaveLength(1);
  });

  it('reads a style field by field', () => {
    expect(
      parseArticleStyle({
        look: 'notebook',
        accent: '#123456',
        margins: 'tiny',
        rules: 'headings',
        bodyFont: 'Lora!',
      }),
    ).toEqual({ look: 'notebook', accent: '#123456', rules: 'headings' });
    expect(parseArticleStyle({ nothing: 1 })).toBeUndefined();
  });

  it('reads the tab articles once per stored object', () => {
    const articles = { d1: { blocks: [P('a')] }, '': { blocks: [] } };
    const a = articlesOf({ articles });
    expect(Object.keys(a)).toEqual(['d1']);
    expect(articlesOf({ articles })).toBe(a);
    expect(articlesOf({})).toEqual({});
  });

  it('starts an article with a title and a paragraph', () => {
    const f = newArticleFlow();
    expect(f.blocks.map((b) => (b.type === 'paragraph' ? (b.style ?? 'body') : b.type))).toEqual([
      'title',
      'body',
    ]);
    const copy = withFreshArticleBlockIds(f);
    expect(copy.blocks.map((b) => b.id)).not.toContain(f.blocks[0]!.id);
  });
});

describe('list markers', () => {
  const L = (id: string, list: 'bullet' | 'numbered' | 'todo', level = 0) => ({
    id,
    type: 'list',
    list,
    level,
  });
  it('count numbered items by level, restarting after a bullet or another block', () => {
    const m = articleListMarkers([
      L('a', 'numbered'),
      L('b', 'numbered', 1),
      L('c', 'numbered', 1),
      L('d', 'numbered', 2),
      L('e', 'numbered'),
      L('f', 'bullet', 1),
      L('g', 'numbered', 1),
      { id: 'p', type: 'paragraph' },
      L('h', 'numbered'),
      L('t', 'todo'),
    ]);
    expect([...m.values()]).toEqual(['1.', 'a.', 'b.', 'i.', '2.', '◦', 'a.', '1.', '']);
  });

  it('counts level 2 in true roman numerals past 39', () => {
    const items = Array.from({ length: 99 }, (_, i) => L(`r${i}`, 'numbered', 2));
    const m = [...articleListMarkers(items).values()];
    expect([m[3], m[8], m[39], m[48], m[49], m[89], m[98]]).toEqual([
      'iv.',
      'ix.',
      'xl.',
      'xlix.',
      'l.',
      'xc.',
      'xcix.',
    ]);
  });
});

// Suggestions are retired (livedocuments/docs/specs/007-editor/suggestions.md): writing stored while they existed reads as rejected.
describe('parseArticleFlow: a suggestion stored before suggestions were retired', () => {
  const mark = (k: string, extra: object = {}) => ({
    id: 's1',
    k,
    by: 'key-a',
    n: 'Ada',
    at: 1,
    ...extra,
  });

  it('drops an insertion, keeps a deletion as plain text and puts back a format change', () => {
    const flow = parseArticleFlow({
      blocks: [
        {
          id: 'p',
          type: 'paragraph',
          runs: [
            { text: 'Kept ' },
            { text: 'added ', sg: mark('ins') },
            { text: 'struck ', sg: mark('del') },
            { text: 'bold', b: true, note: 'n1', sg: mark('fmt', { was: { i: true } }) },
          ],
        },
      ],
    });
    expect(flow.blocks).toEqual([
      {
        id: 'p',
        type: 'paragraph',
        runs: [{ text: 'Kept struck ' }, { text: 'bold', i: true, note: 'n1' }],
      },
    ]);
  });

  it('joins a paragraph break put in back onto the paragraph before, and keeps one taken out', () => {
    const flow = parseArticleFlow({
      blocks: [
        { id: 'a', type: 'paragraph', runs: [{ text: 'One ' }] },
        { id: 'b', type: 'paragraph', runs: [{ text: 'two' }], sg: mark('ins') },
        { id: 'c', type: 'list', list: 'bullet', runs: [{ text: 'three' }], sg: mark('del') },
      ],
    });
    expect(flow.blocks).toEqual([
      { id: 'a', type: 'paragraph', runs: [{ text: 'One two' }] },
      { id: 'c', type: 'list', list: 'bullet', runs: [{ text: 'three' }] },
    ]);
  });
});
