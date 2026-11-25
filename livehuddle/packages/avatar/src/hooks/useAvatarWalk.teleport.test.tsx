// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR_CONFIG } from '../config';
import { useAvatarWalk } from './useAvatarWalk';

// A jump on this tab (docs/specs/009-elements/portal-element.md "Travelling"): the room is told where the character
// landed at once, never at the next step or heartbeat; travel to another tab says nothing on the tab being left.

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setup(active = true) {
  const onPresence = vi.fn();
  const hook = renderHook(
    ({ on }: { on: boolean }) =>
      useAvatarWalk({
        active: on,
        config: DEFAULT_AVATAR_CONFIG,
        onToggleGender: vi.fn(),
        elements: [],
        mainRef: { current: null },
        wrapperRef: { current: null },
        viewportOffset: { x: 0, y: 0 },
        viewportZoom: 1,
        setViewportOffset: vi.fn(),
        onPresence,
        peers: 1,
      }),
    { initialProps: { on: active } },
  );
  return { ...hook, onPresence };
}

describe('useAvatarWalk teleport', () => {
  it('tells the room where a jump on this tab landed, at once', () => {
    const { result, onPresence } = setup();
    act(() => result.current.teleportTo({ x: 40, y: 60 }));
    onPresence.mockClear();
    act(() => result.current.teleportTo({ x: 900, y: 700 }, 'far-portal'));
    expect(onPresence).toHaveBeenCalledTimes(1);
    expect(onPresence).toHaveBeenLastCalledWith(
      expect.objectContaining({ x: 900, y: 700, walking: false }),
    );
  });

  it('says nothing for travel to another tab', () => {
    const { result, onPresence } = setup();
    act(() => result.current.teleportTo({ x: 40, y: 60 }));
    onPresence.mockClear();
    act(() => result.current.teleportTo({ x: 900, y: 700 }, 'far-portal', true));
    expect(onPresence).not.toHaveBeenCalled();
  });

  it('says nothing while the mode is off', () => {
    const { result, onPresence } = setup(false);
    onPresence.mockClear();
    act(() => result.current.teleportTo({ x: 900, y: 700 }));
    expect(onPresence).not.toHaveBeenCalled();
  });
});
