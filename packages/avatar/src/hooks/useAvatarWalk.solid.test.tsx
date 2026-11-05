// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR_CONFIG } from '../config';
import { seatFor } from '../seats';
import { useAvatarWalk } from './useAvatarWalk';

// Standing up from a stool tucked under a bar (livehuddle's docs/specs/009-elements/office.md "Bar, Bar Stool",
// fence.md "Blocking"): the seat lies in the counter's footprint, and the character it leaves there walks out of it
// rather than standing stuck in the bar.

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const bar = { id: 'bar', type: 'shape', shape: 'bar', x: 0, y: 0, width: 240, height: 120 };
// Its top at the counter's middle, so its seat (y 95.6) is 14.8 px inside the counter's front edge (y 110.4).
const stool = {
  id: 'stool',
  type: 'shape',
  shape: 'bar-stool',
  x: 98,
  y: 70,
  width: 44,
  height: 64,
};

describe('useAvatarWalk standing up in a footprint', () => {
  it('walks away from the bar after standing up from a stool tucked under it', () => {
    const { result } = renderHook(() =>
      useAvatarWalk({
        active: true,
        config: DEFAULT_AVATAR_CONFIG,
        onToggleGender: vi.fn(),
        elements: [bar, stool],
        mainRef: { current: null },
        wrapperRef: { current: null },
        viewportOffset: { x: 0, y: 0 },
        viewportZoom: 1,
        setViewportOffset: vi.fn(),
      }),
    );
    act(() => result.current.teleportTo({ x: 120, y: 160 }));
    const seat = seatFor({ ...stool, shape: 'bar-stool' }, { x: 120, y: 160 });
    act(() => result.current.sitOn('stool', seat, seat.facing));
    expect(result.current.pos).toEqual({ x: seat.x, y: seat.y, facing: 'up' });
    act(() => result.current.standUp());
    act(() => result.current.walkTo({ x: 120, y: 200 }));
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current.pos!.y).toBeCloseTo(200, 0);
  });
});
