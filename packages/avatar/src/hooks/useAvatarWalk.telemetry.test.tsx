// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { avatarBindings } from '../bindings';
import { DEFAULT_AVATAR_CONFIG } from '../config';
import { useAvatarWalk } from './useAvatarWalk';

// What a character's moves and seats count (docs/specs/008-canvas/avatar-mode.md "Telemetry",
// docs/specs/009-elements/chair.md "Telemetry"): one event per gesture, never which move or which seat.

let track: MockInstance<typeof avatarBindings.track>;
beforeEach(() => {
  vi.useFakeTimers();
  track = vi.spyOn(avatarBindings, 'track').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setup() {
  const hook = renderHook(() =>
    useAvatarWalk({
      active: true,
      config: DEFAULT_AVATAR_CONFIG,
      onToggleGender: vi.fn(),
      elements: [],
      mainRef: { current: null },
      wrapperRef: { current: null },
      viewportOffset: { x: 0, y: 0 },
      viewportZoom: 1,
      setViewportOffset: vi.fn(),
      onPresence: vi.fn(),
    }),
  );
  act(() => hook.result.current.teleportTo({ x: 40, y: 60 }));
  track.mockClear();
  return hook;
}

describe('useAvatarWalk telemetry', () => {
  it('counts each move performed, never which', () => {
    const { result } = setup();
    act(() => result.current.playReaction('wave'));
    act(() => result.current.playReaction('dance'));
    expect(track.mock.calls).toEqual([
      ['Canvas', 'Used', 'AvatarAction'],
      ['Canvas', 'Used', 'AvatarAction'],
    ]);
  });

  it('counts sitting down once, and standing up not at all', () => {
    const { result } = setup();
    act(() => result.current.sitOn('chair', { x: 50, y: 70 }, 'down'));
    expect(track.mock.calls).toEqual([['Canvas', 'Used', 'Sit']]);
    act(() => result.current.standUp());
    expect(track).toHaveBeenCalledTimes(1);
  });
});
