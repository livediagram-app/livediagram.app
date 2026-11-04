// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FENCE_REACH } from '../collision';
import { DEFAULT_AVATAR_CONFIG } from '../config';
import type { AvatarPoint } from '../walk';
import { useAvatarWalk } from './useAvatarWalk';

// A character never opens standing in a wall (docs/specs/009-elements/fence.md "What does not walk", Work Tracker
// #437): entering the mode at a point on a room's wall puts it just clear of the wall, on the side its feet were on.

const room = { id: 'room', type: 'shape', shape: 'room', x: 0, y: 0, width: 600, height: 400 };

function enterAt(point: AvatarPoint) {
  const spawnAtRef = { current: point as AvatarPoint | null };
  return renderHook(() =>
    useAvatarWalk({
      active: true,
      config: DEFAULT_AVATAR_CONFIG,
      onToggleGender: vi.fn(),
      elements: [room],
      mainRef: { current: null },
      wrapperRef: { current: null },
      viewportOffset: { x: 0, y: 0 },
      viewportZoom: 1,
      setViewportOffset: vi.fn(),
      spawnAtRef,
    }),
  );
}

describe('useAvatarWalk walls', () => {
  it('nudges a character put down on a room’s left wall into the room', () => {
    // The left wall's line is x = 5; feet 2 px inside it.
    const { result } = enterAt({ x: 7, y: 200 });
    expect(result.current.pos).toEqual({ x: 5 + FENCE_REACH + 0.5, y: 200 });
  });

  it('nudges one just outside the wall out of it, never through it', () => {
    const { result } = enterAt({ x: 1, y: 200 });
    expect(result.current.pos).toEqual({ x: 5 - FENCE_REACH - 0.5, y: 200 });
  });

  it('puts a character clear of every wall exactly where it was asked', () => {
    const { result } = enterAt({ x: 300, y: 200 });
    expect(result.current.pos).toEqual({ x: 300, y: 200 });
  });
});
