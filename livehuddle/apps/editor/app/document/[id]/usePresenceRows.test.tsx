// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Tab } from '@livehuddle/document';
import type { AvatarPresence } from '@livehuddle/api-schema';
import type { Participant } from '@/lib/identity';
import { createPeerMotion } from '@/lib/peer-motion';
import { usePeerAvatarRows, usePeerCursorRows } from '@/hooks/collab/usePeerRows';
import { usePresenceRows } from './usePresenceRows';

const p = (id: string): Participant => ({ id, name: id, color: '#123456', status: 'online' });
const self = p('me');
const peer = p('peer');

const builder = p('builder');
const motion = createPeerMotion();
motion.cursors.set(
  new Map([
    ['peer', { tabId: 't1', x: 10, y: 20 }],
    ['builder', { tabId: 't1', x: 30, y: 40 }],
  ]),
);
motion.avatars.set(
  new Map([['peer', { tabId: 't1', avatar: { x: 5, y: 6 } as unknown as AvatarPresence }]]),
);

const rows = () =>
  renderHook(() => {
    const presence = usePresenceRows({
      documentShareable: true,
      documentTeamId: null,
      activeId: 't1',
      selfParticipant: self,
      tabs: [{ id: 't1', elements: [] } as unknown as Tab],
      livePresence: [self, peer, builder],
      liveAgents: [],
      presenceClock: {
        now: 1000,
        lastSeen: new Map([
          ['peer', 1000],
          ['builder', 1000],
        ]),
      },
      remoteTabFocus: new Map([
        ['peer', 't1'],
        ['builder', 't1'],
      ]),
      remoteSelections: new Map(),
      peerMotion: motion,
    });
    return {
      remoteCursorRows: usePeerCursorRows(presence.peerRows),
      remoteAvatarRows: usePeerAvatarRows(presence.peerRows),
    };
  }).result.current;

describe('usePresenceRows', () => {
  // avatar-mode.md "Cursors while walking" (Work Tracker 706): a walking peer is their character, not a cursor too.
  it("shows a walking peer's character and no cursor, and a building peer's cursor", () => {
    const r = rows();
    expect(r.remoteCursorRows.map((c) => c.id)).toEqual(['builder']);
    expect(r.remoteAvatarRows.map((a) => a.id)).toEqual(['peer']);
  });
});
