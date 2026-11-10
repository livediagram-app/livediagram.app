// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_FORMAT, ROOM_FULL_CLOSE, ROOM_FULL_RETRY_MS } from '@livehuddle/api-schema';
import { resetServerReleaseForTests, serverBuild, serverDocumentFormat } from '../server-release';
import {
  connectRoom,
  ROOM_KEEPALIVE_IDLE_MS,
  ROOM_KEEPALIVE_TIMEOUT_MS,
  ROOM_SEQUENCE_ACK_TIMEOUT_MS,
  roomQueryString,
} from './room';

// docs/specs/015-api/api.md "Realtime model": the upgrade URL is logged, so it carries the spent-on-use
// ticket and nothing else; the share code, the owner id, its signature and the share password go to the
// ticket mint as headers.
describe('roomQueryString (the room upgrade carries only the ticket)', () => {
  it('carries the ticket as `t`', () => {
    expect(roomQueryString('T')).toBe('t=T');
  });

  it('is empty without a ticket', () => {
    expect(roomQueryString(null)).toBe('');
    expect(roomQueryString('')).toBe('');
  });

  it('url-encodes the ticket', () => {
    expect(roomQueryString('a b&c')).toBe('t=a+b%26c');
  });
});

// The reconnect cursor (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1). The room skips the sender when it
// relays an op, so the client's own ops only ever reach its cursor through a
// `cursor` frame; without one a reconnect asked for them back and re-applied
// its own delta ops, counting each one twice.
describe('connectRoom reconnect cursor', () => {
  class FakeSocket {
    static OPEN = 1;
    static all: FakeSocket[] = [];
    readyState = 1;
    sent: unknown[] = [];
    private listeners: Record<string, ((e: { data?: string }) => void)[]> = {};
    constructor() {
      FakeSocket.all.push(this);
    }
    addEventListener(type: string, fn: (e: { data?: string }) => void) {
      (this.listeners[type] ??= []).push(fn);
    }
    send(data: string) {
      this.sent.push(JSON.parse(data));
    }
    close() {}
    fire(type: string, data?: unknown) {
      for (const fn of this.listeners[type] ?? [])
        fn(data === undefined ? {} : { data: JSON.stringify(data) });
    }
  }

  beforeEach(() => {
    FakeSocket.all = [];
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function reconnectSync(frames: unknown[]) {
    const room = connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
    );
    const first = FakeSocket.all[0]!;
    first.fire('open');
    for (const f of frames) first.fire('message', f);
    first.fire('close');
    vi.runOnlyPendingTimers();
    const second = FakeSocket.all[1]!;
    second.fire('open');
    room.close();
    return second.sent.find((m) => (m as { kind: string }).kind === 'sync');
  }

  it('asks only for what followed its own last op', () => {
    expect(
      reconnectSync([
        { kind: 'cursor', epoch: 'E', seq: 0 },
        { kind: 'op', from: 'peer', op: { kind: 'noop' }, seq: 1, epoch: 'E' },
        { kind: 'cursor', epoch: 'E', seq: 2 },
      ]),
    ).toEqual({ kind: 'sync', epoch: 'E', lastSeq: 2 });
  });

  it('adopts the cursor from joining, so a quiet session does not ask for the whole log', () => {
    expect(reconnectSync([{ kind: 'cursor', epoch: 'E', seq: 7 }])).toEqual({
      kind: 'sync',
      epoch: 'E',
      lastSeq: 7,
    });
  });

  it('notes the document format number the room sends on joining', () => {
    // docs/specs/016-platform/new-version-prompt.md.
    const room = connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
    );
    const socket = FakeSocket.all[0]!;
    socket.fire('open');
    socket.fire('message', { kind: 'format', format: DOCUMENT_FORMAT + 1, build: 'b2' });
    expect(serverDocumentFormat()).toBe(DOCUMENT_FORMAT + 1);
    expect(serverBuild()).toBe('b2');
    room.close();
    resetServerReleaseForTests();
  });

  it("ignores another epoch's cursor, leaving the catch-up to reconcile", () => {
    expect(
      reconnectSync([
        { kind: 'cursor', epoch: 'E', seq: 3 },
        { kind: 'cursor', epoch: 'OTHER', seq: 9 },
      ]),
    ).toEqual({ kind: 'sync', epoch: 'E', lastSeq: 3 });
  });
});

