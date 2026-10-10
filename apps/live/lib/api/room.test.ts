// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_FORMAT } from '@livediagram/api-schema';
import { resetServerReleaseForTests, serverBuild, serverDocumentFormat } from '../server-release';
import { connectRoom, ROOM_SEQUENCE_ACK_TIMEOUT_MS, roomQueryString } from './room';

describe('roomQueryString (realtime auth params, docs/specs/014-identity/auth-and-guest-access.md + docs/specs/013-workspace/share-password.md)', () => {
  it('maps each identifier to its short key', () => {
    expect(roomQueryString({ shareCode: 'C', ownerId: 'O', ticket: 'T' }, 'P')).toBe(
      't=T&s=C&o=O&p=P',
    );
  });

  it('returns an empty string when nothing is set', () => {
    expect(roomQueryString({}, null)).toBe('');
  });

  it('strips null / undefined / empty values so the URL stays clean', () => {
    expect(roomQueryString({ shareCode: null, ownerId: 'O', ticket: undefined }, null)).toBe('o=O');
    expect(roomQueryString({ shareCode: '' }, '')).toBe('');
  });

  it('carries the session share password independently of the options', () => {
    expect(roomQueryString({}, 'secret')).toBe('p=secret');
  });

  it('carries the owner signature beside the owner id, and never on its own', () => {
    expect(roomQueryString({ ownerId: 'O', ownerSig: 'G' }, null)).toBe('o=O&os=G');
    expect(roomQueryString({ ownerSig: 'G' }, null)).toBe('');
  });

  it('url-encodes values', () => {
    expect(roomQueryString({ ownerId: 'a b&c' }, null)).toBe('o=a+b%26c');
  });
});

// The reconnect cursor (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1). The room skips the sender when it
// relays an op, so the client's own ops only ever reach its cursor through a
// `cursor` frame; without one a reconnect asked for them back and re-applied
// its own `vote` deltas, counting each dot twice.
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

  // An identity update (docs/specs/014-identity/profile-picture.md §4): sent over the open socket,
  // and what the next hello says after a reconnect.
  it('sends a picture change as an identity frame and says hello with it after a reconnect', () => {
    const room = connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
    );
    const first = FakeSocket.all[0]!;
    first.fire('open');
    const picture = 'https://img.clerk.com/me';
    room.updateSelf({ id: 'me', name: 'Me', color: '#000', picture });
    expect(first.sent.at(-1)).toEqual({
      kind: 'identity',
      participant: { id: 'me', name: 'Me', color: '#000', picture },
    });
    first.fire('close');
    vi.runOnlyPendingTimers();
    const second = FakeSocket.all[1]!;
    second.fire('open');
    expect(second.sent[0]).toMatchObject({ kind: 'hello', participant: { picture } });
    room.close();
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
  class FakeSocket {
    static OPEN = 1;
    static all: FakeSocket[] = [];
    readyState = 0;
    sent: { kind: string; op?: { kind: string } }[] = [];
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
      this.sent.push(JSON.parse(data));
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
    const dot = (delta: 1 | -1) =>
      ({
        kind: 'op',
        op: { kind: 'vote', tabId: 't', elementId: 'e', voter: 'k', delta },
      }) as const;
    room.send(dot(1));
    room.send({ kind: 'op', op: { kind: 'cursor', x: 1, y: 2 } } as never);
    room.send(dot(-1));
    vi.runOnlyPendingTimers();
    const second = FakeSocket.all[1]!;
    second.fire('open');
    expect(second.sent.map((m) => m.op?.kind ?? m.kind)).toEqual(['hello', 'sync', 'vote', 'vote']);
    expect(second.sent.slice(2).map((m) => (m.op as unknown as { delta: number }).delta)).toEqual([
      1, -1,
    ]);
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

  it('mints nothing for a session that came in without a ticket', async () => {
    const mintTicket = vi.fn(async () => 'x');
    connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
      { ownerId: 'me', mintTicket },
    );
    FakeSocket.all[0]!.fire('open');
    FakeSocket.all[0]!.fire('close');
    await vi.runOnlyPendingTimersAsync();
    expect(mintTicket).not.toHaveBeenCalled();
    expect(FakeSocket.all).toHaveLength(2);
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
      delta: { kind: 'board', patch: { set: { title: 'T' } } },
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
