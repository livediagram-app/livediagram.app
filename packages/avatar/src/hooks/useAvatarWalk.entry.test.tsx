// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR_CONFIG } from '../config';
import type { AvatarPoint } from '../walk';
import { useAvatarWalk } from './useAvatarWalk';

// Pressing a low Walk In button (docs/specs/008-canvas/avatar-mode.md "Entering from a button", Work Tracker #484): a
// character put down within the walk's follow margin of an edge, behind the bottom-right cluster, brings the view just
// far enough to show it, as the camera follow does while walking.

// A 1000 x 800 canvas whose content starts at its top-left corner, so a canvas point at zoom 1 is its screen point.
const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;
const node = (box: DOMRect) => ({ getBoundingClientRect: () => box }) as HTMLDivElement;

function pressAt(point: AvatarPoint, offset = { x: 40, y: -20 }) {
  const setViewportOffset = vi.fn();
  const hook = renderHook(() =>
    useAvatarWalk({
      active: true,
      config: DEFAULT_AVATAR_CONFIG,
      onToggleGender: vi.fn(),
      elements: [],
      mainRef: { current: node(rect(0, 0, 1000, 800)) },
      wrapperRef: { current: node(rect(0, 0, 1000, 800)) },
      viewportOffset: offset,
      viewportZoom: 1,
      setViewportOffset,
      spawnAtRef: { current: point },
    }),
  );
  return { ...hook, setViewportOffset };
}

describe('useAvatarWalk entering from a button', () => {
  it('brings a low spot out from behind the bottom chrome, adding to the view', () => {
    // 760 px down an 800 px view: 80 px inside the 120 px follow margin.
    const { result, setViewportOffset } = pressAt({ x: 500, y: 760 });
    expect(result.current.pos).toEqual({ x: 500, y: 760 });
    expect(setViewportOffset).toHaveBeenCalledTimes(1);
    expect(setViewportOffset).toHaveBeenCalledWith({ x: 40, y: -100 });
  });

  it('brings a spot near a side in sideways too', () => {
    const { setViewportOffset } = pressAt({ x: 950, y: 400 });
    expect(setViewportOffset).toHaveBeenCalledWith({ x: -30, y: -20 });
  });

  it('leaves the view alone for a spot well inside it', () => {
    const { setViewportOffset } = pressAt({ x: 500, y: 400 });
    expect(setViewportOffset).not.toHaveBeenCalled();
  });

  it('leaves a spot off screen to the opening, which brings the view to it', () => {
    const { result, setViewportOffset } = pressAt({ x: 500, y: 1200 });
    expect(result.current.pos).toEqual({ x: 500, y: 1200 });
    expect(setViewportOffset).not.toHaveBeenCalled();
  });
});
