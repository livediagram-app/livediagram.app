// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR_CONFIG } from '../config';
import type { SeatClaim, SeatHolder } from '../seat-claims';
import { useAvatarWalk } from './useAvatarWalk';
import { useSeatYield } from './useSeatYield';

// One sitter per seat (docs/specs/009-elements/chair.md "Sitting" and "Occupancy is presence"): a seated character
// cannot be pushed, sitting and standing reach the room at once with the seat's claim, and the later of two people
// who sat on one seat at once stands up beside it.

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000);
  vi.spyOn(Math, 'random').mockReturnValue(0.25);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const rug = { id: 'rug', type: 'shape', shape: 'rug', x: 0, y: 0, width: 400, height: 400 };

function setup() {
  const onPresence = vi.fn();
  const hook = renderHook(() =>
    useAvatarWalk({
      active: true,
      config: DEFAULT_AVATAR_CONFIG,
      onToggleGender: vi.fn(),
      elements: [rug],
      mainRef: { current: null },
      wrapperRef: { current: null },
      viewportOffset: { x: 0, y: 0 },
      viewportZoom: 1,
      setViewportOffset: vi.fn(),
      onPresence,
    }),
  );
  act(() => hook.result.current.teleportTo({ x: 40, y: 60 }));
  onPresence.mockClear();
  return { ...hook, onPresence };
}

describe('useAvatarWalk seats', () => {
  it('tells the room at once which seat it sat on, when, and the tiebreak', () => {
    const { result, onPresence } = setup();
    act(() => result.current.sitOn('sofa', { x: 50, y: 70 }, 'down', 1));
    const claim = { index: 1, at: 1_000, tie: 0.25 };
    expect(result.current.seatedOn).toBe('sofa');
    expect(result.current.seatClaim).toEqual(claim);
    expect(onPresence).toHaveBeenLastCalledWith(
      expect.objectContaining({ x: 50, y: 70, facing: 'down', seatedOn: 'sofa', seat: claim }),
    );
  });

  it('claims the first seat of a one-seat piece', () => {
    const { result } = setup();
    act(() => result.current.sitOn('chair', { x: 50, y: 70 }, 'left'));
    expect(result.current.seatClaim?.index).toBe(0);
  });

  it('frees the seat for the room at once on standing up', () => {
    const { result, onPresence } = setup();
    act(() => result.current.sitOn('chair', { x: 50, y: 70 }, 'down'));
    onPresence.mockClear();
    act(() => result.current.standUp());
    expect(result.current.seatedOn).toBeNull();
    expect(result.current.seatClaim).toBeNull();
    const packet = onPresence.mock.lastCall?.[0] as Record<string, unknown>;
    expect(packet.seatedOn).toBeNull();
    expect(packet).not.toHaveProperty('seat');
    // Standing while standing tells nobody anything.
    onPresence.mockClear();
    act(() => result.current.standUp());
    expect(onPresence).not.toHaveBeenCalled();
  });

  it('a seated character ignores a push; a standing one takes it', () => {
    const { result } = setup();
    act(() => result.current.sitOn('chair', { x: 50, y: 70 }, 'down'));
    act(() => result.current.shove(1, 0));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.pos).toEqual({ x: 50, y: 70 });
    expect(result.current.seatedOn).toBe('chair');
    act(() => result.current.standUp());
    act(() => result.current.shove(1, 0));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.pos!.x).toBeGreaterThan(50);
  });

  it('steps aside without walking: standing, at the spot, and told to the room', () => {
    const { result, onPresence } = setup();
    act(() => result.current.sitOn('chair', { x: 50, y: 70 }, 'down'));
    onPresence.mockClear();
    act(() => result.current.stepAside({ x: 90, y: 70 }));
    expect(result.current.seatedOn).toBeNull();
    expect(result.current.pos).toEqual({ x: 90, y: 70 });
    expect(onPresence).toHaveBeenLastCalledWith(
      expect.objectContaining({ x: 90, y: 70, seatedOn: null }),
    );
    // Stepping aside while standing (a full piece) just moves the feet.
    act(() => result.current.stepAside({ x: 10, y: 10 }));
    expect(result.current.pos).toEqual({ x: 10, y: 10 });
  });
});

describe('useSeatYield', () => {
  const chair = { id: 'chair', type: 'shape', shape: 'chair', x: 0, y: 0, width: 64, height: 72 };
  const own: SeatClaim = { index: 0, at: 100, tie: 0.5 };
  const peer = (at: number): SeatHolder => ({
    x: 0,
    y: 0,
    seatedOn: 'chair',
    seat: { index: 0, at, tie: 0.5 },
  });

  it('stands the later sitter up beside the seat, and leaves the earlier one seated', () => {
    const onYield = vi.fn();
    const { rerender } = renderHook(
      ({ peers }: { peers: SeatHolder[] }) =>
        useSeatYield({ seatedOn: 'chair', claim: own, elements: [chair], peers, onYield }),
      { initialProps: { peers: [peer(101)] } },
    );
    expect(onYield).not.toHaveBeenCalled();
    rerender({ peers: [peer(99)] });
    expect(onYield).toHaveBeenCalledTimes(1);
    expect(onYield.mock.lastCall?.[0]).toMatchObject({ y: 72 + 12 });
  });
});
