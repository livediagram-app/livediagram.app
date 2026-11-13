import { describe, it, expect } from 'vitest';
import { createShape } from './index';
import { applyElementOp } from './element-ops';

// The shared appliers are tested in @liveworkspace/element-model; this is livediagram's binding of them.
// The dot vote's old failure (docs/specs/012-collaboration/session-tools.md), on the Q&A board (docs/specs/012-collaboration/qa-board.md): a peer
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
