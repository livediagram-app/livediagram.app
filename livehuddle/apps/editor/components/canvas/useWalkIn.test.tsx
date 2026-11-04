// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { avatarSpawnBelow, type AvatarPoint } from '@liveworkspace/avatar/walk';
import type { WalkInButton } from '@/lib/walk-entrance';
import { useWalkIn } from './useWalkIn';

// docs/specs/008-canvas/avatar-mode.md "Opening walking": the character starts below the Walk In button, and the view
// comes to it when it is off screen.
const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;
const el = (r: DOMRect) => ({ getBoundingClientRect: () => r }) as unknown as HTMLElement;

// A 104 x 96 Walk In button at (x, y), and where a Regular character (scale 1.5) starts below it.
const SCALE = 1.5;
const box = (x: number, y: number): WalkInButton => ({ x, y, width: 104, height: 96 });
const below = (b: WalkInButton) => avatarSpawnBelow(b, SCALE);

function setup(button: WalkInButton | null, seq = 1, nodes = true) {
  const spawnAtRef = { current: null as AvatarPoint | null };
  const setViewportOffset = vi.fn();
  const view = renderHook(
    ({ s }: { s: number }) =>
      useWalkIn({
        walkIn: button ? { button, seq: s } : null,
        scale: SCALE,
        spawnAtRef,
        mainRef: { current: nodes ? el(rect(0, 0, 1000, 800)) : null },
        wrapperRef: { current: nodes ? el(rect(0, 0, 1000, 800)) : null },
        viewportZoom: 1,
        setViewportOffset,
      }),
    { initialProps: { s: seq } },
  );
  return { ...view, spawnAtRef, setViewportOffset };
}

describe('useWalkIn', () => {
  it('sets the start spot below the button and leaves an on-screen view alone', () => {
    const { spawnAtRef, setViewportOffset } = setup(box(348, 100));
    expect(spawnAtRef.current).toEqual(below(box(348, 100)));
    expect(spawnAtRef.current?.y).toBeGreaterThan(100 + 96);
    expect(setViewportOffset).not.toHaveBeenCalled();
  });

  it('centres the view on a start spot off screen', () => {
    const { setViewportOffset } = setup(box(2948, 100));
    const feet = below(box(2948, 100));
    expect(setViewportOffset).toHaveBeenCalledWith({ x: 500 - feet.x, y: 400 - feet.y });
  });

  it('does nothing without a request', () => {
    const { spawnAtRef, setViewportOffset } = setup(null);
    expect(spawnAtRef.current).toBeNull();
    expect(setViewportOffset).not.toHaveBeenCalled();
  });

  it('sets the spot even before the canvas has measured, without moving the view', () => {
    const { spawnAtRef, setViewportOffset } = setup(box(2948, 100), 1, false);
    expect(spawnAtRef.current).toEqual(below(box(2948, 100)));
    expect(setViewportOffset).not.toHaveBeenCalled();
  });

  it('answers each request once', () => {
    const { rerender, setViewportOffset } = setup(box(2948, 100));
    rerender({ s: 1 });
    expect(setViewportOffset).toHaveBeenCalledOnce();
    rerender({ s: 2 });
    expect(setViewportOffset).toHaveBeenCalledTimes(2);
  });
});
