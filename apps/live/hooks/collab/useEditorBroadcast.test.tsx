// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RoomOutgoing } from '@livediagram/api-schema';
import { useEditorBroadcast } from './useEditorBroadcast';

type Deps = Parameters<typeof useEditorBroadcast>[0];

afterEach(() => vi.restoreAllMocks());

function setup(overrides: Partial<Deps> = {}) {
  const sent: RoomOutgoing[] = [];
  const deps: Deps = {
    roomRef: { current: { send: (m: RoomOutgoing) => void sent.push(m) } },
    hydrated: true,
    diagramId: 'd1',
    diagramShareable: true,
    diagramTeamId: null,
    activeId: 'tab1',
    canvasTool: 'laser',
    cursorsHidden: false,
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
