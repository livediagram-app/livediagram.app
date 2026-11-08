// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Tab } from '@liveplanner/project';
import type { Participant } from '@/lib/identity';
import { createPeerMotion } from '@/lib/peer-motion';
import { usePeerCursorRows } from '@/hooks/collab/usePeerRows';
import { usePresenceRows } from './usePresenceRows';

const p = (id: string): Participant => ({ id, name: id, color: '#123456', status: 'online' });
const self = p('me');
const peer = p('peer');

const motion = createPeerMotion();
motion.cursors.set(new Map([['peer', { tabId: 't1', x: 10, y: 20 }]]));

const rows = (cursorsHidden: boolean) =>
  renderHook(() => {
    const presence = usePresenceRows({
      projectShareable: true,
      projectTeamId: null,
      activeId: 't1',
      selfParticipant: self,
      tabs: [{ id: 't1', elements: [] } as unknown as Tab],
      livePresence: [self, peer],
      liveAgents: [],
      presenceClock: { now: 1000, lastSeen: new Map([['peer', 1000]]) },
      remoteTabFocus: new Map([['peer', 't1']]),
      remoteSelections: new Map(),
      peerMotion: motion,
      cursorsHidden,
    });
    return { remoteCursorRows: usePeerCursorRows(presence.peerRows) };
  }).result.current;

// The hide-cursors vote (docs/specs/012-collaboration/session-tools.md) sets cursorsHidden.
describe('usePresenceRows cursorsHidden', () => {
  it("shows a peer's cursor normally", () => {
    expect(rows(false).remoteCursorRows.map((c) => c.id)).toEqual(['peer']);
  });

  it("withholds a peer's cursor", () => {
    expect(rows(true).remoteCursorRows).toEqual([]);
  });
});
