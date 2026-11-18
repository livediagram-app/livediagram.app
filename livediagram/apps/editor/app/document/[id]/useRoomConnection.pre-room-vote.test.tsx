// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomOutgoing } from '@livediagram/api-schema';
import type { Tab } from '@livediagram/document';
import type { RoomHandlers } from '@/lib/api-client';
import { createPreRoomOutbox, sendOrHold, type PreRoomOutbox } from './pre-room-outbox';

// A dot cast before the room opens (docs/specs/012-collaboration/session-tools.md "A dot cast before the room opens",
// Work Tracker 1064): held for its document, handed to the room as it is made, and seen by a second client, once.

// The room: every connected client's op reaches every other, as the Durable Object relays it.
const { relay } = vi.hoisted(() => ({
  relay: {
    clients: [] as { id: string; handlers: RoomHandlers; closed: boolean }[],
    sent: [] as { from: string; msg: RoomOutgoing }[],
  },
}));
vi.mock('@/lib/api-client', () => ({
  apiCreateRoomTicket: vi.fn(async () => ({ ticket: 'ticket' })),
  getSessionSharePassword: () => null,
  connectRoom: vi.fn((_doc: string, self: { id: string }, handlers: RoomHandlers) => {
    const client = { id: self.id, handlers, closed: false };
    relay.clients.push(client);
    return {
      send: (msg: RoomOutgoing) => {
        relay.sent.push({ from: self.id, msg });
        if (msg.kind !== 'op') return;
        for (const peer of relay.clients)
          if (peer !== client && !peer.closed) peer.handlers.onOp(self.id, msg.op);
      },
      close: () => {
        client.closed = true;
      },
    };
  }),
}));
vi.mock('@/lib/api/document-grants', () => ({
  keepDocumentGrantFresh: () => () => {},
  documentGrant: async () => null,
}));

const { useRoomConnection } = await import('./useRoomConnection');
const { applyRoomOpToTabs } = await import('./room-op-apply');

const openVote = (): Tab[] => [
  {
    id: 't1',
    name: 'Board',
    elements: [],
    vote: { active: true, revealed: false, votesPerPerson: 3, votes: {}, round: 'r1' },
  },
];

type Props = { documentId: string; serverStored: boolean; teamId?: string | null };

// One editor: its room hook, its pre-room hold and the tabs a peer's ops land in.
function client(id: string, initial: Props) {
  let tabs = openVote();
  const preRoomOutbox: PreRoomOutbox = createPreRoomOutbox();
  const roomRef = {
    current: null as ReturnType<typeof import('@/lib/api-client').connectRoom> | null,
  };
  // Every handler the test does not name is a stub, read through the proxy as the hook destructures it.
  const stubs: Record<string | symbol, unknown> = {};
  const withStubs = <T extends object>(given: T): T =>
    new Proxy(given, {
      get: (t, k) => (k in t ? t[k as keyof T] : (stubs[k] ??= vi.fn())),
    });
  const self = { id, key: id, name: id, color: '#0ea5e9', status: 'online' as const };
  const hook = renderHook(
    (p: Props) =>
      useRoomConnection(
        withStubs({
          hydrated: true,
          documentId: p.documentId,
          documentServerStored: p.serverStored,
          documentTeamId: p.teamId ?? null,
          selfParticipant: self,
          sessionShareCode: null,
          lastSeenRef: { current: new Map() },
          selfParticipantRef: { current: self },
          saveBaseline: {
            tabs: { current: [] },
            name: { current: '' },
            journal: { current: { entries: [] } as never },
          },
          sessionShareCodeRef: { current: null },
          roomRef,
          preRoomOutbox,
          loadedTabIdsRef: { current: new Set(['t1']) },
          applyRemoteOp: (apply: (prev: Tab[]) => Tab[]) => {
            tabs = apply(tabs);
          },
        }) as unknown as Parameters<typeof useRoomConnection>[0],
      ),
    { initialProps: initial },
  );
  // What emitVote in useEditorSessionTools sends for one dot.
  const castDot = (documentId: string) =>
    sendOrHold(preRoomOutbox, roomRef.current, documentId, {
      kind: 'op',
      op: { kind: 'vote', tabId: 't1', elementId: 'idea', voter: id, delta: 1, round: 'r1' },
    });
  const dots = () => tabs[0]!.vote!.votes['idea']?.length ?? 0;
  return { hook, castDot, dots, preRoomOutbox, roomRef };
}

const votesSent = () => relay.sent.filter((s) => s.msg.kind === 'op' && s.msg.op.kind === 'vote');

beforeEach(() => {
  relay.clients.length = 0;
  relay.sent.length = 0;
});

describe('a dot cast before the room opens', () => {
  it('reaches a second client once the room opens, exactly once', async () => {
    const watcher = client('watcher', { documentId: 'doc-1', serverStored: true });
    await waitFor(() => expect(watcher.roomRef.current).not.toBeNull());
    // The voter's page is up, its room not made yet: the dot is cast now.
    const voter = client('voter', { documentId: 'doc-1', serverStored: false });
    expect(voter.roomRef.current).toBeNull();
    voter.castDot('doc-1');
    expect(watcher.dots()).toBe(0);

    voter.hook.rerender({ documentId: 'doc-1', serverStored: true });
    await waitFor(() => expect(watcher.dots()).toBe(1));
    expect(votesSent()).toHaveLength(1);

    // The room made again for the same document (a team change reopens it): nothing replays.
    voter.hook.rerender({ documentId: 'doc-1', serverStored: true, teamId: 'team-1' });
    await waitFor(() => expect(relay.clients.filter((c) => c.id === 'voter')).toHaveLength(2));
    expect(votesSent()).toHaveLength(1);
    expect(watcher.dots()).toBe(1);
  });

  it('drops what was held when the document is left before the room opens', async () => {
    const watcher = client('watcher', { documentId: 'doc-2', serverStored: true });
    await waitFor(() => expect(watcher.roomRef.current).not.toBeNull());
    const voter = client('voter', { documentId: 'doc-1', serverStored: false });
    voter.castDot('doc-1');
    // Off to doc-2: a dot cast on doc-1 must never reach doc-2's room.
    voter.hook.rerender({ documentId: 'doc-2', serverStored: true });
    await waitFor(() => expect(voter.roomRef.current).not.toBeNull());
    expect(votesSent()).toHaveLength(0);
    expect(voter.preRoomOutbox.held).toEqual([]);
  });

  it('applies the held dot on the receiver like any dot', () => {
    // The receiving half is the ordinary vote op: one dot, counted once.
    const tabs = applyRoomOpToTabs(openVote(), {
      kind: 'vote',
      tabId: 't1',
      elementId: 'idea',
      voter: 'voter',
      delta: 1,
      round: 'r1',
    });
    expect(tabs[0]!.vote!.votes['idea']).toEqual(['voter']);
  });
});
