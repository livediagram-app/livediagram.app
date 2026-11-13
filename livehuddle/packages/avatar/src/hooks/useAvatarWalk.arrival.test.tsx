// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR_CONFIG } from '../config';
import { useAvatarWalk } from './useAvatarWalk';

// Sit once on arrival (docs/specs/009-elements/chair.md, blueprint invariant I4): walking onto a chair asks to sit
// once, when the feet arrive, never once a frame while they stand on it; stepping off and walking back on is a
// second arrival.

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const chair = { id: 'chair', type: 'shape', shape: 'chair', x: 200, y: 200, width: 64, height: 72 };
const onChair = { x: 232, y: 236 };
const offChair = { x: 60, y: 60 };

function setup() {
  const onWalkIntoChair = vi.fn();
  const hook = renderHook(() =>
    useAvatarWalk({
      active: true,
      config: DEFAULT_AVATAR_CONFIG,
      onToggleGender: vi.fn(),
      elements: [chair],
      mainRef: { current: null },
      wrapperRef: { current: null },
      viewportOffset: { x: 0, y: 0 },
      viewportZoom: 1,
      setViewportOffset: vi.fn(),
      onWalkIntoChair,
    }),
  );
  act(() => hook.result.current.teleportTo(offChair));
  return { ...hook, onWalkIntoChair };
}

const run = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('useAvatarWalk sitting on arrival', () => {
  it('asks to sit once when the feet arrive, not again while they stand there', () => {
    const { result, onWalkIntoChair } = setup();
    act(() => result.current.walkTo(onChair));
    run(4_000);
    // The callback here never sits, so the character stands on the chair for many frames after arriving.
    expect(result.current.readPos()!.x).toBeCloseTo(onChair.x, 0);
    expect(onWalkIntoChair).toHaveBeenCalledTimes(1);
    // The click it walked to is the aim: the seat nearest it is taken (chair.md "Which seat", Work Tracker 706).
    expect(onWalkIntoChair).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'chair' }),
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      onChair,
    );
    run(4_000);
    expect(onWalkIntoChair).toHaveBeenCalledTimes(1);
  });

  it('gives no aim to feet that arrive with no click to aim at', () => {
    const { result, onWalkIntoChair } = setup();
    act(() => result.current.teleportTo(onChair));
    run(100);
    expect(onWalkIntoChair).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'chair' }),
      expect.objectContaining({ x: onChair.x, y: onChair.y }),
      undefined,
    );
  });

  it('asks again only after stepping off and walking back on', () => {
    const { result, onWalkIntoChair } = setup();
    act(() => result.current.walkTo(onChair));
    run(4_000);
    act(() => result.current.walkTo(offChair));
    run(4_000);
    expect(onWalkIntoChair).toHaveBeenCalledTimes(1);
    act(() => result.current.walkTo(onChair));
    run(4_000);
    expect(onWalkIntoChair).toHaveBeenCalledTimes(2);
  });
});