describe('connectRoom outbox (docs/specs/012-collaboration/collab-race-hardening.md)', () => {
  // A frame the client sent, as far as these tests read it.
  type Sent = { kind: string; op?: { kind: string } };
  class FakeSocket {
    static OPEN = 1;
    static all: FakeSocket[] = [];
    readyState = 0;
    sent: Sent[] = [];
    private listeners: Record<string, ((e: { data?: string }) => void)[]> = {};
    url: string;
    constructor(url = '') {
      this.url = url;
      FakeSocket.all.push(this);
    }
    addEventListener(type: string, fn: (e: { data?: string }) => void) {
      (this.listeners[type] ??= []).push(fn);
    }
    send(data: string) {
      this.sent.push(JSON.parse(data) as Sent);
    }
    close() {}
    fire(type: string) {
      if (type === 'open') this.readyState = 1;
      if (type === 'close') this.readyState = 3;
      for (const fn of this.listeners[type] ?? []) fn({});
    }
    receive(data: string) {
      for (const fn of this.listeners.message ?? []) fn({ data });
    }
  }

  beforeEach(() => {
    FakeSocket.all = [];
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('holds changes made while the socket is down and sends them, in order, on reconnect', () => {
    const room = connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
    );
    const first = FakeSocket.all[0]!;
    first.fire('open');
    first.fire('close');
    const tick = (index: number) =>
      ({
        kind: 'op',
        op: {
          kind: 'el-delta',
          tabId: 't',
          elementId: 'e',
          delta: { kind: 'check', index, text: 'x', done: true },
        },
      }) as never;
    room.send(tick(1));
    room.send({ kind: 'op', op: { kind: 'cursor', x: 1, y: 2 } } as never);
    room.send(tick(2));
    vi.runOnlyPendingTimers();
    const second = FakeSocket.all[1]!;
    second.fire('open');
    expect(second.sent.map((m) => m.op?.kind ?? m.kind)).toEqual([
      'hello',
      'sync',
      'el-delta',
      'el-delta',
    ]);
    expect(
      second.sent
        .slice(2)
        .map((m) => (m.op as unknown as { delta: { index: number } }).delta.index),
    ).toEqual([1, 2]);
  });

  // A longer outage (a laptop asleep, wifi gone for a minute) outlasts the backoff's attempts: the
  // connector then waits for the network or the tab and starts again, rather than staying down for good.
  it('starts a fresh round of attempts once back online after using them all up', () => {
    const room = connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
    );
    FakeSocket.all[0]!.fire('open');
    FakeSocket.all[0]!.fire('close');
    for (let i = 0; i < 6; i++) {
      vi.runOnlyPendingTimers();
      FakeSocket.all[FakeSocket.all.length - 1]!.fire('close');
    }
    vi.runAllTimers();
    const parkedAt = FakeSocket.all.length;
    expect(parkedAt).toBe(7);
    // Still hidden: a tab in the background waits until it is shown.
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(FakeSocket.all).toHaveLength(parkedAt);
    visibility.mockReturnValue('visible');
    window.dispatchEvent(new Event('online'));
    expect(FakeSocket.all).toHaveLength(parkedAt + 1);
    // A second wake while that round runs starts nothing more.
    document.dispatchEvent(new Event('visibilitychange'));
    expect(FakeSocket.all).toHaveLength(parkedAt + 1);
    visibility.mockRestore();
    room.close();
  });

  it('starts nothing on a wake while it still has attempts, nor once closed', () => {
    const room = connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
    );
    FakeSocket.all[0]!.fire('open');
    window.dispatchEvent(new Event('online'));
    expect(FakeSocket.all).toHaveLength(1);
    room.close();
    window.dispatchEvent(new Event('online'));
    expect(FakeSocket.all).toHaveLength(1);
  });

  it('reconnects with a freshly minted ticket, since the room spends each one it admits', async () => {
    const mintTicket = vi.fn(async () => 'second');
    connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
      { ticket: 'first', mintTicket },
    );
    const first = FakeSocket.all[0]!;
    expect(first.url).toContain('t=first');
    first.fire('open');
    first.fire('close');
    await vi.runOnlyPendingTimersAsync();
    expect(mintTicket).toHaveBeenCalledOnce();
    expect(FakeSocket.all[1]!.url).toContain('t=second');
  });

  // The room asks for a fresh grant before the one it holds lapses (GrantRenewMessage); the answer goes back on
  // the socket that asked, and nothing goes when no grant can be had.
  it('answers a grant-renew with a fresh grant on the asking socket', async () => {
    const renewGrant = vi.fn(async () => 'fresh-grant');
    connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
      { ticket: 'first', renewGrant },
    );
    const socket = FakeSocket.all[0]!;
    socket.fire('open');
    socket.receive(JSON.stringify({ kind: 'grant-renew', expiresAt: Date.now() + 60_000 }));
    await vi.waitFor(() => expect(renewGrant).toHaveBeenCalledOnce());
    await Promise.resolve();
    expect(socket.sent).toContainEqual({ kind: 'grant', grant: 'fresh-grant' });
  });

  // docs/specs/015-api/api.md "A busy room bounds its presence fan-out": the hello says we take batches, and a
  // batch frame is each of its frames handled in turn.
  it('says it takes batches, and applies every op a batch frame holds', () => {
    const ops: [string, unknown][] = [];
    connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp: (from, op) => void ops.push([from, op]) },
      { ticket: 'first' },
    );
    const socket = FakeSocket.all[0]!;
    socket.fire('open');
    expect(socket.sent[0]).toMatchObject({ kind: 'hello', batches: true });
    const avatar = (tabId: string) => ({ kind: 'avatar', tabId, avatar: null });
    socket.receive(
      JSON.stringify({
        kind: 'batch',
        frames: [
          { kind: 'op', from: 'a', op: avatar('t1') },
          { kind: 'op', from: 'b', op: avatar('t2') },
        ],
      }),
    );
    expect(ops).toEqual([
      ['a', avatar('t1')],
      ['b', avatar('t2')],
    ]);
  });

  // docs/specs/008-canvas/avatar-mode.md "A busy room", "The costume rides only when it is needed": the hello says
  // we read lean packets, and we send them only once the room's `format` frame says it takes them.
  it('sends lean avatar packets only to a room that takes them, carrying the costume when it is due', () => {
    const room = connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
      { ticket: 'first' },
    );
    const costume = { gender: 'female', clothing: 'hoodie', hair: 'bun', size: 'regular' } as const;
    const walk = (x: number) =>
      ({
        kind: 'op',
        op: {
          kind: 'avatar',
          tabId: 't1',
          avatar: {
            x,
            y: 2,
            facing: 'down',
            config: costume,
            walking: true,
            stepFrame: 0,
            lift: 0,
            wave: null,
            seatedOn: null,
            holding: null,
          },
        },
      }) as const;
    const sentAvatar = (socket: FakeSocket) =>
      (socket.sent.at(-1) as unknown as { op: { avatar: unknown } }).op.avatar;
    const bare = (x: number) => ({ x, y: 2, facing: 'down', walking: true });
    const socket = FakeSocket.all[0]!;
    socket.fire('open');
    expect(socket.sent[0]).toMatchObject({ kind: 'hello', leanAvatars: true });
    // A room from before: full packets.
    room.send(walk(1));
    expect(sentAvatar(socket)).toEqual(walk(1).op.avatar);
    socket.receive(JSON.stringify({ kind: 'format', format: DOCUMENT_FORMAT, leanAvatars: true }));
    room.send(walk(2));
    expect(sentAvatar(socket)).toEqual({ ...bare(2), config: costume });
    room.send(walk(3));
    expect(sentAvatar(socket)).toEqual(bare(3));
    // Someone new joins: the next packet carries the costume.
    socket.receive(JSON.stringify({ kind: 'presence', participants: [{ id: 'a' }] }));
    room.send(walk(4));
    expect(sentAvatar(socket)).toEqual({ ...bare(4), config: costume });
    // Leaving the mode, then coming back: the costume again.
    room.send({ kind: 'op', op: { kind: 'avatar', tabId: 't1', avatar: null } });
    expect(sentAvatar(socket)).toBeNull();
    room.send(walk(5));
    expect(sentAvatar(socket)).toEqual({ ...bare(5), config: costume });
    // A new socket starts on full packets until its room says otherwise.
    socket.fire('close');
    vi.runOnlyPendingTimers();
    const next = FakeSocket.all[1]!;
    next.fire('open');
    room.send(walk(6));
    expect(sentAvatar(next)).toEqual(walk(6).op.avatar);
    next.receive(JSON.stringify({ kind: 'format', format: DOCUMENT_FORMAT }));
    room.send(walk(7));
    expect(sentAvatar(next)).toEqual(walk(7).op.avatar);
    room.close();
  });

  it('sends nothing for a grant-renew when no fresh grant can be had', async () => {
    const renewGrant = vi.fn(async () => null);
    connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
      { ticket: 'first', renewGrant },
    );
    const socket = FakeSocket.all[0]!;
    socket.fire('open');
    socket.receive(JSON.stringify({ kind: 'grant-renew', expiresAt: Date.now() + 60_000 }));
    await vi.waitFor(() => expect(renewGrant).toHaveBeenCalledOnce());
    await Promise.resolve();
    expect(socket.sent.some((f) => f.kind === 'grant')).toBe(false);
  });

  it('mints its first ticket itself when it starts without one', async () => {
    const mintTicket = vi.fn(async () => 'first');
    connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
      { mintTicket },
    );
    // No socket until the ticket is in hand: an upgrade without one is refused.
    expect(FakeSocket.all).toHaveLength(0);
    await vi.runOnlyPendingTimersAsync();
    expect(mintTicket).toHaveBeenCalledOnce();
    expect(FakeSocket.all[0]!.url).toContain('t=first');
  });

  // realtime-conflict-resolution.md "A ticket mint that gets no answer opens no socket": a laptop waking before its
  // wifi used to open a ticketless socket on every attempt, which the room refused and the editor then probed.
  it('opens no socket while the mint gets no answer, and parks once the attempts are used up', async () => {
    const mintTicket = vi.fn(async (): Promise<string | null> => {
      throw new Error('room ticket mint unreachable');
    });
    const onRefused = vi.fn();
    connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {}, onRefused },
      { mintTicket },
    );
    for (let i = 0; i < 10; i++) await vi.runOnlyPendingTimersAsync();
    expect(FakeSocket.all).toHaveLength(0);
    expect(onRefused).not.toHaveBeenCalled();
    // The first mint and the backoff's six attempts, then nothing until the network is back.
    expect(mintTicket).toHaveBeenCalledTimes(7);
    mintTicket.mockResolvedValue('first');
    window.dispatchEvent(new Event('online'));
    await vi.runOnlyPendingTimersAsync();
    expect(mintTicket).toHaveBeenCalledTimes(8);
    expect(FakeSocket.all[0]!.url).toContain('t=first');
  });

  it('mints again on reconnect after a mint that failed', async () => {
    // A failed mint leaves no ticket: that upgrade is refused, and the next attempt must not give up on tickets.
    const mintTicket = vi.fn(async () => 'second');
    connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
      { ticket: '', mintTicket },
    );
    expect(FakeSocket.all[0]!.url).not.toContain('?');
    FakeSocket.all[0]!.fire('close');
    await vi.runOnlyPendingTimersAsync();
    expect(mintTicket).toHaveBeenCalledOnce();
    expect(FakeSocket.all[1]!.url).toContain('t=second');
  });

  // docs/specs/024-agents/agent-changesets.md "Held elements": the room holds an element from an agent only
  // while it knows the selection, and a new socket is a session it knows nothing about.
  it('says the selection and tab made before the first socket opened, once it opens', async () => {
    let release: (t: string) => void = () => {};
    const mintTicket = vi.fn(() => new Promise<string>((r) => (release = r)));
    const room = connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
      { mintTicket },
    );
    room.send({ kind: 'op', op: { kind: 'tab-focus', tabId: 't1' } });
    room.send({ kind: 'op', op: { kind: 'select', elementId: 'old', tabId: 't1' } });
    room.send({ kind: 'op', op: { kind: 'select', elementId: 'api', tabId: 't1' } });
    release('first');
    await vi.runOnlyPendingTimersAsync();
    const socket = FakeSocket.all[0]!;
    socket.fire('open');
    const ops = socket.sent.filter((m) => (m as { kind: string }).kind === 'op');
    expect(ops).toEqual([
      { kind: 'op', op: { kind: 'tab-focus', tabId: 't1' } },
      { kind: 'op', op: { kind: 'select', elementId: 'api', tabId: 't1' } },
    ]);
    expect((socket.sent[0] as { kind: string }).kind).toBe('hello');
  });

  it('says the latest selection again on a reconnect', async () => {
    const room = connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
      { ticket: 'first', mintTicket: async () => 'second' },
    );
    const first = FakeSocket.all[0]!;
    first.fire('open');
    room.send({ kind: 'op', op: { kind: 'select', elementId: 'api', tabId: 't1' } });
    first.fire('close');
    await vi.runOnlyPendingTimersAsync();
    const second = FakeSocket.all[1]!;
    second.fire('open');
    expect(second.sent).toContainEqual({
      kind: 'op',
      op: { kind: 'select', elementId: 'api', tabId: 't1' },
    });
  });

  it('closes cleanly while its first ticket is still being minted', async () => {
    let release: (t: string) => void = () => {};
    const room = connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
      { mintTicket: () => new Promise<string>((r) => (release = r)) },
    );
    room.close();
    release('late');
    await vi.runOnlyPendingTimersAsync();
    expect(FakeSocket.all).toHaveLength(0);
  });

  it('never puts a credential other than the ticket on the upgrade URL', async () => {
    connectRoom(
      'd1',
      { id: 'owner-secret', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
      { ticket: 'first', mintTicket: async () => 'second' },
    );
    const url = new URL(FakeSocket.all[0]!.url);
    expect([...url.searchParams.keys()]).toEqual(['t']);
    expect(url.href).not.toContain('owner-secret');
  });

  it("never sends a comment's author id", () => {
    const room = connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
    );
    const socket = FakeSocket.all[0]!;
    socket.fire('open');
    room.send({
      kind: 'op',
      op: {
        kind: 'el-delta',
        tabId: 't',
        elementId: 'e',
        delta: {
          kind: 'comment-add',
          comment: {
            id: 'c',
            text: 'hi',
            createdAt: 1,
            authorName: 'A',
            authorColor: '#000',
            authorId: 'owner-secret',
          },
        },
      },
    });
    expect(JSON.stringify(socket.sent)).not.toContain('owner-secret');
  });

  // A save waits for the room to sequence its ledger deltas before it writes
  // (docs/specs/012-collaboration/collab-race-hardening.md phase 6).
  describe('sequence', () => {
    const board = {
      kind: 'el-delta',
      tabId: 't',
      elementId: 'e',
      delta: { kind: 'comment-resolve', resolved: true },
    } as const;
    const open = () => {
      const room = connectRoom(
        'd1',
        { id: 'me', name: 'Me', color: '#000' },
        { onPresence() {}, onOp() {} },
      );
      const socket = FakeSocket.all[0]!;
      socket.fire('open');
      return { room, socket };
    };
    const answer = (socket: FakeSocket, frame: unknown) => socket.receive(JSON.stringify(frame));

    it('sends the op with a ref and resolves once the room names that ref', async () => {
      const { room, socket } = open();
      const first = room.sequence(board);
      const second = room.sequence(board);
      const refs = socket.sent.slice(-2).map((m) => (m as { ref?: number }).ref);
      expect(refs).toEqual([1, 2]);
      expect(socket.sent.at(-1)).toMatchObject({ kind: 'op', op: { kind: 'el-delta' } });

      const settled: boolean[] = [];
      void first.then((ok) => settled.push(ok));
      answer(socket, { kind: 'cursor', epoch: 'e1', seq: 9 });
      await Promise.resolve();
      expect(settled).toEqual([]);

      answer(socket, { kind: 'cursor', epoch: 'e1', seq: 10, ref: 1 });
      await expect(first).resolves.toBe(true);
      answer(socket, { kind: 'cursor', epoch: 'e1', seq: 11, ref: 2 });
      await expect(second).resolves.toBe(true);
      expect(room.cursor()).toEqual({ epoch: 'e1', seq: 11 });
    });

    // docs/specs/012-collaboration/realtime-conflict-resolution.md "An invalid element".
    it('answers false at once when the room refuses the op, and logs it', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { room, socket } = open();
      const pending = room.sequence(board);
      answer(socket, { kind: 'op-refused', op: 'el', reason: 'invalid-element', field: 'from' });
      answer(socket, {
        kind: 'op-refused',
        op: 'el',
        reason: 'invalid-element',
        elementId: 'e',
        field: 'from',
        ref: 1,
      });
      await expect(pending).resolves.toBe(false);
      expect(warn).toHaveBeenCalledWith('[room] op refused', {
        op: 'el',
        reason: 'invalid-element',
        field: 'from',
      });
      warn.mockRestore();
    });

    it('gives up after ROOM_SEQUENCE_ACK_TIMEOUT_MS, and logs it', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { room } = open();
      const pending = room.sequence(board);
      vi.advanceTimersByTime(ROOM_SEQUENCE_ACK_TIMEOUT_MS);
      await expect(pending).resolves.toBe(false);
      expect(warn).toHaveBeenCalledWith('[room] op not confirmed in time', {
        kind: 'el-delta',
        timeoutMs: ROOM_SEQUENCE_ACK_TIMEOUT_MS,
      });
      warn.mockRestore();
    });

    it('answers false at once when the socket drops, and ignores a late ref', async () => {
      const { room, socket } = open();
      const pending = room.sequence(board);
      socket.fire('close');
      await expect(pending).resolves.toBe(false);
      expect(() => answer(socket, { kind: 'cursor', epoch: 'e1', seq: 3, ref: 1 })).not.toThrow();
      room.close();
    });

    it('holds the op in the outbox while the socket is down, and answers false', async () => {
      const { room, socket } = open();
      socket.fire('close');
      await expect(room.sequence(board)).resolves.toBe(false);
      vi.runOnlyPendingTimers();
      const second = FakeSocket.all[1]!;
      second.fire('open');
      expect(second.sent.map((m) => m.op?.kind ?? m.kind)).toEqual(['hello', 'sync', 'el-delta']);
      expect(second.sent[2]).not.toHaveProperty('ref');
    });

    it('answers false after close, sending nothing', async () => {
      const { room, socket } = open();
      room.close();
      const sent = socket.sent.length;
      await expect(room.sequence(board)).resolves.toBe(false);
      expect(socket.sent).toHaveLength(sent);
    });
  });

  it('reports no cursor while the socket is down', () => {
    const room = connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
    );
    expect(room.cursor()).toBeNull();
  });
});

