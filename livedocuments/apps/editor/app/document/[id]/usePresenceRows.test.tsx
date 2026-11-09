// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createStateStore } from '@liveworkspace/workbench/lib/state-store';
import type { Tab } from '@livedocuments/document';
import type { Participant } from '@/lib/identity';
import { usePresenceRows } from './usePresenceRows';
import { usePresenceState } from './usePresenceState';

const p = (id: string): Participant => ({ id, name: id, color: '#123456', status: 'online' });
const self = p('me');
const peer = p('peer');

const rows = (cursorsHidden: boolean) =>
  renderHook(() =>
    usePresenceRows({
      documentShareable: true,
      documentTeamId: null,
      activeId: 't1',
      selfParticipant: self,
      tabs: [{ id: 't1', elements: [] } as unknown as Tab],
      livePresence: [self, peer],
      liveAgents: [],
      presenceClock: { now: 1000, lastSeen: new Map([['peer', 1000]]) },
      remoteTabFocus: new Map([['peer', 't1']]),
      remoteCursors: new Map([['peer', { tabId: 't1', x: 10, y: 20 }]]),
      remoteSelections: new Map(),
      remoteLaserTrails: createStateStore(
        new Map([['peer', { tabId: 't1', points: [{ x: 1, y: 2, t: 1 }] }]]),
      ),
      localLaserTrail: [{ x: 3, y: 4, t: 1 }],
      cursorsHidden,
    }),
  ).result.current;

// Presenting (docs/specs/012-collaboration/presentation-mode.md) sets cursorsHidden.
describe('usePresenceRows cursorsHidden', () => {
  it("shows a peer's cursor and laser normally", () => {
    const r = rows(false);
    expect(r.remoteCursorRows.map((c) => c.id)).toEqual(['peer']);
    expect(r.laserTrailRows.get()).toHaveLength(2);
  });

  it("withholds a peer's cursor and laser but keeps our own laser", () => {
    const r = rows(true);
    expect(r.remoteCursorRows).toEqual([]);
    expect(r.laserTrailRows.get()).toHaveLength(1);
    expect(r.laserTrailRows.get()[0]?.points).toEqual([{ x: 3, y: 4, t: 1 }]);
  });
});

// docs/specs/008-canvas/canvas-performance.md "A peer's laser renders the trails, not the editor": a trail frame was
// editor state and rendered the whole editor; now it reaches the overlay's subscription and renders nothing else.
describe("a peer's laser trail", () => {
  it("renders nothing for a peer's laser trail, and reaches the overlay's subscription", () => {
    let renders = 0;
    const hook = renderHook(() => {
      renders++;
      const state = usePresenceState();
      return {
        state,
        rows: usePresenceRows({
          documentShareable: true,
          documentTeamId: null,
          activeId: 't1',
          selfParticipant: self,
          tabs: [{ id: 't1', elements: [] } as unknown as Tab],
          livePresence: [self, peer],
          liveAgents: [],
          presenceClock: { now: 1000, lastSeen: new Map([['peer', 1000]]) },
          remoteTabFocus: new Map([['peer', 't1']]),
          remoteCursors: new Map([['peer', { tabId: 't1', x: 10, y: 20 }]]),
          remoteSelections: new Map(),
          remoteLaserTrails: state.remoteLaserTrails,
          localLaserTrail: [{ x: 3, y: 4, t: 1 }],
          cursorsHidden: false,
        }),
      };
    });
    const { state, rows } = hook.result.current;
    const overlay = vi.fn();
    const off = rows.laserTrailRows.subscribe(overlay);
    const before = renders;
    for (let n = 1; n <= 50; n++)
      act(() =>
        state.setRemoteLaserTrails((prev) =>
          new Map(prev).set('peer', { tabId: 't1', points: [{ x: n, y: n, t: n }] }),
        ),
      );
    expect(renders).toBe(before);
    expect(overlay).toHaveBeenCalledTimes(50);
    expect(hook.result.current.rows.laserTrailRows.get().at(-1)?.points).toEqual([
      { x: 50, y: 50, t: 50 },
    ]);
    off();
  });
});
