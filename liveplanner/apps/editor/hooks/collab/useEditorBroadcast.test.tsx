// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RoomOutgoing } from '@liveplanner/api-schema';
import { useEditorBroadcast } from './useEditorBroadcast';

type Deps = Parameters<typeof useEditorBroadcast>[0];

afterEach(() => vi.restoreAllMocks());

function setup(overrides: Partial<Deps> = {}) {
  const sent: RoomOutgoing[] = [];
  const deps: Deps = {
    roomRef: { current: { send: (m: RoomOutgoing) => void sent.push(m) } },
    hydrated: true,
    projectId: 'd1',
    projectShareable: true,
    projectTeamId: null,
    activeId: 'tab1',
    cursorsHidden: false,
    ...overrides,
  };
  const hook = renderHook((d: Deps) => useEditorBroadcast(d), { initialProps: deps });
  return { hook, deps, sent };
}

// Vote privacy (docs/specs/012-collaboration/session-tools.md).
describe('useEditorBroadcast hidden cursors', () => {
  it('retracts the cursor once when a hide-cursors vote opens, and sends nothing while it runs', () => {
    const { hook, deps, sent } = setup();
    hook.rerender({ ...deps, cursorsHidden: true });
    expect(sent).toEqual([{ kind: 'op', op: { kind: 'cursor', tabId: 'tab1', x: null, y: null } }]);
    act(() => hook.result.current.broadcastCursor({ x: 1, y: 1 }));
    expect(sent).toHaveLength(1);
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

  it('never follows the pointer leaving, or a hide-cursors vote, with a held-back position', () => {
    vi.useFakeTimers();
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { hook, sent, deps } = setup();
    act(() => hook.result.current.broadcastCursor({ x: 1, y: 1 }));
    now += 5;
    act(() => hook.result.current.broadcastCursor({ x: 2, y: 2 }));
    act(() => hook.result.current.broadcastCursor(null));
    now += 5;
    act(() => hook.result.current.broadcastCursor({ x: 3, y: 3 }));
    hook.rerender({ ...deps, cursorsHidden: true });
    act(() => {
      vi.runAllTimers();
    });
    expect(sent.map((m) => (m.kind === 'op' && m.op.kind === 'cursor' ? m.op.x : 'x'))).toEqual([
      1,
      null,
      null,
    ]);
    vi.useRealTimers();
  });
});
