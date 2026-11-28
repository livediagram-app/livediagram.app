// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR_CONFIG } from '../config';
import { AVATAR_HAND_UP_MS } from '../reactions';
import { useAvatarWalk } from './useAvatarWalk';

// Raise Hand (docs/specs/008-canvas/avatar-mode.md "The avatar palette"): a held state, not a performance. A press
// raises it and the next lowers it; another Behaviour lowers it; it comes down by itself after AVATAR_HAND_UP_MS and
// when the mode ends. Up or down is told to the room once, as an idle packet.

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setup() {
  const onPresence = vi.fn();
  const hook = renderHook(
    ({ active }: { active: boolean }) =>
      useAvatarWalk({
        active,
        config: DEFAULT_AVATAR_CONFIG,
        onToggleGender: vi.fn(),
        elements: [],
        mainRef: { current: null },
        wrapperRef: { current: null },
        viewportOffset: { x: 0, y: 0 },
        viewportZoom: 1,
        setViewportOffset: vi.fn(),
        onPresence,
      }),
    { initialProps: { active: true } },
  );
  act(() => hook.result.current.teleportTo({ x: 40, y: 60 }));
  onPresence.mockClear();
  return { ...hook, onPresence };
}

const last = (onPresence: ReturnType<typeof vi.fn>) =>
  onPresence.mock.calls.at(-1)?.[0] as { handUp?: true } | null | undefined;

describe('useAvatarWalk raise hand', () => {
  it('raises on a press and lowers on the next, telling the room each time', () => {
    const { result, onPresence } = setup();
    act(() => result.current.playReaction('raise-hand'));
    expect(result.current.handUp).toBe(true);
    expect(onPresence).toHaveBeenCalledTimes(1);
    expect(last(onPresence)?.handUp).toBe(true);
    act(() => result.current.playReaction('raise-hand'));
    expect(result.current.handUp).toBe(false);
    expect(onPresence).toHaveBeenCalledTimes(2);
    expect(last(onPresence) && 'handUp' in last(onPresence)!).toBe(false);
  });

  it('comes down by itself after two minutes', () => {
    const { result } = setup();
    act(() => result.current.playReaction('raise-hand'));
    act(() => {
      vi.advanceTimersByTime(AVATAR_HAND_UP_MS - 1);
    });
    expect(result.current.handUp).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.handUp).toBe(false);
  });

  it('comes down when another Behaviour plays', () => {
    const { result } = setup();
    act(() => result.current.playReaction('raise-hand'));
    act(() => result.current.playReaction('clap'));
    expect(result.current.handUp).toBe(false);
  });

  it('is down when the mode ends', () => {
    const { result, rerender } = setup();
    act(() => result.current.playReaction('raise-hand'));
    rerender({ active: false });
    expect(result.current.handUp).toBe(false);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    rerender({ active: true });
    expect(result.current.handUp).toBe(false);
  });
});
