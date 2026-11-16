// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  connectRoomClient,
  roomQueryString,
  type RoomClientHandlers,
  type RoomClientWire,
} from './room-client';

// The shared room client's binding: each editor's door (lib/api/room.ts) hands in its wire, and its own
// room tests drive the full lifecycle through that door. These check the wire is what the client reads.
type Op = { kind: string };
type Handlers = RoomClientHandlers<Op, { id: string }> & { onGone?: () => void };

class FakeSocket {
  static OPEN = 1;
  static all: FakeSocket[] = [];
  readyState = 1;
  sent: string[] = [];
  private listeners: Record<string, ((e: { data?: unknown; code?: number }) => void)[]> = {};
  readonly url: string;
  constructor(url: string) {
    this.url = url;
    FakeSocket.all.push(this);
  }
  addEventListener(type: string, fn: (e: { data?: unknown; code?: number }) => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {}
  fire(type: string, event: { data?: unknown; code?: number } = {}) {
    for (const fn of this.listeners[type] ?? []) fn(event);
  }
}

function wireFor(): RoomClientWire<Op, { id: string }, Handlers> {
  return {
    trashedClose: 4904,
    accessChangedClose: 4905,
    workbenchEndedClose: 4906,
    ping: 'are-you-there',
    pong: 'here',
    isMutationOpKind: (kind) => kind === 'change',
    opForTheWire: (op) => ({ ...op, wired: true }),
    splitPresenceFrame: vi.fn((frame: { participants: { id: string }[] }) => ({
      participants: frame.participants,
      agents: [],
    })),
    noteServerFormat: vi.fn(),
    noteServerBuild: vi.fn(),
    startTiming: () => ({ end() {}, endAfterPaint() {}, cancel() {} }),
    socketUrl: (roomId, query) => `wss://room/${roomId}?${query}`,
    onTrashed: (handlers) => handlers.onGone?.(),
  };
}

describe('connectRoomClient', () => {
  beforeEach(() => {
    FakeSocket.all = [];
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('opens on the wire URL and reads frames through the wire', () => {
    const wire = wireFor();
    const onPresence = vi.fn();
    const room = connectRoomClient<
      Op,
      Op,
      { id: string },
      { id: string; name: string; color: string },
      Handlers
    >(
      wire,
      'r1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence, onOp() {} },
      { ticket: 'T' },
    );
    const socket = FakeSocket.all[0]!;
    expect(socket.url).toBe(`wss://room/r1?${roomQueryString('T')}`);
    socket.fire('open');
    socket.fire('message', { data: 'here' });
    socket.fire('message', {
      data: JSON.stringify({ kind: 'presence', participants: [{ id: 'p' }] }),
    });
    socket.fire('message', { data: JSON.stringify({ kind: 'format', format: 7, build: 'b' }) });
    expect(wire.splitPresenceFrame).toHaveBeenCalledOnce();
    expect(onPresence).toHaveBeenCalledWith([{ id: 'p' }], []);
    expect(wire.noteServerFormat).toHaveBeenCalledWith(7);
    expect(wire.noteServerBuild).toHaveBeenCalledWith('b');
    room.send({ kind: 'op', op: { kind: 'change' } } as Op);
    expect(JSON.parse(socket.sent.at(-1)!)).toEqual({
      kind: 'op',
      op: { kind: 'change', wired: true },
    });
    room.close();
  });

  it('hands a source-changed frame to its handler, ids only (sheet-sources.md)', () => {
    const onSourceChanged = vi.fn();
    const room = connectRoomClient<
      Op,
      Op,
      { id: string },
      { id: string; name: string; color: string },
      Handlers
    >(
      wireFor(),
      'r1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {}, onSourceChanged },
      { ticket: 'T' },
    );
    const socket = FakeSocket.all[0]!;
    socket.fire('open');
    socket.fire('message', {
      data: JSON.stringify({
        kind: 'source-changed',
        app: 'liveplanner',
        itemId: 'plan_1',
        sheetIds: ['s1'],
      }),
    });
    expect(onSourceChanged).toHaveBeenCalledWith({
      app: 'liveplanner',
      itemId: 'plan_1',
      sheetIds: ['s1'],
    });
    room.close();
  });

  it('pings with the wire frame after a quiet spell', () => {
    connectRoomClient(
      wireFor(),
      'r1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
    );
    const socket = FakeSocket.all[0]!;
    socket.fire('open');
    vi.advanceTimersByTime(25_000);
    expect(socket.sent).toContain('are-you-there');
  });

  it("calls the product's trashed handler on the wire's trashed close, and stops", () => {
    const onGone = vi.fn();
    connectRoomClient(
      wireFor(),
      'r1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {}, onGone },
    );
    FakeSocket.all[0]!.fire('open');
    FakeSocket.all[0]!.fire('close', { code: 4904 });
    vi.runOnlyPendingTimers();
    expect(onGone).toHaveBeenCalledOnce();
    expect(FakeSocket.all).toHaveLength(1);
  });

  it('stops on a snapshot revert and reloads, or calls the caller instead', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    connectRoomClient(
      wireFor(),
      'r1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
    );
    FakeSocket.all[0]!.fire('open');
    FakeSocket.all[0]!.fire('close', { code: 4009 });
    vi.runOnlyPendingTimers();
    expect(reload).toHaveBeenCalledOnce();
    expect(FakeSocket.all).toHaveLength(1);
    const onSnapshotReverted = vi.fn();
    connectRoomClient(
      wireFor(),
      'r2',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {}, onSnapshotReverted },
    );
    FakeSocket.all[1]!.fire('open');
    FakeSocket.all[1]!.fire('close', { code: 4009 });
    expect(onSnapshotReverted).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it('holds only mutation ops while the socket is down', () => {
    const room = connectRoomClient(
      wireFor(),
      'r1',
      { id: 'me', name: 'Me', color: '#000' },
      { onPresence() {}, onOp() {} },
    );
    const socket = FakeSocket.all[0]!;
    socket.readyState = 0;
    room.send({ kind: 'op', op: { kind: 'cursor' } } as Op);
    room.send({ kind: 'op', op: { kind: 'change' } } as Op);
    socket.readyState = 1;
    socket.fire('open');
    const kinds = socket.sent.map((s) => JSON.parse(s) as { kind: string; op?: Op });
    expect(kinds.filter((m) => m.kind === 'op').map((m) => m.op?.kind)).toEqual(['change']);
  });
});
