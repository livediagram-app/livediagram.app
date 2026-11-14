// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';

// docs/specs/009-elements/social-pieces.md "Arcade Machine" (Work Tracker 793): the Insert Coin bubble shows beside
// the machine you stand at (or below it) when a Room Sign stands where it would rise.

vi.mock('@/lib/jukebox-listening', () => ({ setJukeboxArea: vi.fn() }));

import { useArcadeBubbleSide, useNearArcade, useSocialPieces } from './useSocialPieces';

const machine = { ...createShape('arcade-machine', 100, 300), id: 'arc' } as Element;
const signAt = (x: number, y: number) =>
  ({ ...createShape('room-sign', x, y), id: 'sign' }) as Element;
// At the machine's front, below its box.
const front = { x: 132, y: 420 };

function stand(elements: readonly Element[], feet: { x: number; y: number } | null = front) {
  const near = renderHook(() => ({
    near: useNearArcade('arc'),
    side: useArcadeBubbleSide('arc'),
  }));
  const view = renderHook(
    (p: { elements: readonly Element[] }) =>
      useSocialPieces({ active: true, feet, elements: p.elements }),
    {
      initialProps: { elements },
    },
  );
  near.rerender();
  return { near, view };
}

describe('the Insert Coin bubble beside a Room Sign', () => {
  it('rises above the machine with no sign near it', () => {
    const { near, view } = stand([machine, signAt(900, 240)]);
    expect(near.result.current).toEqual({ near: true, side: 'above' });
    view.unmount();
  });

  it('shows beside the machine under a hand-placed sign just above it, and rises again when the sign moves', () => {
    const { near, view } = stand([machine, signAt(64, 220)]);
    expect(near.result.current).toEqual({ near: true, side: 'right' });
    view.rerender({ elements: [machine, signAt(64, -400)] });
    near.rerender();
    expect(near.result.current).toEqual({ near: true, side: 'above' });
    view.unmount();
    near.rerender();
    expect(near.result.current).toEqual({ near: false, side: 'above' });
  });

  it('is always above for a machine you are not at', () => {
    const { near, view } = stand([machine, signAt(64, 220)], { x: 900, y: 900 });
    expect(near.result.current).toEqual({ near: false, side: 'above' });
    view.unmount();
  });
});
