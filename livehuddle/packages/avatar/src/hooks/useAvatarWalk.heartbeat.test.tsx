// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR_CONFIG } from '../config';
import { AVATAR_HEARTBEAT_MS } from '../walk';
import { useAvatarWalk } from './useAvatarWalk';

// The standing heartbeat (docs/specs/008-canvas/avatar-mode.md "Realtime"): a character standing still repeats
// itself every few seconds, but only to someone who can see it. Alone or in a hidden tab it rests, so the room can
// hibernate; someone joining, or the tab coming back, gets one beat at once.

let visibility: DocumentVisibilityState = 'visible';
beforeEach(() => {
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setup(initial: { active?: boolean; peers?: number }) {
  const onPresence = vi.fn();
  const hook = renderHook(
    ({ active, peers }: { active: boolean; peers?: number }) =>
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
        ...(peers === undefined ? {} : { peers }),
      }),
    { initialProps: { active: initial.active ?? true, peers: initial.peers } },
  );
  act(() => hook.result.current.teleportTo({ x: 40, y: 60 }));
  onPresence.mockClear();
  return { ...hook, onPresence };
}

const idleBeats = (onPresence: ReturnType<typeof vi.fn>) =>
  onPresence.mock.calls.filter(
    (call) => (call[0] as { walking?: boolean } | null)?.walking === false,
  ).length;

const tick = (ms = AVATAR_HEARTBEAT_MS) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const setVisibility = (next: DocumentVisibilityState) =>
  act(() => {
    visibility = next;
    document.dispatchEvent(new Event('visibilitychange'));
  });

describe('useAvatarWalk standing heartbeat', () => {
  it('beats every interval while someone else is in the room', () => {
    const { onPresence } = setup({ peers: 1 });
    tick(AVATAR_HEARTBEAT_MS * 3);
    expect(idleBeats(onPresence)).toBe(3);
    expect(onPresence).toHaveBeenLastCalledWith(expect.objectContaining({ x: 40, y: 60 }));
  });

  it('keeps the plain heartbeat where the editor does not know the roster', () => {
    const { onPresence } = setup({});
    tick(AVATAR_HEARTBEAT_MS * 2);
    expect(idleBeats(onPresence)).toBe(2);
  });

  it('rests while nobody else is in the room', () => {
    const { onPresence } = setup({ peers: 0 });
    tick(AVATAR_HEARTBEAT_MS * 10);
    expect(onPresence).not.toHaveBeenCalled();
  });

  it('rests while the tab is hidden, and beats once when it comes back', () => {
    const { onPresence } = setup({ peers: 2 });
    setVisibility('hidden');
    tick(AVATAR_HEARTBEAT_MS * 10);
    expect(onPresence).not.toHaveBeenCalled();
    setVisibility('visible');
    expect(idleBeats(onPresence)).toBe(1);
    tick();
    expect(idleBeats(onPresence)).toBe(2);
  });

  it('says nothing on coming back to a room with nobody in it', () => {
    const { onPresence } = setup({ peers: 0 });
    setVisibility('hidden');
    setVisibility('visible');
    expect(onPresence).not.toHaveBeenCalled();
  });

  it('beats at once when someone joins, from a hidden tab too, then keeps the interval', () => {
    const { onPresence, rerender } = setup({ peers: 0 });
    setVisibility('hidden');
    rerender({ active: true, peers: 1 });
    expect(idleBeats(onPresence)).toBe(1);
    // Hidden: no interval beats after the join's one.
    tick(AVATAR_HEARTBEAT_MS * 3);
    expect(idleBeats(onPresence)).toBe(1);
    setVisibility('visible');
    tick();
    expect(idleBeats(onPresence)).toBe(3);
  });

  it('beats for each newcomer, and not when someone leaves', () => {
    const { onPresence, rerender } = setup({ peers: 1 });
    rerender({ active: true, peers: 2 });
    expect(idleBeats(onPresence)).toBe(1);
    rerender({ active: true, peers: 1 });
    expect(idleBeats(onPresence)).toBe(1);
  });

  it('beats when the roster first arrives with people in it', () => {
    const { onPresence, rerender } = setup({});
    rerender({ active: true, peers: 3 });
    expect(idleBeats(onPresence)).toBe(1);
  });

  it('does not take entering the mode for a join', () => {
    const { onPresence, rerender } = setup({ peers: 0 });
    rerender({ active: false, peers: 0 });
    rerender({ active: false, peers: 2 });
    onPresence.mockClear();
    rerender({ active: true, peers: 2 });
    // Entry publishes its own standing snapshot; no join beat on top of it.
    expect(idleBeats(onPresence)).toBe(1);
    rerender({ active: true, peers: 2 });
    expect(idleBeats(onPresence)).toBe(1);
  });

  it('stops listening for the tab once the mode ends', () => {
    const { onPresence, rerender } = setup({ peers: 1 });
    rerender({ active: false, peers: 1 });
    onPresence.mockClear();
    setVisibility('hidden');
    setVisibility('visible');
    tick(AVATAR_HEARTBEAT_MS * 2);
    expect(onPresence).not.toHaveBeenCalled();
  });

  it('leaves a walk to publish itself, even when someone joins mid-walk', () => {
    const { onPresence, result, rerender } = setup({ peers: 0 });
    act(() => result.current.walkTo({ x: 900, y: 60 }));
    onPresence.mockClear();
    rerender({ active: true, peers: 1 });
    expect(onPresence).not.toHaveBeenCalledWith(expect.objectContaining({ walking: false }));
  });
});
