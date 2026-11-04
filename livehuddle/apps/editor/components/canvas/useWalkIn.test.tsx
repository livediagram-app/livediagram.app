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

  it('nudges the view up when the spot is on screen but behind the bottom chrome', () => {
    // 1000 x 800 canvas: a button whose spot lands 40px above the bottom edge, inside the 120px follow margin.
    const b = box(448, 0);
    const feet = below(b);
    const shifted = box(448, 800 - 40 - feet.y);
    const { setViewportOffset } = setup(shifted);
    expect(setViewportOffset).toHaveBeenCalledWith({ x: 0, y: -80 });
  });

  it('reads the current offset back from the wrapper, at any zoom', () => {
    const spawnAtRef = { current: null as AvatarPoint | null };
    const setViewportOffset = vi.fn();
    const b = box(100, 100);
    const feet = below(b);
    // Zoom 2, wrapper translated by (-50, -40) canvas px: the spot sits at y = (feet.y - 40) * 2 on screen.
    const wrapperTop = -40 * 2;
    const mainHeight = (feet.y - 40) * 2 + 20;
    renderHook(() =>
      useWalkIn({
        walkIn: { button: b, seq: 1 },
        scale: SCALE,
        spawnAtRef,
        mainRef: { current: el(rect(0, 0, 1000, mainHeight)) },
        wrapperRef: { current: el(rect(-100, wrapperTop, 1000, 800)) },
        viewportZoom: 2,
        setViewportOffset,
      }),
    );
    // 20px from the bottom: 100px short of the margin, 50 canvas px at zoom 2.
    expect(setViewportOffset).toHaveBeenCalledWith({ x: -50, y: -40 - 50 });
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
