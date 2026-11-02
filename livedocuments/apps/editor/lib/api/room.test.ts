// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_FORMAT } from '@livedocuments/api-schema';
import { resetServerReleaseForTests, serverBuild, serverDocumentFormat } from '../server-release';
import { ROOM_FULL_CLOSE, ROOM_FULL_RETRY_MS } from '@livedocuments/api-schema';
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
// its own deltas, applying each twice.
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
    const tick = (done: boolean) =>
      ({
        kind: 'op',
        op: {
          kind: 'el-delta',
          tabId: 't',
          elementId: 'e',
          delta: { kind: 'check', index: 0, text: 'a', done },
        },
      }) as const;
    room.send(tick(true));
    room.send({ kind: 'op', op: { kind: 'cursor', x: 1, y: 2 } } as never);
    room.send(tick(false));
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
      second.sent.slice(2).map((m) => (m.op as unknown as { delta: { done: boolean } }).delta.done),
    ).toEqual([true, false]);
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
    const tick = {
      kind: 'el-delta',
      tabId: 't',
      elementId: 'e',
      delta: { kind: 'check', index: 0, text: 'a', done: true },
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
      const first = room.sequence(tick);
      const second = room.sequence(tick);
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
      const pending = room.sequence(tick);
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
      const pending = room.sequence(tick);
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
      const pending = room.sequence(tick);
      socket.fire('close');
      await expect(pending).resolves.toBe(false);
      expect(() => answer(socket, { kind: 'cursor', epoch: 'e1', seq: 3, ref: 1 })).not.toThrow();
      room.close();
    });

    it('holds the op in the outbox while the socket is down, and answers false', async () => {
      const { room, socket } = open();
      socket.fire('close');
      await expect(room.sequence(tick)).resolves.toBe(false);
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
      await expect(room.sequence(tick)).resolves.toBe(false);
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

  // A workbench session whose pairing or token ended (docs/specs/013-workspace/workbench-embeds.md):
  // close 4006. The page turns read-only; the connector never reconnects.
  it('reports a workbench end once and never reconnects', () => {
    const onWorkbenchEnded = vi.fn();
    const onAccessChanged = vi.fn();
    connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {}, onWorkbenchEnded, onAccessChanged },
    );
    ClosingSocket.all[0]!.fire('open');
    ClosingSocket.all[0]!.fire('close', { code: 4006 });
    vi.runAllTimers();

    expect(onWorkbenchEnded).toHaveBeenCalledTimes(1);
    expect(onAccessChanged).not.toHaveBeenCalled();
    expect(ClosingSocket.all).toHaveLength(1);
  });

  // docs/specs/015-api/api.md "Room size": a full room closes with ROOM_FULL_CLOSE. The editor is told once
  // per spell of being turned away, and the connector tries again every ROOM_FULL_RETRY_MS, never giving up.
  it('reports a full room once and keeps trying, slowly', () => {
    const onRoomFull = vi.fn();
    const onRefused = vi.fn();
    connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {}, onRoomFull, onRefused },
    );
    for (let i = 0; i < 10; i++) {
      const socket = ClosingSocket.all[i]!;
      socket.fire('open');
      socket.fire('close', { code: ROOM_FULL_CLOSE });
      vi.advanceTimersByTime(ROOM_FULL_RETRY_MS - 1);
      expect(ClosingSocket.all).toHaveLength(i + 1);
      vi.advanceTimersByTime(1);
    }
    expect(ClosingSocket.all).toHaveLength(11);
    expect(onRoomFull).toHaveBeenCalledTimes(1);
    expect(onRefused).not.toHaveBeenCalled();
  });

  it('tries a full room again as soon as the tab is shown, not only on the minute', () => {
    const onRoomFull = vi.fn();
    connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {}, onRoomFull },
    );
    ClosingSocket.all[0]!.fire('open');
    ClosingSocket.all[0]!.fire('close', { code: ROOM_FULL_CLOSE });
    expect(ClosingSocket.all).toHaveLength(1);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(ClosingSocket.all).toHaveLength(2);
    // The minute's retry it replaced never fires a second socket on top.
    vi.advanceTimersByTime(ROOM_FULL_RETRY_MS);
    expect(ClosingSocket.all).toHaveLength(2);
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
