// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AvatarPoint } from '@liveworkspace/avatar/walk';
import { useWalkIn } from './useWalkIn';

// docs/specs/008-canvas/avatar-mode.md "Opening walking": the character starts below the Walk In button, and the view
// comes to it when it is off screen.
const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;
const el = (r: DOMRect) => ({ getBoundingClientRect: () => r }) as unknown as HTMLElement;

function setup(feet: AvatarPoint | null, seq = 1, nodes = true) {
  const spawnAtRef = { current: null as AvatarPoint | null };
  const setViewportOffset = vi.fn();
  const view = renderHook(
    ({ s }: { s: number }) =>
      useWalkIn({
        walkIn: feet ? { feet, seq: s } : null,
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
  it('sets the start spot and leaves an on-screen view alone', () => {
    const { spawnAtRef, setViewportOffset } = setup({ x: 400, y: 300 });
    expect(spawnAtRef.current).toEqual({ x: 400, y: 300 });
    expect(setViewportOffset).not.toHaveBeenCalled();
  });

  it('centres the view on a start spot off screen', () => {
    const { setViewportOffset } = setup({ x: 3000, y: 300 });
    expect(setViewportOffset).toHaveBeenCalledWith({ x: 500 - 3000, y: 400 - 300 });
  });

  it('does nothing without a request', () => {
    const { spawnAtRef, setViewportOffset } = setup(null);
    expect(spawnAtRef.current).toBeNull();
    expect(setViewportOffset).not.toHaveBeenCalled();
  });

  it('sets the spot even before the canvas has measured, without moving the view', () => {
    const { spawnAtRef, setViewportOffset } = setup({ x: 3000, y: 300 }, 1, false);
    expect(spawnAtRef.current).toEqual({ x: 3000, y: 300 });
    expect(setViewportOffset).not.toHaveBeenCalled();
  });

  it('answers each request once', () => {
    const { rerender, setViewportOffset } = setup({ x: 3000, y: 300 });
    rerender({ s: 1 });
    expect(setViewportOffset).toHaveBeenCalledOnce();
    rerender({ s: 2 });
    expect(setViewportOffset).toHaveBeenCalledTimes(2);
  });
});
