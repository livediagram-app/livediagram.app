// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomOp, RoomOutgoing } from '@livediagram/api-schema';
import type { Tab } from '@livediagram/document';
import type { RoomHandlers } from '@/lib/api-client';
import {
  createPreRoomOutbox,
  sendOrHold,
  type PreRoomOutbox,
} from '@liveworkspace/workbench/lib/pre-room-outbox';

// What is sent before the room opens (docs/specs/012-collaboration/collab-race-hardening.md "Sent before the room
// client exists", session-tools.md "A dot cast before the room opens", Work Tracker 1064 and 1263): a dot, a live
// poll's start, answer and end, an element edit and an idea are held for their document, handed to the room as it is
// made, and seen by a second client exactly once; a cursor from that moment is dropped.

// The room: every connected client's op reaches every other, as the Durable Object relays it.
const { relay } = vi.hoisted(() => ({
  relay: {
    clients: [] as { id: string; handlers: RoomHandlers; closed: boolean }[],
    sent: [] as { from: string; msg: RoomOutgoing }[],
    heard: [] as { to: string; op: RoomOp }[],
  },
}));
vi.mock('@/lib/api-client', async () => {
  const { isMutationOpKind } = await import('@livediagram/api-schema');
  return {
    apiCreateRoomTicket: vi.fn(async () => ({ ticket: 'ticket' })),
    getSessionSharePassword: () => null,
    // The editor's own outbox rule (lib/api/room.ts).
    isOutboxOp: (msg: RoomOutgoing) =>
      msg.kind === 'op' && (msg.op.kind === 'poll-answer' || isMutationOpKind(msg.op.kind)),
    connectRoom: vi.fn((_doc: string, self: { id: string }, handlers: RoomHandlers) => {
      const client = { id: self.id, handlers, closed: false };
      relay.clients.push(client);
      return {
        send: (msg: RoomOutgoing) => {
          relay.sent.push({ from: self.id, msg });
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
  };
});
vi.mock('@/lib/api/document-grants', () => ({
  keepDocumentGrantFresh: () => () => {},
  documentGrant: async () => null,
}));
vi.mock('@/lib/telemetry', () => ({ track: () => {} }));

const { isOutboxOp } = await import('@/lib/api-client');
const { useRoomConnection } = await import('./useRoomConnection');
const { applyRoomOpToTabs } = await import('./room-op-apply');
const { useElementDeltas } = await import('@/hooks/collab/useElementDeltas');
const { useLivePoll } = await import('@/hooks/collab/useLivePoll');
const { useIdeaPosts } = await import('@/hooks/collab/useIdeaPosts');

const openVote = (): Tab[] => [
  {
    id: 't1',
    name: 'Board',
    elements: [
      {
        id: 'box',
        type: 'shape',
        shape: 'idea-box',
        x: 0,
        y: 0,
        width: 340,
        height: 420,
      },
    ],
    vote: { active: true, revealed: false, votesPerPerson: 3, votes: {}, round: 'r1' },
  },
];

type Props = { documentId: string; serverStored: boolean; teamId?: string | null };

// One editor: its room hook, its pre-room hold, the hooks that send through it, and the tabs a peer's ops land in.
function client(id: string, initial: Props) {
  let tabs = openVote();
  const preRoomOutbox: PreRoomOutbox<RoomOutgoing> = createPreRoomOutbox(isOutboxOp);
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
      );
      return {
        applyDelta: useElementDeltas({ activeId: 't1', tickTabs, roomRef, preRoomOutbox }),
        poll: useLivePoll({ roomRef, preRoomOutbox }),
        ideas: useIdeaPosts({ tabs, tickTabs, roomRef, preRoomOutbox, onRefused: () => {} }),
      };
    },
    { initialProps: initial },
  );
  // What emitVote in useEditorSessionTools sends for one dot.
  const castDot = () =>
    sendOrHold(preRoomOutbox, roomRef.current, {
      kind: 'op',
      op: { kind: 'vote', tabId: 't1', elementId: 'box', voter: id, delta: 1, round: 'r1' },
    });
  const dots = () => tabs[0]!.vote!.votes['box']?.length ?? 0;
  return { hook, castDot, dots, preRoomOutbox, roomRef, tabs: () => tabs };
}

const heardBy = (id: string, kind: string) =>
  relay.heard.filter((h) => h.to === id && h.op.kind === kind);

beforeEach(() => {
  relay.clients.length = 0;
  relay.sent.length = 0;
  relay.heard.length = 0;
});

describe('sends made before the room opens', () => {
  it('reach a second client once the room opens, each exactly once', async () => {
    const watcher = client('watcher', { documentId: 'doc-1', serverStored: true });
    await waitFor(() => expect(watcher.roomRef.current).not.toBeNull());
    // The sender's page is up, its room not made yet: everything happens now.
    const sender = client('sender', { documentId: 'doc-1', serverStored: false });
    expect(sender.roomRef.current).toBeNull();
    act(() => {
      sender.castDot();
      sender.hook.result.current.poll.startPoll({ question: 'Lunch?', style: 'text', options: [] });
    });
    act(() => sender.hook.result.current.poll.answerPoll('Pizza'));
    act(() =>
      sender.hook.result.current.applyDelta('box', { kind: 'idea', text: 'Tea', id: 'c1' }),
    );
    act(
      () =>
        void sender.hook.result.current.ideas.post(
          't1',
          openVote()[0]!.elements[0] as never,
          'Cake',
        ),
    );
    act(() => sender.hook.result.current.poll.endPoll());
    // A cursor from this moment means nothing once the room opens.
    act(() =>
      sendOrHold(sender.preRoomOutbox, sender.roomRef.current, {
        kind: 'op',
        op: { kind: 'cursor', tabId: 't1', x: 1, y: 2 },
      }),
    );
    expect(relay.heard).toEqual([]);
    expect(sender.preRoomOutbox.held).toHaveLength(6);

    sender.hook.rerender({ documentId: 'doc-1', serverStored: true });
    await waitFor(() => expect(heardBy('watcher', 'poll-end')).toHaveLength(1));
    expect(heardBy('watcher', 'vote')).toHaveLength(1);
    expect(heardBy('watcher', 'poll-start')).toHaveLength(1);
    expect(heardBy('watcher', 'poll-answer')).toHaveLength(1);
    expect(heardBy('watcher', 'el-delta')).toHaveLength(2);
    expect(heardBy('watcher', 'cursor')).toHaveLength(0);
    // In the order they were made.
    expect(relay.heard.map((h) => h.op.kind)).toEqual([
      'vote',
      'poll-start',
      'poll-answer',
      'el-delta',
      'el-delta',
      'poll-end',
    ]);
    expect(watcher.dots()).toBe(1);
    expect(sender.preRoomOutbox.held).toEqual([]);

    // The room made again for the same document (a team change reopens it): nothing replays.
    sender.hook.rerender({ documentId: 'doc-1', serverStored: true, teamId: 'team-1' });
    await waitFor(() => expect(relay.clients.filter((c) => c.id === 'sender')).toHaveLength(2));
    expect(relay.heard).toHaveLength(6);
    expect(watcher.dots()).toBe(1);
  });

  it('drops what was held when the document is left before the room opens', async () => {
    const watcher = client('watcher', { documentId: 'doc-2', serverStored: true });
    await waitFor(() => expect(watcher.roomRef.current).not.toBeNull());
    const sender = client('sender', { documentId: 'doc-1', serverStored: false });
    act(() => {
      sender.castDot();
      sender.hook.result.current.applyDelta('box', { kind: 'idea', text: 'Tea', id: 'c1' });
    });
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
    act(() =>
      sender.hook.result.current.applyDelta('box', { kind: 'idea', text: 'Tea', id: 'c1' }),
    );
    expect(heardBy('watcher', 'el-delta')).toHaveLength(1);
    expect(sender.preRoomOutbox.held).toEqual([]);
  });

  it('applies the held dot on the receiver like any dot', () => {
    // The receiving half is the ordinary vote op: one dot, counted once.
    const tabs = applyRoomOpToTabs(openVote(), {
      kind: 'vote',
      tabId: 't1',
      elementId: 'box',
      voter: 'sender',
      delta: 1,
      round: 'r1',
    });
    expect(tabs[0]!.vote!.votes['box']).toEqual(['sender']);
  });
});
