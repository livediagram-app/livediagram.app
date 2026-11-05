// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR_CONFIG } from '../config';
import { useAvatarWalk } from './useAvatarWalk';

// docs/specs/008-canvas/avatar-mode.md "Finding the way": a click-walk goes round the walls in the way.

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const shape = (
  id: string,
  kind: string,
  x: number,
  y: number,
  w: number,
  h: number,
  more = {},
) => ({
  id,
  type: 'shape',
  shape: kind,
  x,
  y,
  width: w,
  height: h,
  ...more,
});
// A 400 by 300 room, its doorway in the middle of its front (bottom) wall.
const room = shape('room', 'room', 0, 0, 400, 300);

function walker(elements: ReturnType<typeof shape>[], extra = {}) {
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
      ...extra,
    }),
  );
}
const run = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('useAvatarWalk finding the way', () => {
  it('walks into a room clicked from behind its back wall, through the doorway, and arrives', () => {
    const { result } = walker([room]);
    act(() => result.current.teleportTo({ x: 200, y: -150 }));
    // Let the idle build run, as it would after the walls settle.
    run(300);
    const arrived = vi.fn();
    act(() => result.current.walkTo({ x: 200, y: 150 }, arrived));
    run(8_000);
    expect(result.current.pos!.x).toBeCloseTo(200, 0);
    expect(result.current.pos!.y).toBeCloseTo(150, 0);
    expect(arrived).toHaveBeenCalledOnce();
  });

  it('stops beside a shut room clicked into, arriving at nothing', () => {
    const shut = { ...room, roomDoor: 'none' };
    const { result } = walker([shut]);
    act(() => result.current.teleportTo({ x: 200, y: -150 }));
    const arrived = vi.fn();
    act(() => result.current.walkTo({ x: 200, y: 150 }, arrived));
    run(8_000);
    const pos = result.current.pos!;
    // Just outside the back wall (its line y 31), standing still.
    expect(pos.y).toBeLessThan(31);
    expect(pos.y).toBeGreaterThan(-20);
    expect(result.current.walking).toBe(false);
    expect(arrived).not.toHaveBeenCalled();
  });

  it('stops just outside the shut door of a room clicked into', () => {
    const shut = { ...room, roomDoor: 'none' };
    // A shut Door in the middle of the right wall (x 395).
    const door = shape('d', 'door', 395 - 48, 150 - 12, 96, 24, { rotation: 90, doorClosed: true });
    const { result } = walker([shut, door]);
    act(() => result.current.teleportTo({ x: -150, y: 150 }));
    act(() => result.current.walkTo({ x: 200, y: 150 }));
    run(8_000);
    const pos = result.current.pos!;
    expect(pos.x).toBeGreaterThan(395);
    expect(pos.x).toBeLessThan(395 + 48);
    expect(Math.abs(pos.y - 150)).toBeLessThan(16);
  });

  it('sits only in the chair it was going to, not one it walks through on the way', () => {
    const onWalkIntoChair = vi.fn();
    // The route from behind the room to the far chair passes over the chair in the doorway.
    const inDoorway = shape('c1', 'chair', 176, 280, 48, 48);
    const target = shape('c2', 'chair', 300, 120, 48, 48);
    const { result } = walker([room, inDoorway, target], { onWalkIntoChair });
    act(() => result.current.teleportTo({ x: 200, y: 450 }));
    act(() => result.current.walkTo({ x: 324, y: 144 }));
    run(8_000);
    expect(onWalkIntoChair).toHaveBeenCalledTimes(1);
    expect(onWalkIntoChair).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c2' }),
      expect.anything(),
    );
  });
});
