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

const rows = () =>
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
      remoteAvatars: new Map([
        ['peer', { tabId: 't1', avatar: { x: 5, y: 6 } as unknown as AvatarPresence }],
      ]),
    }),
  ).result.current;

describe('usePresenceRows', () => {
  it("shows a peer's cursor and character on the active tab", () => {
    const r = rows();
    expect(r.remoteCursorRows.map((c) => c.id)).toEqual(['peer']);
    expect(r.remoteAvatarRows.map((a) => a.id)).toEqual(['peer']);
  });
});
