// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Tab } from '@livedesign/design';
import type { Participant } from '@/lib/identity';
import { usePresenceRows } from './usePresenceRows';

const p = (id: string): Participant => ({ id, name: id, color: '#123456', status: 'online' });
const self = p('me');
const peer = p('peer');

const rows = () =>
  renderHook(() =>
    usePresenceRows({
      designShareable: true,
      designTeamId: null,
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
      localLaserTrail: [{ x: 3, y: 4, t: 1 }],
    }),
  ).result.current;

describe('usePresenceRows', () => {
  it("shows a peer's cursor and laser beside our own", () => {
    const r = rows();
    expect(r.remoteCursorRows.map((c) => c.id)).toEqual(['peer']);
    expect(r.laserTrailRows).toHaveLength(2);
  });
});
