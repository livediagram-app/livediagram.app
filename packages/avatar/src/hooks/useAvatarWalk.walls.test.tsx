// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FENCE_REACH } from '../collision';
import { DEFAULT_AVATAR_CONFIG } from '../config';
import type { AvatarPoint } from '../walk';
import { useAvatarWalk } from './useAvatarWalk';

// A character never opens held against a wall (docs/specs/009-elements/fence.md "What does not walk", Work Tracker
// #437): entering the mode beside a room's wall, inside its reach, puts it just clear of the wall on the side its feet
// were on; entering in the wall itself leaves it there, free to walk off either side.

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
  it('nudges a character put down beside a room’s left wall, inside it, clear of the wall', () => {
    // The left wall's line is x = 5; feet 10 px inside it, where the wall would hold them.
    const { result } = enterAt({ x: 15, y: 200 });
    expect(result.current.pos).toEqual({ x: 5 + FENCE_REACH + 0.5, y: 200 });
  });

  it('nudges one beside the wall outside out of its reach, never through the wall', () => {
    const { result } = enterAt({ x: -5, y: 200 });
    expect(result.current.pos).toEqual({ x: 5 - FENCE_REACH - 0.5, y: 200 });
  });

  it('leaves one put down in the wall itself there, free to walk off either side', () => {
    const { result } = enterAt({ x: 7, y: 200 });
    expect(result.current.pos).toEqual({ x: 7, y: 200 });
  });

  it('puts a character clear of every wall exactly where it was asked', () => {
    const { result } = enterAt({ x: 300, y: 200 });
    expect(result.current.pos).toEqual({ x: 300, y: 200 });
  });
});
