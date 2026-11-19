// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomOp, RoomOutgoing } from '@livehuddle/api-schema';
import type { Tab } from '@livehuddle/document';
import type { RoomHandlers } from '@/lib/api-client';
import {
  createPreRoomOutbox,
  holdsOpKinds,
  sendOrHold,
  type PreRoomOutbox,
} from '@liveworkspace/workbench/lib/pre-room-outbox';

// What is sent before the room opens (docs/specs/012-collaboration/collab-race-hardening.md "Sent before the room
// client exists", Work Tracker 1263): an element edit is held for its document, handed to the room as it is made,
// and seen by a second client exactly once; a cursor from that moment is dropped.

// The room: every connected client's op reaches every other, as the Durable Object relays it.
const { relay } = vi.hoisted(() => ({
  relay: {
    clients: [] as { id: string; handlers: RoomHandlers; closed: boolean }[],
    heard: [] as { to: string; op: RoomOp }[],
  },
}));
vi.mock('@/lib/api-client', () => ({
  apiCreateRoomTicket: vi.fn(async () => ({ ticket: 'ticket' })),
  getSessionSharePassword: () => null,
  connectRoom: vi.fn((_id: string, self: { id: string }, handlers: RoomHandlers) => {
    const client = { id: self.id, handlers, closed: false };
    relay.clients.push(client);
    return {
      send: (msg: RoomOutgoing) => {
        if (msg.kind !== 'op') return;
        for (const peer of relay.clients) {
          if (peer === client || peer.closed) continue;
          relay.heard.push({ to: peer.id, op: msg.op });
          peer.handlers.onOp(self.id, msg.op);
        }
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

const { isMutationOpKind } = await import('@livehuddle/api-schema');
const { useRoomConnection } = await import('./useRoomConnection');
const { useElementDeltas } = await import('@/hooks/collab/useElementDeltas');

type Props = { documentId: string; serverStored: boolean; teamId?: string | null };

// One editor: its room hook, its pre-room hold (the room client's own outbox rule) and the delta hook sending
// through it.
function client(id: string, initial: Props) {
  let tabs: Tab[] = [{ id: 't1', name: 'T', elements: [] }];
  const preRoomOutbox: PreRoomOutbox<RoomOutgoing> = createPreRoomOutbox<RoomOutgoing>(
    holdsOpKinds((kind) => kind === 'poll-answer' || isMutationOpKind(kind)),
  );
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
  const tickTabs = (map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  };
  const hook = renderHook(
    (p: Props) => {
      useRoomConnection(
        withStubs({
          hydrated: true,
          enabled: true,
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
        }) as unknown as Parameters<typeof useRoomConnection>[0],
      );
      return useElementDeltas({ activeId: 't1', tickTabs, roomRef, preRoomOutbox });
    },
    { initialProps: initial },
  );
  const send = (op: RoomOp) => sendOrHold(preRoomOutbox, roomRef.current, { kind: 'op', op });
  return { hook, send, preRoomOutbox, roomRef, tabs: () => tabs };
}

const heardBy = (id: string, kind: string) =>
  relay.heard.filter((h) => h.to === id && h.op.kind === kind);
const removeComment = { kind: 'comment-remove', commentId: 'c1' } as const;

beforeEach(() => {
  relay.clients.length = 0;
  relay.heard.length = 0;
});

describe('sends made before the room opens', () => {
  it('reach a second client once the room opens, each exactly once', async () => {
    const watcher = client('watcher', { documentId: 'doc-1', serverStored: true });
    await waitFor(() => expect(watcher.roomRef.current).not.toBeNull());
    // The sender's page is up, its room not made yet: everything happens now.
    const sender = client('sender', { documentId: 'doc-1', serverStored: false });
    expect(sender.roomRef.current).toBeNull();
    act(() => sender.hook.result.current('e1', removeComment));
    // A cursor from this moment means nothing once the room opens.
    act(() => sender.send({ kind: 'cursor', tabId: 't1', x: 1, y: 2 } as unknown as RoomOp));
    expect(relay.heard).toEqual([]);
    expect(sender.preRoomOutbox.held).toHaveLength(1);

    sender.hook.rerender({ documentId: 'doc-1', serverStored: true });
    await waitFor(() => expect(heardBy('watcher', 'el-delta')).toHaveLength(1));
    expect(heardBy('watcher', 'cursor')).toHaveLength(0);
    expect(relay.heard.map((h) => h.op.kind)).toEqual(['el-delta']);
    expect(sender.preRoomOutbox.held).toEqual([]);

    // The room made again for the same document (a team change reopens it): nothing replays.
    sender.hook.rerender({ documentId: 'doc-1', serverStored: true, teamId: 'team-1' });
    await waitFor(() => expect(relay.clients.filter((c) => c.id === 'sender')).toHaveLength(2));
    expect(relay.heard).toHaveLength(1);
  });

  it('drops what was held when the document is left before the room opens', async () => {
    const watcher = client('watcher', { documentId: 'doc-2', serverStored: true });
    await waitFor(() => expect(watcher.roomRef.current).not.toBeNull());
    const sender = client('sender', { documentId: 'doc-1', serverStored: false });
    act(() => sender.hook.result.current('e1', removeComment));
    // Off to doc-2: what was made on doc-1 must never reach doc-2's room.
    sender.hook.rerender({ documentId: 'doc-2', serverStored: true });
    await waitFor(() => expect(sender.roomRef.current).not.toBeNull());
    expect(relay.heard).toEqual([]);
    expect(sender.preRoomOutbox.held).toEqual([]);
  });

  it('once the room is open, sends straight through and holds nothing', async () => {
    const watcher = client('watcher', { documentId: 'doc-1', serverStored: true });
    const sender = client('sender', { documentId: 'doc-1', serverStored: true });
    await waitFor(() => expect(sender.roomRef.current).not.toBeNull());
    await waitFor(() => expect(watcher.roomRef.current).not.toBeNull());
    act(() => sender.hook.result.current('e1', removeComment));
    expect(heardBy('watcher', 'el-delta')).toHaveLength(1);
    expect(sender.preRoomOutbox.held).toEqual([]);
  });
});
