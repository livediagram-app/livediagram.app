// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RoomOutgoing } from '@livedocuments/api-schema';
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
    canvasTool: 'laser',
    ...overrides,
  };
  const hook = renderHook((d: Deps) => useEditorBroadcast(d), { initialProps: deps });
  return { hook, deps, sent };
}

describe('useEditorBroadcast laser trail', () => {
  it('draws the local trail and clears it on a tool or tab change', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => (now += 100));
    const { hook, deps } = setup();
    act(() => {
      hook.result.current.broadcastLaser(1, 2);
      hook.result.current.broadcastLaser(3, 4);
    });
    expect(hook.result.current.localLaserTrail.map((p) => [p.x, p.y])).toEqual([
      [1, 2],
      [3, 4],
    ]);
    hook.rerender({ ...deps, activeId: 'tab2' });
    expect(hook.result.current.localLaserTrail).toEqual([]);
    act(() => hook.result.current.broadcastLaser(5, 6));
    expect(hook.result.current.localLaserTrail).toHaveLength(1);
    hook.rerender({ ...deps, activeId: 'tab2', canvasTool: 'select' });
    expect(hook.result.current.localLaserTrail).toEqual([]);
  });
});

// docs/specs/015-api/api.md `cursor`: peers see the cursor where it stopped.
describe('useEditorBroadcast cursor', () => {
  it('sends the last position a throttle window held back once the window ends', () => {
    vi.useFakeTimers();
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { hook, sent } = setup({ canvasTool: 'select' });
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
    const { hook, sent } = setup({ canvasTool: 'select' });
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
