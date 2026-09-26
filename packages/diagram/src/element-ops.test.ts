import { describe, it, expect } from 'vitest';
import { createShape, type Element } from './index';
import { applyElementOp, applyElementOps, diffToElementOps } from './element-ops';

const el = (id: string, over: Partial<Element> = {}): Element =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, ...over }) as Element;

describe('diffToElementOps', () => {
  it('emits an add with its z-index for a new element', () => {
    const ops = diffToElementOps([el('a')], [el('a'), el('b', { x: 5 })]);
    expect(ops).toEqual([{ kind: 'add', element: el('b', { x: 5 }), at: 1 }]);
  });

  it('emits a full-element update for a changed element', () => {
    const ops = diffToElementOps([el('a')], [el('a', { x: 99 })]);
    expect(ops).toEqual([{ kind: 'update', element: el('a', { x: 99 }) }]);
  });

  it('emits nothing when nothing changed', () => {
    expect(diffToElementOps([el('a'), el('b')], [el('a'), el('b')])).toEqual([]);
  });

  it('emits a remove for a deleted element', () => {
    expect(diffToElementOps([el('a'), el('b')], [el('a')])).toEqual([{ kind: 'remove', id: 'b' }]);
  });

  it('emits a reorder (full id order) for a pure z-order swap', () => {
    const ops = diffToElementOps([el('a'), el('b')], [el('b'), el('a')]);
    expect(ops).toEqual([{ kind: 'reorder', ids: ['b', 'a'] }]);
  });

  it('round-trips: applying the diff to before reproduces after', () => {
    const before = [el('a'), el('b'), el('c')];
    const after = [el('c'), el('a', { x: 7 }), el('d', { y: 3 })]; // remove b, move c front, edit a, add d
    expect(applyElementOps(before, diffToElementOps(before, after))).toEqual(after);
  });
});

describe('applyElementOp', () => {
  it('inserts an add at its index', () => {
    expect(applyElementOp([el('a'), el('c')], { kind: 'add', element: el('b'), at: 1 })).toEqual([
      el('a'),
      el('b'),
      el('c'),
    ]);
  });

  it('replaces on update by id', () => {
    expect(
      applyElementOp([el('a'), el('b')], { kind: 'update', element: el('b', { x: 9 }) }),
    ).toEqual([el('a'), el('b', { x: 9 })]);
  });

  it('is a no-op when updating an id that was already removed by a peer', () => {
    const els = [el('a')];
    expect(applyElementOp(els, { kind: 'update', element: el('gone', { x: 1 }) })).toBe(els);
  });

  it('degrades a racing double-add to an update', () => {
    expect(
      applyElementOp([el('a', { x: 1 })], { kind: 'add', element: el('a', { x: 2 }), at: 0 }),
    ).toEqual([el('a', { x: 2 })]);
  });

  it('removes by id and ignores unknown ids', () => {
    expect(applyElementOp([el('a'), el('b')], { kind: 'remove', id: 'b' })).toEqual([el('a')]);
    const els = [el('a')];
    expect(applyElementOp(els, { kind: 'remove', id: 'x' })).toEqual([el('a')]);
  });

  it('reorders to the given id order', () => {
    expect(
      applyElementOp([el('a'), el('b'), el('c')], { kind: 'reorder', ids: ['c', 'a', 'b'] }),
    ).toEqual([el('c'), el('a'), el('b')]);
  });
});

describe('concurrent different-element edits merge (the Level 0 win)', () => {
  it('A moves X and B moves Y on the same tab; both survive', () => {
    const start = [el('x'), el('y')];
    // A edits x, B edits y — each derives an op from the same start.
    const opA = diffToElementOps(start, [el('x', { x: 100 }), el('y')]);
    const opB = diffToElementOps(start, [el('x'), el('y', { y: 200 })]);
    // Apply both, in either order — same converged result, neither clobbers.
    const ab = applyElementOps(applyElementOps(start, opA), opB);
    const ba = applyElementOps(applyElementOps(start, opB), opA);
    const expected = [el('x', { x: 100 }), el('y', { y: 200 })];
    expect(ab).toEqual(expected);
    expect(ba).toEqual(expected);
  });
});

// The dot vote's old failure (spec/39), on the Q&A board (spec/151): a peer
// moves the board with a copy taken before a vote reached them, and their
// `el` update must not send that vote back out of existence.
describe('applyElementOp on a Q&A board', () => {
  const board = (rev: number, voters: string[], x = 0) => ({
    ...createShape('qa-board', x, 0),
    id: 'b',
    qaRev: rev,
    qaNotes: [{ id: 'n1', text: 'q', at: 1, voters }],
  });

  it('keeps votes a stale peer update never saw, but takes the move', () => {
    const local = [board(5, ['a', 'b', 'c'])];
    const stale = board(4, ['a', 'b'], 300);
    const [out] = applyElementOp(local, { kind: 'update', element: stale }) as ReturnType<
      typeof board
    >[];
    expect(out!.x).toBe(300);
    expect(out!.qaNotes[0]!.voters).toEqual(['a', 'b', 'c']);
    expect(out!.qaRev).toBe(5);
  });

  it('takes a newer board state from a peer', () => {
    const local = [board(5, ['a'])];
    const [out] = applyElementOp(local, {
      kind: 'update',
      element: board(6, ['a', 'z']),
    }) as ReturnType<typeof board>[];
    expect(out!.qaNotes[0]!.voters).toEqual(['a', 'z']);
  });
});