// The room ends every session when the document goes to the Trash
// (docs/specs/013-workspace/trash.md): close code 4004. The client hears it
// and stops, rather than reconnecting into an upgrade that will be refused.
describe('connectRoom when the document is trashed', () => {
  class ClosingSocket {
    static all: ClosingSocket[] = [];
    readyState = 1;
    private listeners: Record<string, ((e: { code?: number }) => void)[]> = {};
    constructor() {
      ClosingSocket.all.push(this);
    }
    addEventListener(type: string, fn: (e: { code?: number }) => void) {
      (this.listeners[type] ??= []).push(fn);
    }
    send() {}
    close() {}
    fire(type: string, event: { code?: number } = {}) {
      for (const fn of this.listeners[type] ?? []) fn(event);
    }
  }

  beforeEach(() => {
    ClosingSocket.all = [];
    vi.stubGlobal('WebSocket', ClosingSocket);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reports it once and never reconnects', () => {
    const onDocumentTrashed = vi.fn();
    connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {}, onDocumentTrashed },
    );
    ClosingSocket.all[0]!.fire('open');
    ClosingSocket.all[0]!.fire('close', { code: 4004 });
    vi.runAllTimers();

    expect(onDocumentTrashed).toHaveBeenCalledTimes(1);
    expect(ClosingSocket.all).toHaveLength(1);
  });

  // A document trashed between the editor's load and its join: the upgrade is refused (the browser
  // reports only an abnormal close, never opened), so the room says so and the editor asks the api.
  it('reports a join refused before the socket opened, and still retries', () => {
    const onRefused = vi.fn();
    connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {}, onRefused },
    );
    ClosingSocket.all[0]!.fire('close', { code: 1006 });
    expect(onRefused).toHaveBeenCalledTimes(1);
    vi.runOnlyPendingTimers();
    expect(ClosingSocket.all).toHaveLength(2);
  });

  it('does not call a drop after the socket opened a refusal', () => {
    const onRefused = vi.fn();
    connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {}, onRefused },
    );
    ClosingSocket.all[0]!.fire('open');
    ClosingSocket.all[0]!.fire('close', { code: 1006 });
    expect(onRefused).not.toHaveBeenCalled();
  });

  // An access change (docs/specs/015-api/api.md "Access changes end the sessions they affect"):
  // close 4005. The connector stops and hands over, so the editor reloads into the access path
  // instead of reconnecting into a join the gates may refuse.
  it('reports an access change once and never reconnects', () => {
    const onAccessChanged = vi.fn();
    const onDocumentTrashed = vi.fn();
    connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {}, onAccessChanged, onDocumentTrashed },
    );
    ClosingSocket.all[0]!.fire('open');
    ClosingSocket.all[0]!.fire('close', { code: 4005 });
    vi.runAllTimers();

    expect(onAccessChanged).toHaveBeenCalledTimes(1);
    expect(onDocumentTrashed).not.toHaveBeenCalled();
    expect(ClosingSocket.all).toHaveLength(1);
  });

  // A grant that lapsed with no fresh one (close 4007): reconnect at once, minting a fresh ticket (which asks for a
  // fresh grant), with no backoff wait.
  it('reconnects at once with a fresh ticket when the grant lapsed', async () => {
    const mintTicket = vi.fn(async () => 'fresh');
    const onAccessChanged = vi.fn();
    connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {}, onAccessChanged },
      { ticket: 'first', mintTicket },
    );
    ClosingSocket.all[0]!.fire('open');
    ClosingSocket.all[0]!.fire('close', { code: 4007 });
    await vi.waitFor(() => expect(ClosingSocket.all).toHaveLength(2));
    expect(mintTicket).toHaveBeenCalledOnce();
    expect(onAccessChanged).not.toHaveBeenCalled();
  });

  // A full room (docs/specs/015-api/api.md "A room holds at most 100 connections"): close 4008. Said once, then
  // a quiet try every ROOM_FULL_RETRY_MS, and on the tab shown again, never a fast backoff.
  it('reports a full room once, then tries again each minute without saying it again', () => {
    const onRoomFull = vi.fn();
    const onRefused = vi.fn();
    connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {}, onRoomFull, onRefused },
    );
    ClosingSocket.all[0]!.fire('open');
    ClosingSocket.all[0]!.fire('close', { code: ROOM_FULL_CLOSE });
    expect(onRoomFull).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(ROOM_FULL_RETRY_MS - 1);
    expect(ClosingSocket.all).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(ClosingSocket.all).toHaveLength(2);
    ClosingSocket.all[1]!.fire('open');
    ClosingSocket.all[1]!.fire('close', { code: ROOM_FULL_CLOSE });
    expect(onRoomFull).toHaveBeenCalledTimes(1);
    expect(onRefused).not.toHaveBeenCalled();
    // The tab shown again tries at once, and the minute's timer does not open a second socket beside it.
    document.dispatchEvent(new Event('visibilitychange'));
    expect(ClosingSocket.all).toHaveLength(3);
    vi.advanceTimersByTime(ROOM_FULL_RETRY_MS);
    expect(ClosingSocket.all).toHaveLength(3);
  });

  it('says a full room again after it got in and was turned away later', () => {
    const onRoomFull = vi.fn();
    connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {}, onRoomFull },
    );
    ClosingSocket.all[0]!.fire('open');
    ClosingSocket.all[0]!.fire('close', { code: ROOM_FULL_CLOSE });
    vi.advanceTimersByTime(ROOM_FULL_RETRY_MS);
    ClosingSocket.all[1]!.fire('open');
    ClosingSocket.all[1]!.fire('message', {
      data: JSON.stringify({ kind: 'presence', participants: [] }),
    } as never);
    ClosingSocket.all[1]!.fire('close', { code: 1006 });
    vi.runOnlyPendingTimers();
    ClosingSocket.all[2]!.fire('open');
    ClosingSocket.all[2]!.fire('close', { code: ROOM_FULL_CLOSE });
    expect(onRoomFull).toHaveBeenCalledTimes(2);
  });

  it('still reconnects after an ordinary drop', () => {
    const onDocumentTrashed = vi.fn();
    connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {}, onDocumentTrashed },
    );
    ClosingSocket.all[0]!.fire('close', { code: 1006 });
    vi.runOnlyPendingTimers();

    expect(onDocumentTrashed).not.toHaveBeenCalled();
    expect(ClosingSocket.all).toHaveLength(2);
  });
});

