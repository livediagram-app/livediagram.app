// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, DRINK_HOLD_MS, type Element } from '@livediagram/document';
import { DEFAULT_AVATAR_CONFIG } from '@/lib/avatar-config';
import { FENCE_REACH } from '@/lib/avatar-fence';
import { useAvatarWalk } from './useAvatarWalk';

// Leaving Avatar mode (docs/specs/008-canvas/avatar-mode.md) drops whatever the character was doing and
// vacates its chair, and tells peers to drop it.

function setup(onPresence = vi.fn(), elements: Element[] = []) {
  const hook = renderHook(
    ({ active }: { active: boolean }) =>
      useAvatarWalk({
        active,
        config: DEFAULT_AVATAR_CONFIG,
        onToggleGender: vi.fn(),
        elements,
        mainRef: { current: null },
        wrapperRef: { current: null },
        viewportOffset: { x: 0, y: 0 },
        viewportZoom: 1,
        setViewportOffset: vi.fn(),
        onPresence,
      }),
    { initialProps: { active: true } },
  );
  return { ...hook, onPresence };
}

describe('useAvatarWalk leaving the mode', () => {
  it('vacates the chair, stands still and tells peers', () => {
    const { result, rerender, onPresence } = setup();
    act(() => result.current.sitOn('chair-1', { x: 10, y: 10 }, 'down'));
    expect(result.current.seatedOn).toBe('chair-1');
    onPresence.mockClear();

    rerender({ active: false });
    expect(result.current.seatedOn).toBeNull();
    expect(result.current.walking).toBe(false);
    expect(result.current.lift).toBe(0);
    expect(result.current.wave).toBeNull();
    expect(result.current.pose).toBeNull();
    expect(onPresence).toHaveBeenCalledWith(null);
  });

  it('comes back unseated', () => {
    const { result, rerender } = setup();
    act(() => result.current.sitOn('chair-1', { x: 10, y: 10 }, 'down'));
    rerender({ active: false });
    rerender({ active: true });
    expect(result.current.seatedOn).toBeNull();
  });
});

// docs/specs/009-elements/fence.md "Blocking": the walk loop runs every step through the fences.
describe('useAvatarWalk with a fence', () => {
  it('stops a click-walk at a fence', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    try {
      // A fence across y = 112, from x = 0 to 240.
      const fence = { ...createShape('fence', 0, 100), id: 'fence' };
      const { result } = setup(vi.fn(), [fence]);
      act(() => result.current.teleportTo({ x: 120, y: 200 }));
      act(() => result.current.walkTo({ x: 120, y: 0 }));
      act(() => vi.advanceTimersByTime(3000));
      const pos = result.current.pos!;
      expect(pos.y).toBeGreaterThanOrEqual(112 + FENCE_REACH);
      expect(pos.y).toBeLessThan(112 + FENCE_REACH + 1);
      expect(result.current.walking).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

// docs/specs/009-elements/office.md "Using it": a drink is presence, held for a minute, put down on leaving.
describe('useAvatarWalk with a drink', () => {
  it('holds a drink, tells peers at once, and puts it down after a minute', () => {
    vi.useFakeTimers();
    try {
      const { result, onPresence } = setup();
      act(() => result.current.teleportTo({ x: 50, y: 50 }));
      onPresence.mockClear();
      act(() => result.current.giveDrink('coffee'));
      expect(result.current.holding).toBe('coffee');
      expect(onPresence).toHaveBeenLastCalledWith(expect.objectContaining({ holding: 'coffee' }));
      // Another drink swaps the cup and restarts the minute.
      act(() => vi.advanceTimersByTime(DRINK_HOLD_MS - 1000));
      act(() => result.current.giveDrink('water'));
      act(() => vi.advanceTimersByTime(DRINK_HOLD_MS - 1000));
      expect(result.current.holding).toBe('water');
      act(() => vi.advanceTimersByTime(1000));
      expect(result.current.holding).toBeNull();
      expect(onPresence).toHaveBeenLastCalledWith(expect.objectContaining({ holding: null }));
    } finally {
      vi.useRealTimers();
    }
  });

  it('puts the drink down on leaving the mode', () => {
    const { result, rerender } = setup();
    act(() => result.current.teleportTo({ x: 50, y: 50 }));
    act(() => result.current.giveDrink('water'));
    rerender({ active: false });
    rerender({ active: true });
    expect(result.current.holding).toBeNull();
  });

  it('gives a drink on arriving at a machine, once', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    try {
      const cooler = { ...createShape('water-cooler', 100, 100), id: 'cooler' };
      const onWalkIntoDrink = vi.fn();
      const hook = renderHook(() =>
        useAvatarWalk({
          active: true,
          config: DEFAULT_AVATAR_CONFIG,
          onToggleGender: vi.fn(),
          elements: [cooler],
          mainRef: { current: null },
          wrapperRef: { current: null },
          viewportOffset: { x: 0, y: 0 },
          viewportZoom: 1,
          setViewportOffset: vi.fn(),
          onWalkIntoDrink,
        }),
      );
      act(() => hook.result.current.teleportTo({ x: 128, y: 400 }));
      act(() => hook.result.current.walkTo({ x: 128, y: 190 }));
      act(() => vi.advanceTimersByTime(3000));
      expect(onWalkIntoDrink).toHaveBeenCalledTimes(1);
      expect(onWalkIntoDrink).toHaveBeenCalledWith(expect.objectContaining({ id: 'cooler' }));
    } finally {
      vi.useRealTimers();
    }
  });
});
