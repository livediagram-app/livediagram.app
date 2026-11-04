// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Tab } from '@livehuddle/document';
import type { AvatarPresence } from '@livehuddle/api-schema';
import type { Participant } from '@/lib/identity';
import { usePresenceRows } from './usePresenceRows';

const p = (id: string): Participant => ({ id, name: id, color: '#123456', status: 'online' });
const self = p('me');
const peer = p('peer');

const rows = (cursorsHidden: boolean, avatarsHidden = false) =>
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
      remoteLaserTrails: new Map([['peer', { tabId: 't1', points: [{ x: 1, y: 2, t: 1 }] }]]),
      remoteAvatars: new Map([
        ['peer', { tabId: 't1', avatar: { x: 5, y: 6 } as unknown as AvatarPresence }],
      ]),
      localLaserTrail: [{ x: 3, y: 4, t: 1 }],
      cursorsHidden,
      avatarsHidden,
    }),
  ).result.current;

// The hide-cursors vote (docs/specs/012-collaboration/session-tools.md) and presenting
// (docs/specs/012-collaboration/presentation-mode.md) both set cursorsHidden.
describe('usePresenceRows cursorsHidden', () => {
  it("shows a peer's cursor and laser normally", () => {
    const r = rows(false);
    expect(r.remoteCursorRows.map((c) => c.id)).toEqual(['peer']);
    expect(r.laserTrailRows).toHaveLength(2);
  });

  it("withholds a peer's cursor and laser but keeps our own laser", () => {
    const r = rows(true);
    expect(r.remoteCursorRows).toEqual([]);
    expect(r.laserTrailRows).toHaveLength(1);
    expect(r.laserTrailRows[0]?.points).toEqual([{ x: 3, y: 4, t: 1 }]);
  });

  // docs/specs/008-canvas/avatar-mode.md "Realtime": the vote hides cursors only (owner, 2026-11-03).
  it("keeps a peer's character through a hide-cursors vote, and withholds it while presenting", () => {
    expect(rows(true).remoteAvatarRows.map((a) => a.id)).toEqual(['peer']);
    expect(rows(true, true).remoteAvatarRows).toEqual([]);
  });
});