// docs/specs/012-collaboration/realtime-conflict-resolution.md "Keepalive": a socket that dies without a close event
// is found by an unanswered ping and reconnected; quiet alone never drops one.
describe('connectRoom keepalive', () => {
  class Socket {
    static OPEN = 1;
    static all: Socket[] = [];
    readyState = 0;
    sent: string[] = [];
    closed = false;
    private listeners: Record<string, ((e: { data?: string; code?: number }) => void)[]> = {};
    url: string;
    constructor(url = '') {
      this.url = url;
      Socket.all.push(this);
    }
    addEventListener(type: string, fn: (e: { data?: string }) => void) {
      (this.listeners[type] ??= []).push(fn);
    }
    send(data: string) {
      this.sent.push(data);
    }
    close() {
      this.closed = true;
      this.readyState = 2;
    }
    fire(type: string, e: { data?: string; code?: number } = {}) {
      if (type === 'open') this.readyState = 1;
      for (const fn of this.listeners[type] ?? []) fn(e);
    }
    pings() {
      return this.sent.filter((d) => d === 'ping').length;
    }
  }
  beforeEach(() => {
    Socket.all = [];
    vi.stubGlobal('WebSocket', Socket);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const connect = () =>
    connectRoom('d1', { id: 'me', name: 'Me', color: '#000' }, { onPresence() {}, onOp() {} });

  it('pings an idle socket, and an answer keeps it', () => {
    const room = connect();
    const s = Socket.all[0]!;
    s.fire('open');
    vi.advanceTimersByTime(ROOM_KEEPALIVE_IDLE_MS);
    expect(s.pings()).toBe(1);
    s.fire('message', { data: 'pong' });
    vi.advanceTimersByTime(ROOM_KEEPALIVE_TIMEOUT_MS * 2);
    expect(s.closed).toBe(false);
    expect(Socket.all).toHaveLength(1);
    room.close();
  });

  it('sends no ping while traffic arrives', () => {
    const room = connect();
    const s = Socket.all[0]!;
    s.fire('open');
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(ROOM_KEEPALIVE_IDLE_MS / 2);
      s.fire('message', { data: JSON.stringify({ kind: 'presence', participants: [] }) });
    }
    expect(s.pings()).toBe(0);
    room.close();
  });

  it('drops a socket whose ping goes unanswered, and reconnects', () => {
    const room = connect();
    const s = Socket.all[0]!;
    s.fire('open');
    vi.advanceTimersByTime(ROOM_KEEPALIVE_IDLE_MS + ROOM_KEEPALIVE_TIMEOUT_MS + 5_000);
    expect(s.closed).toBe(true);
    vi.advanceTimersByTime(1_000);
    expect(Socket.all).toHaveLength(2);
    // The dead socket's own close event, when it finally comes, starts nothing more.
    s.fire('close', { code: 1006 });
    vi.advanceTimersByTime(1_000);
    expect(Socket.all).toHaveLength(2);
    room.close();
  });

  it('never drops a quiet socket whose pings are answered, however slow its timers run', () => {
    const room = connect();
    const s = Socket.all[0]!;
    s.fire('open');
    // A background tab: the browser runs the tick once a minute. The clock jumps between ticks with no tick in
    // between, and each ping's pong arrives at once, long before the next (late) tick looks.
    for (let i = 0; i < 5; i++) {
      vi.setSystemTime(Date.now() + 55_000);
      vi.advanceTimersByTime(5_000);
      if (s.sent.at(-1) === 'ping') s.fire('message', { data: 'pong' });
    }
    expect(s.pings()).toBeGreaterThan(1);
    expect(s.closed).toBe(false);
    expect(Socket.all).toHaveLength(1);
    room.close();
  });
});

// docs/specs/012-collaboration/proximity-audio.md "The wire": a presence id is per socket, so after our own reconnect
// peers know us by a new id with no microphone on it. Two clients through one relaying room.
describe('connectRoom: a reconnect says the call again', () => {
  type Frame = { kind: string; op?: { kind: string } };
  class RelaySocket {
    static OPEN = 1;
    static all: RelaySocket[] = [];
    static nextId = 0;
    readyState = 0;
    id = '';
    private listeners: Record<string, ((e: { data?: string }) => void)[]> = {};
    constructor() {
      RelaySocket.all.push(this);
    }
    addEventListener(type: string, fn: (e: { data?: string }) => void) {
      (this.listeners[type] ??= []).push(fn);
    }
    // The room: a fresh presence id per socket, every op relayed to every other open socket from that id.
    send(data: string) {
      const msg = JSON.parse(data) as Frame;
      if (msg.kind !== 'op') return;
      for (const peer of RelaySocket.all)
        if (peer !== this && peer.readyState === 1)
          peer.fire('message', { kind: 'op', from: this.id, op: msg.op });
    }
    close() {
      this.readyState = 3;
    }
    open() {
      this.readyState = 1;
      this.id = `p${++RelaySocket.nextId}`;
      this.fire('open');
    }
    drop() {
      this.readyState = 3;
      this.fire('close', undefined, { code: 1006 });
    }
    fire(type: string, data?: unknown, event: object = {}) {
      for (const fn of this.listeners[type] ?? [])
        fn(data === undefined ? event : { data: JSON.stringify(data) });
    }
  }

  beforeEach(() => {
    RelaySocket.all = [];
    RelaySocket.nextId = 0;
    vi.stubGlobal('WebSocket', RelaySocket);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const pair = (heardByB: (from: string, op: { kind: string }) => void) => {
    const a = connectRoom(
      'd1',
      { id: 'a', name: 'A', color: '#000' },
      { onPresence() {}, onOp() {} },
      { ticket: 'a1', mintTicket: async () => 'a2' },
    );
    const b = connectRoom(
      'd1',
      { id: 'b', name: 'B', color: '#000' },
      { onPresence() {}, onOp: heardByB },
      { ticket: 'b1' },
    );
    RelaySocket.all[0]!.open();
    RelaySocket.all[1]!.open();
    // A drops and comes back on a new socket, so a new presence id.
    const reconnectA = async () => {
      RelaySocket.all[0]!.drop();
      await vi.runOnlyPendingTimersAsync();
      RelaySocket.all[2]!.open();
    };
    return { a, b, reconnectA };
  };
  const track = { sessionId: 's', trackName: 'mic', token: 'k' };

  it('tells the room where our microphone is again, so a peer has it on our new id', async () => {
    const heard: { from: string; kind: string }[] = [];
    const { a, b, reconnectA } = pair((from, op) => heard.push({ from, kind: op.kind }));
    a.send({ kind: 'op', op: { kind: 'call-track', tabId: 't', track } });
    expect(heard).toEqual([{ from: 'p1', kind: 'call-track' }]);
    heard.length = 0;
    await reconnectA();
    expect(heard).toEqual([{ from: 'p3', kind: 'call-track' }]);
    a.close();
    b.close();
  });

  it('proves our call session again on the new socket, so peers can still hear us', async () => {
    const heard: { from: string; kind: string }[] = [];
    const { a, b, reconnectA } = pair((from, op) => heard.push({ from, kind: op.kind }));
    const session = { kind: 'call-session', tabId: 't', sessionId: 's', sessionToken: 'k' };
    a.send({ kind: 'op', op: session as never });
    heard.length = 0;
    await reconnectA();
    expect(heard).toEqual([{ from: 'p3', kind: 'call-session' }]);
    a.close();
    b.close();
  });

  it('places our character again on the new socket, at rest, and not once we left the mode', async () => {
    const heard: unknown[] = [];
    const { a, b, reconnectA } = pair((_from, op) => heard.push(op));
    const walking = {
      x: 10,
      y: 20,
      facing: 'left',
      walking: true,
      stepFrame: 1,
      lift: 3,
      wave: 2,
      reaction: { kind: 'jump', at: 0 },
    };
    a.send({ kind: 'op', op: { kind: 'avatar', tabId: 't', avatar: walking } as never });
    heard.length = 0;
    await reconnectA();
    expect(heard).toEqual([
      {
        kind: 'avatar',
        tabId: 't',
        avatar: { x: 10, y: 20, facing: 'left', walking: false, stepFrame: 0, lift: 0, wave: null },
      },
    ]);
    a.send({ kind: 'op', op: { kind: 'avatar', tabId: 't', avatar: null } });
    heard.length = 0;
    RelaySocket.all[2]!.drop();
    await vi.runOnlyPendingTimersAsync();
    RelaySocket.all[3]!.open();
    expect(heard).toEqual([]);
    a.close();
    b.close();
  });

  it('says only the latest: a call that ended says it has nothing', async () => {
    const heard: unknown[] = [];
    const { a, b, reconnectA } = pair((_from, op) => heard.push(op));
    a.send({ kind: 'op', op: { kind: 'call-track', tabId: 't', track } });
    a.send({ kind: 'op', op: { kind: 'call-track', tabId: 't', track: null } });
    heard.length = 0;
    await reconnectA();
    expect(heard).toEqual([{ kind: 'call-track', tabId: 't', track: null }]);
    a.close();
    b.close();
  });
});

// docs/specs/013-workspace/share-roles.md "The collab key": the room tells this session the key it pinned on it.
describe('connectRoom collab key', () => {
  const KEY = '0123456789abcdef0123456789abcdef';
  class KeySocket {
    static OPEN = 1;
    static last: KeySocket | null = null;
    readyState = 1;
    private listeners: Record<string, ((e: { data?: unknown }) => void)[]> = {};
    constructor() {
      KeySocket.last = this;
    }
    addEventListener(type: string, fn: (e: { data?: unknown }) => void) {
      (this.listeners[type] ??= []).push(fn);
    }
    send() {}
    close() {}
    fire(type: string, data?: unknown) {
      for (const fn of this.listeners[type] ?? []) fn({ data });
    }
  }
  afterEach(() => vi.unstubAllGlobals());

  it('hands on the key the room pinned, and ignores one of the wrong shape', () => {
    vi.stubGlobal('WebSocket', KeySocket);
    const keys: string[] = [];
    const room = connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {}, onCollabKey: (key) => keys.push(key) },
    );
    const socket = KeySocket.last!;
    socket.fire('open');
    socket.fire('message', JSON.stringify({ kind: 'collab-key', key: 'not-a-key' }));
    socket.fire('message', JSON.stringify({ kind: 'collab-key', key: KEY }));
    expect(keys).toEqual([KEY]);
    room.close();
  });
});
