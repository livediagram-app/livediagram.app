// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RoomOutgoing } from '@livehuddle/api-schema';
import { useEditorBroadcast } from './useEditorBroadcast';

type Deps = Parameters<typeof useEditorBroadcast>[0];

afterEach(() => vi.restoreAllMocks());

function setup(overrides: Partial<Deps> = {}) {
  const sent: RoomOutgoing[] = [];
  const deps: Deps = {
    roomRef: { current: { send: (m: RoomOutgoing) => void sent.push(m) } },
    hydrated: true,
    documentId: 'd1',
    documentShareable: true,
    documentTeamId: null,
    activeId: 'tab1',
    roomSize: 2,
    ...overrides,
  };
  const hook = renderHook((d: Deps) => useEditorBroadcast(d), { initialProps: deps });
  return { hook, deps, sent };
}

// docs/specs/012-collaboration/proximity-audio.md "The wire".
describe('useEditorBroadcast call signals', () => {
  it('go out only while the room is open', () => {
    const open = setup();
    expect(open.hook.result.current.callsRoom).toBe(true);
    const team = setup({ documentShareable: false, documentTeamId: 'team1' });
    expect(team.hook.result.current.callsRoom).toBe(true);
    const closed = setup({ documentShareable: false });
    expect(closed.hook.result.current.callsRoom).toBe(false);
    act(() => closed.hook.result.current.broadcastCallSignal({ kind: 'call-track', track: null }));
    expect(closed.sent).toEqual([]);
  });
});

// docs/specs/008-canvas/avatar-mode.md "Status": a change is told at once, never lost to the throttle.
describe('useEditorBroadcast avatar packets', () => {
  const packet = (status: 'focus' | 'meeting') =>
    ({
      x: 0,
      y: 0,
      facing: 'down',
      walking: false,
      stepFrame: 0,
      lift: 0,
      wave: null,
      status,
    }) as never;

  it('sends the packet a throttle window held back once the window ends', () => {
    vi.useFakeTimers();
    try {
      const { hook, sent } = setup();
      act(() => {
        hook.result.current.broadcastAvatar(packet('focus'));
        // Picked again inside the window: held, not dropped.
        hook.result.current.broadcastAvatar(packet('meeting'));
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      const statuses = sent
        .filter((m) => m.kind === 'op' && m.op.kind === 'avatar')
        .map((m) => (m.kind === 'op' && m.op.kind === 'avatar' ? m.op.avatar?.status : null));
      // The last word reaches the room, however the window fell.
      expect(statuses.at(-1)).toBe('meeting');
    } finally {
      vi.useRealTimers();
    }
  });

  // docs/specs/008-canvas/avatar-mode.md "A busy room"
  it('paces the character by the room: 33 ms up to 10 people, 66 ms above 32', () => {
    vi.useFakeTimers();
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    try {
      const walkFor = (roomSize: number) => {
        const { hook, sent } = setup({ roomSize });
        const avatars = () => sent.filter((m) => m.kind === 'op' && m.op.kind === 'avatar');
        act(() => hook.result.current.broadcastAvatar(packet('focus')));
        now += 40;
        act(() => hook.result.current.broadcastAvatar(packet('meeting')));
        return avatars().length;
      };
      // 40 ms on, a small room has sent the second packet; a full one is still holding it.
      expect(walkFor(2)).toBe(2);
      expect(walkFor(100)).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

// docs/specs/015-api/api.md `cursor`: peers see the cursor where it stopped.
describe('useEditorBroadcast cursor', () => {
  it('sends the last position a throttle window held back once the window ends', () => {
    vi.useFakeTimers();
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { hook, sent } = setup();
    act(() => hook.result.current.broadcastCursor({ x: 1, y: 1 }));
    now += 5;
    act(() => hook.result.current.broadcastCursor({ x: 2, y: 2 }));
    now += 5;
    act(() => hook.result.current.broadcastCursor({ x: 9, y: 9 }));
    expect(sent.map((m) => (m.kind === 'op' && m.op.kind === 'cursor' ? m.op.x : null))).toEqual([
      1,
    ]);
    now += 40;
    act(() => {
      vi.runAllTimers();
    });
    expect(sent.map((m) => (m.kind === 'op' && m.op.kind === 'cursor' ? m.op.x : null))).toEqual([
      1, 9,
    ]);
    vi.useRealTimers();
  });

  it('never follows the pointer leaving with a held-back position', () => {
    vi.useFakeTimers();
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { hook, sent } = setup();
    act(() => hook.result.current.broadcastCursor({ x: 1, y: 1 }));
    now += 5;
    act(() => hook.result.current.broadcastCursor({ x: 2, y: 2 }));
    act(() => hook.result.current.broadcastCursor(null));
    act(() => {
      vi.runAllTimers();
    });
    expect(sent.map((m) => (m.kind === 'op' && m.op.kind === 'cursor' ? m.op.x : 'x'))).toEqual([
      1,
      null,
    ]);
    vi.useRealTimers();
  });
});
