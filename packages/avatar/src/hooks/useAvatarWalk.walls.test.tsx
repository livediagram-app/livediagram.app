// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { clearOfFences, FENCE_REACH, fenceSegments } from '../collision';
import { DEFAULT_AVATAR_CONFIG } from '../config';
import type { AvatarPoint } from '../walk';
import { FENCE_SETTLE_MS, useAvatarWalk } from './useAvatarWalk';

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
    expect(result.current.readPos()).toEqual({ x: 5 + FENCE_REACH + 0.5, y: 200 });
  });

  it('nudges one beside the wall outside out of its reach, never through the wall', () => {
    const { result } = enterAt({ x: -5, y: 200 });
    expect(result.current.readPos()).toEqual({ x: 5 - FENCE_REACH - 0.5, y: 200 });
  });

  it('leaves one put down in the wall itself there, free to walk off either side', () => {
    const { result } = enterAt({ x: 7, y: 200 });
    expect(result.current.readPos()).toEqual({ x: 7, y: 200 });
  });

  it('puts a character clear of every wall exactly where it was asked', () => {
    const { result } = enterAt({ x: 300, y: 200 });
    expect(result.current.readPos()).toEqual({ x: 300, y: 200 });
  });
});

// A wall moved onto a standing character, and a seat or a step aside beside one (Work Tracker #493): nudged clear once
// the walls hold still, never on each frame of a drag.
type Room = typeof room;

function standAt(point: AvatarPoint, rooms: Room[] = [room]) {
  const onPresence = vi.fn();
  const hook = renderHook(
    ({ elements }: { elements: Room[] }) =>
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
        onPresence,
      }),
    { initialProps: { elements: rooms } },
  );
  onPresence.mockClear();
  return { ...hook, onPresence };
}

const roomAt = (x: number): Room => ({ ...room, x });

describe('useAvatarWalk walls moved onto a character', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('nudges a standing character clear once a room dragged onto it settles, not on each frame', () => {
    vi.useFakeTimers();
    const { result, rerender, onPresence } = standAt({ x: 300, y: 200 });
    // Dragged left to right a frame at a time, ending with its left wall (x + 5) 10 px left of the feet.
    for (const x of [100, 150, 200, 250, 285]) {
      rerender({ elements: [roomAt(x)] });
      act(() => {
        vi.advanceTimersByTime(16);
      });
    }
    expect(result.current.readPos()).toEqual({ x: 300, y: 200 });
    expect(onPresence).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(FENCE_SETTLE_MS);
    });
    expect(result.current.readPos()).toEqual({ x: 290 + FENCE_REACH + 0.5, y: 200 });
    // Told to the room once, at the new spot.
    expect(onPresence).toHaveBeenCalledTimes(1);
    expect(onPresence).toHaveBeenLastCalledWith(expect.objectContaining({ x: 302.5, y: 200 }));
  });

  it('leaves a character the walls settle clear of, or in, where it is', () => {
    vi.useFakeTimers();
    const { result, rerender } = standAt({ x: 300, y: 200 });
    rerender({ elements: [roomAt(293)] });
    act(() => {
      vi.advanceTimersByTime(FENCE_SETTLE_MS);
    });
    // In the wall itself (2 px from its line): free to walk off either side.
    expect(result.current.readPos()).toEqual({ x: 300, y: 200 });
  });

  it('leaves a seated character on its seat', () => {
    vi.useFakeTimers();
    const { result, rerender } = standAt({ x: 300, y: 200 });
    act(() => result.current.sitOn('chair', { x: 300, y: 200 }, 'down'));
    rerender({ elements: [roomAt(285)] });
    act(() => {
      vi.advanceTimersByTime(FENCE_SETTLE_MS);
    });
    expect(result.current.readPos()).toEqual({ x: 300, y: 200 });
    expect(result.current.seatedOn).toBe('chair');
  });

  it('snaps a seat beside a wall clear of its reach', () => {
    const { result } = standAt({ x: 300, y: 200 });
    act(() => result.current.sitOn('chair', { x: 15, y: 200 }, 'right'));
    expect(result.current.readPos()).toEqual({ x: 5 + FENCE_REACH + 0.5, y: 200 });
  });

  it('steps aside clear of a wall it would land beside', () => {
    const { result } = standAt({ x: 300, y: 200 });
    act(() => result.current.stepAside({ x: 15, y: 200 }));
    expect(result.current.readPos()).toEqual({ x: 5 + FENCE_REACH + 0.5, y: 200 });
  });

  it('costs a settle well under a millisecond on a tab of 500 rooms', () => {
    // The settle's own work is one clearOfFences over the tab's walls (2,505 segments here); the drag frames before it
    // only restart a timer.
    const rooms = Array.from({ length: 500 }, (_, i) => ({
      ...room,
      id: `r${i}`,
      y: 1000 + i * 500,
    }));
    const walls = fenceSegments([roomAt(285), ...rooms]);
    expect(clearOfFences({ x: 300, y: 200 }, walls, FENCE_REACH)).toEqual({ x: 302.5, y: 200 });
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 100; i++) clearOfFences({ x: 300, y: 200 }, walls, FENCE_REACH);
    });
    expect(ms / 100).toBeLessThan(cpuBudgetMs(2));
  });
});
