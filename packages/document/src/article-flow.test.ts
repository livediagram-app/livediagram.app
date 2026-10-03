import { describe, expect, it } from 'vitest';
import {
  articleListMarkers,
  articlesOf,
  articleWordCount,
  MAX_DOC_BLOCK_TEXT,
  newArticleFlow,
  normaliseRuns,
  parseArticleBlock,
  parseArticleFlow,
  parseArticleStyle,
  withFreshArticleBlockIds,
} from './article-flow';
import { applyArticleOps, diffArticleFlow, parseArticleOps } from './article-flow-ops';
import type { ArticleBlock, ArticleFlow } from './article-flow';

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
    const runs = normaliseRuns([{ text: 'x'.repeat(MAX_DOC_BLOCK_TEXT + 50) }]);
    expect(runs[0]!.text).toHaveLength(MAX_DOC_BLOCK_TEXT);
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

  it('counts words', () => {
    expect(
      articleWordCount([P('a', 'two words'), { id: 'c', type: 'code', text: 'x = 1' }, P('e', '')]),
    ).toBe(5);
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

describe('article writing: block ops', () => {
  const flow = (...blocks: ArticleBlock[]): ArticleFlow => ({ blocks });
  const round = (a: ArticleFlow, b: ArticleFlow) => applyArticleOps(a, diffArticleFlow(a, b));

  it('sends nothing when nothing changed', () => {
    const a = flow(P('a'), P('b'));
    expect(diffArticleFlow(a, { blocks: [...a.blocks] })).toEqual([]);
  });

  it('round-trips inserts, edits, removals and moves', () => {
    const a = flow(P('a'), P('b'), P('c'), P('d'));
    const cases: ArticleFlow[] = [
      flow(P('a'), P('x'), P('b'), P('c'), P('d')),
      flow(P('a'), P('b', 'B!'), P('c'), P('d')),
      flow(P('a'), P('d')),
      flow(P('d'), P('a'), P('b'), P('c')),
      flow(P('c'), P('n'), P('a')),
      { blocks: a.blocks, style: { look: 'bold' } },
    ];
    for (const b of cases) expect(round(a, b)).toEqual(b);
  });

  it('does not resend a block whose neighbour changed', () => {
    const a = flow(P('a'), P('b'));
    const ops = diffArticleFlow(a, flow(P('a'), P('x'), P('b')));
    expect(ops).toEqual([{ kind: 'put', block: P('x'), after: 'a', before: 'b' }]);
  });

  it('converges when one writes in a block while the other adds a block beside it', () => {
    const base = flow(P('x'), P('y'));
    const editY = diffArticleFlow(base, flow(P('x'), P('y', 'Y!')));
    const addZ = diffArticleFlow(base, flow(P('x'), P('z'), P('y')));
    // A changed block that kept its place carries no position.
    expect(editY).toEqual([{ kind: 'put', block: P('y', 'Y!') }]);
    const expected = flow(P('x'), P('z'), P('y', 'Y!'));
    expect(applyArticleOps(applyArticleOps(base, editY), addZ)).toEqual(expected);
    expect(applyArticleOps(applyArticleOps(base, addZ), editY)).toEqual(expected);
  });

  it("reads a peer's ops defensively", () => {
    expect(parseArticleOps('nope')).toBeNull();
    expect(
      parseArticleOps([
        { kind: 'put', block: null },
        { kind: 'put', block: P('a'), after: 7 },
        { kind: 'remove', id: '' },
        { kind: 'put', block: P('b'), after: null },
        { kind: 'remove', id: 'c' },
      ]),
    ).toEqual([
      { kind: 'put', block: P('b'), after: null },
      { kind: 'remove', id: 'c' },
    ]);
  });

  it('merges two people writing different blocks', () => {
    const base = flow(P('a'), P('b'), P('c'));
    const mine = diffArticleFlow(base, flow(P('a', 'A1'), P('b'), P('c')));
    const theirs = diffArticleFlow(base, flow(P('a'), P('b'), P('n'), P('c', 'C2')));
    const merged = flow(P('a', 'A1'), P('b'), P('n'), P('c', 'C2'));
    expect(applyArticleOps(applyArticleOps(base, mine), theirs)).toEqual(merged);
    expect(applyArticleOps(applyArticleOps(base, theirs), mine)).toEqual(merged);
  });

  it('places a block whose neighbour went by its other neighbour', () => {
    const base = flow(P('a'), P('b'), P('c'));
    const insert = diffArticleFlow(base, flow(P('a'), P('b'), P('x'), P('c')));
    const removeB = diffArticleFlow(base, flow(P('a'), P('c')));
    expect(applyArticleOps(applyArticleOps(base, removeB), insert).blocks.map((b) => b.id)).toEqual(
      ['a', 'x', 'c'],
    );
  });

  it('builds an article that arrives whole, and never leaves one empty', () => {
    const b = flow(P('a'), P('b'));
    expect(applyArticleOps(undefined, diffArticleFlow(undefined, b))).toEqual(b);
    expect(
      applyArticleOps(b, [
        { kind: 'remove', id: 'a' },
        { kind: 'remove', id: 'b' },
      ]).blocks,
    ).toHaveLength(1);
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
});
