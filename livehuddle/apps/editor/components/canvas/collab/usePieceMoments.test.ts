// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livehuddle/document';

const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock('@liveworkspace/workbench/lib/motion-preference', () => ({
  prefersReducedMotion: () => motion.reduced,
}));

const moments = vi.hoisted(() => ({ played: [] as [string, number][] }));
vi.mock('@/lib/piece-moments', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/piece-moments')>();
  return {
    ...real,
    playMoment: (id: string, side: number) => moments.played.push([id, side]),
  };
});

import { momentPiece } from '@/lib/piece-moments';
import { momentPiecesOf, usePieceMoments } from './usePieceMoments';

const shape = (id: string, kind: string, x = 100) =>
  ({ id, type: 'shape', shape: kind, x, y: 100, width: 120, height: 160 }) as unknown as Element;
const BOARD = [
  shape('t', 'tree'),
  shape('c', 'chair', 600),
  { id: 'n', type: 'note' } as unknown as Element,
];
const AWAY = { x: 0, y: 0 };
const AT_TREE = { x: 90, y: 250 };

type Props = {
  active: boolean;
  feet: { x: number; y: number } | null;
  elements: readonly Element[];
};
const walk = (initial: Props) =>
  renderHook((props: Props) => usePieceMoments(props), { initialProps: initial });

beforeEach(() => {
  moments.played = [];
  motion.reduced = false;
});
afterEach(() => vi.clearAllMocks());

// docs/specs/009-elements/piece-moments.md "When one plays", "Reduced motion".
describe('usePieceMoments', () => {
  it('picks the moment pieces out of the board', () => {
    expect(momentPiecesOf(BOARD)).toEqual([
      momentPiece({ id: 't', kind: 'tree', x: 100, y: 100, width: 120, height: 160 }),
    ]);
  });

  it('plays a piece you walk up to in Avatar mode, from your side', () => {
    const hook = walk({ active: true, feet: AWAY, elements: BOARD });
    hook.rerender({ active: true, feet: AT_TREE, elements: BOARD });
    expect(moments.played).toEqual([['t', -1]]);
  });

  it('plays every arrival, and both pieces reached on one step', () => {
    const board = [...BOARD, shape('b', 'bookshelf', 150)];
    const hook = walk({ active: true, feet: AWAY, elements: board });
    hook.rerender({ active: true, feet: { x: 140, y: 250 }, elements: board });
    expect(moments.played).toEqual([
      ['t', -1],
      ['b', -1],
    ]);
  });

  it('plays nothing out of Avatar mode, nor without feet, nor on an empty board', () => {
    const hook = walk({ active: false, feet: AT_TREE, elements: BOARD });
    hook.rerender({ active: true, feet: null, elements: BOARD });
    hook.rerender({ active: true, feet: AT_TREE, elements: [] });
    expect(moments.played).toEqual([]);
  });

  it('plays nothing under reduced motion', () => {
    motion.reduced = true;
    walk({ active: true, feet: AT_TREE, elements: BOARD });
    expect(moments.played).toEqual([]);
  });
});
