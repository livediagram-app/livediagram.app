// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectRoom, roomQueryString } from './room';

describe('roomQueryString (realtime auth params, spec/04 + spec/24)', () => {
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

  it('url-encodes values', () => {
    expect(roomQueryString({ ownerId: 'a b&c' }, null)).toBe('o=a+b%26c');
  });
});

// The reconnect cursor (spec/75, Level 1). The room skips the sender when it
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

  it("ignores another epoch's cursor, leaving the catch-up to reconcile", () => {
    expect(
      reconnectSync([
        { kind: 'cursor', epoch: 'E', seq: 3 },
        { kind: 'cursor', epoch: 'OTHER', seq: 9 },
      ]),
    ).toEqual({ kind: 'sync', epoch: 'E', lastSeq: 3 });
  });
});

describe('connectRoom outbox (spec/152)', () => {
  class FakeSocket {
    static OPEN = 1;
    static all: FakeSocket[] = [];
    readyState = 0;
    sent: { kind: string; op?: { kind: string } }[] = [];
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
    fire(type: string) {
      if (type === 'open') this.readyState = 1;
      if (type === 'close') this.readyState = 3;
      for (const fn of this.listeners[type] ?? []) fn({});
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

  it('reports no cursor while the socket is down', () => {
    const room = connectRoom(
      'd1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
    );
    expect(room.cursor()).toBeNull();
  });
});
