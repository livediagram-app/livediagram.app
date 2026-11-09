// @vitest-environment jsdom
// docs/specs/008-canvas/canvas-performance.md "Walking renders the characters, not the canvas" (blueprint:
// avatar-pose-store.md): two seconds of walking render the hook's host (the canvas, in an editor) only when a fact
// under the feet changes, while the pose store follows every frame. Before the store the host rendered every frame:
// 125 renders for 125 frames.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR_CONFIG } from '../config';
import { useAvatarWalk } from './useAvatarWalk';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

// A big board: 2,000 boxes 200 px apart, so a walk crosses a box about every 0.8 s.
const BOARD = Array.from({ length: 2000 }, (_, i) => ({
  id: `e${i}`,
  type: 'shape',
  shape: 'rectangle',
  x: (i % 50) * 200,
  y: Math.floor(i / 50) * 200,
  width: 120,
  height: 80,
}));
const FRAMES = 125;

function walkingHost() {
  let renders = 0;
  const hook = renderHook(() => {
    renders += 1;
    return useAvatarWalk({
      active: true,
      config: DEFAULT_AVATAR_CONFIG,
      onToggleGender: vi.fn(),
      elements: BOARD,
      mainRef: { current: null },
      wrapperRef: { current: null },
      viewportOffset: { x: 0, y: 0 },
      viewportZoom: 1,
      setViewportOffset: vi.fn(),
    });
  });
  return { ...hook, renders: () => renders };
}

describe('walking', () => {
  it(`renders its host only when the element under the feet changes, over ${FRAMES} frames`, () => {
    const { result, renders } = walkingHost();
    act(() => result.current.teleportTo({ x: 10, y: 10 }));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    let poses = 0;
    const off = result.current.poseStore.subscribe(() => {
      poses += 1;
    });
    const under: (string | null)[] = [];
    const before = renders();
    act(() => result.current.walkTo({ x: 5000, y: 10 }));
    for (let f = 0; f < FRAMES; f++) {
      act(() => {
        vi.advanceTimersByTime(16);
      });
      if (under.at(-1) !== result.current.standingOnId) under.push(result.current.standingOnId);
    }
    off();
    // The pose followed every frame, and the character walked about half a kilometre of canvas.
    expect(poses).toBeGreaterThanOrEqual(FRAMES - 1);
    expect(result.current.readPos()!.x).toBeGreaterThan(400);
    // Off e0, between, onto e1, between, onto e2: one render for each change, and nothing else.
    expect(under.length).toBeGreaterThan(2);
    expect(renders() - before).toBeLessThanOrEqual(under.length + 1);
  });

  it('notifies nobody while it stands still', () => {
    const { result, renders } = walkingHost();
    act(() => result.current.teleportTo({ x: 150, y: 150 }));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const listener = vi.fn();
    const off = result.current.poseStore.subscribe(listener);
    const before = renders();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    off();
    expect(listener).not.toHaveBeenCalled();
    expect(renders()).toBe(before);
  });
});

// The centred camera reading the view from a store (livehuddle's canvas writes a pan outside React): every step
// moves the store's offset, a pan from elsewhere mid-walk is adopted, and the host renders no more than above.
describe('the centred camera with a view reader', () => {
  function box(rect: () => { left: number; top: number }) {
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({ ...rect(), width: 800, height: 600 }) as DOMRect;
    return el;
  }

  it('follows the walk through the reader and adopts a pan made elsewhere', () => {
    let offset = { x: 0, y: 0 };
    const setViewportOffset = vi.fn((next: { x: number; y: number }) => {
      offset = next;
    });
    const main = box(() => ({ left: 0, top: 0 }));
    const wrapper = box(() => ({ left: offset.x, top: offset.y }));
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useAvatarWalk({
        active: true,
        camera: 'centred',
        config: DEFAULT_AVATAR_CONFIG,
        onToggleGender: vi.fn(),
        elements: [],
        mainRef: { current: main },
        wrapperRef: { current: wrapper },
        readViewportOffset: () => offset,
        viewportZoom: 1,
        setViewportOffset,
      });
    });
    act(() => result.current.teleportTo({ x: 400, y: 300 }));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const before = renders;
    act(() => result.current.walkTo({ x: 1400, y: 300 }));
    for (let f = 0; f < 30; f++) {
      act(() => {
        vi.advanceTimersByTime(16);
      });
    }
    // The view slid left after the character, one write a step, with no render for it.
    expect(setViewportOffset.mock.calls.length).toBeGreaterThan(10);
    expect(offset.x).toBeLessThan(-50);
    expect(offset.y).toBe(0);
    expect(renders - before).toBeLessThanOrEqual(2);
    // A pan from elsewhere: the next step builds on it (easing back from there), not on what the walk last wrote.
    offset = { x: offset.x, y: -500 };
    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(offset.y).toBeLessThan(-450);
  });
});
