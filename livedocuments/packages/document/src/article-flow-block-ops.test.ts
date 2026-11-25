import { describe, expect, it } from 'vitest';
import type { ArticleBlock, ArticleFlow } from '@liveworkspace/article/article-flow';
import { applyArticleOps, diffArticleFlow, parseArticleOps } from './article-flow-ops';

// The article writing's block ops (the shared model's own reading is tested in @liveworkspace/article).
const P = (id: string, text = id): ArticleBlock => ({
  id,
  type: 'paragraph',
  runs: text ? [{ text }] : [],
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
