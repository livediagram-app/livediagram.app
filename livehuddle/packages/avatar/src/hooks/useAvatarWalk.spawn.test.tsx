// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FENCE_REACH } from '../collision';
import { DEFAULT_AVATAR_CONFIG } from '../config';
import { officeFootprints } from '../office-geometry';
import type { AvatarPoint } from '../walk';
import { useAvatarWalk } from './useAvatarWalk';

// A new character never appears inside a footprint (docs/specs/009-elements/fence.md "What does not walk", Work
// Tracker #610): entering the mode with its spot in a pool's water or a plant's pot puts it on free floor beside it.

type Piece = {
  id: string;
  type: 'shape';
  shape: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
const pool: Piece = {
  id: 'pool',
  type: 'shape',
  shape: 'swimming-pool',
  x: 0,
  y: 0,
  width: 320,
  height: 200,
};

function enterAt(point: AvatarPoint, elements: Piece[]) {
  return renderHook(() =>
    useAvatarWalk({
      active: true,
      config: DEFAULT_AVATAR_CONFIG,
      onToggleGender: vi.fn(),
      elements,
      mainRef: { current: null },
      wrapperRef: { current: null },
      viewportOffset: { x: 0, y: 0 },
      viewportZoom: 1,
      setViewportOffset: vi.fn(),
      spawnAtRef: { current: point },
    }),
  );
}

const inside = (p: AvatarPoint, b: { x: number; y: number; width: number; height: number }) =>
  p.x > b.x && p.x < b.x + b.width && p.y > b.y && p.y < b.y + b.height;

describe('useAvatarWalk entry spawn', () => {
  it('puts a character asked into the middle of a pool on the deck below its water instead', () => {
    const { result } = enterAt({ x: 160, y: 100 }, [pool]);
    const at = result.current.readPos()!;
    const [water] = officeFootprints(pool);
    expect(inside(at, water!)).toBe(false);
    // Straight below, the front of the pool, just clear of the water's reach.
    expect(at.x).toBeCloseTo(160, 0);
    expect(at.y).toBeGreaterThanOrEqual(water!.y + water!.height + FENCE_REACH);
    expect(at.y).toBeLessThan(water!.y + water!.height + FENCE_REACH + 10);
  });

  it('puts one asked onto a plant’s pot beside the pot, and leaves one on free floor where it was asked', () => {
    const plant: Piece = {
      id: 'p',
      type: 'shape',
      shape: 'plant',
      x: 400,
      y: 0,
      width: 56,
      height: 88,
    };
    const [pot] = officeFootprints(plant);
    const middle = { x: pot!.x + pot!.width / 2, y: pot!.y + pot!.height / 2 };
    const { result } = enterAt(middle, [plant]);
    expect(inside(result.current.readPos()!, pot!)).toBe(false);
    const free = enterAt({ x: 600, y: 300 }, [plant]);
    expect(free.result.current.readPos()).toEqual({ x: 600, y: 300 });
  });
});
