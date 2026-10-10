// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_TRASHED_CLOSE } from '@livediagram/api-schema';
import type { TimingTrack } from '@livediagram/telemetry-client';
import { resetTimingForTests, setTimingTrack } from '../timing';
import { connectRoom } from './room';

// The room's timings (docs/specs/017-telemetry/timing-telemetry.md): RoomConnect to the first roster
// frame, RoomReconnect from a drop to the roster on the new socket.

class FakeSocket {
  static OPEN = 1;
  static all: FakeSocket[] = [];
  readyState = 1;
  private listeners: Record<string, ((e: { data?: string; code?: number }) => void)[]> = {};
  constructor() {
    FakeSocket.all.push(this);
  }
  addEventListener(type: string, fn: (e: { data?: string; code?: number }) => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  send() {}
  close() {}
  fire(type: string, data?: unknown, code?: number) {
    for (const fn of this.listeners[type] ?? [])
      fn(data === undefined ? { code } : { data: JSON.stringify(data) });
  }
}

const PRESENCE = { kind: 'presence', participants: [] };
let clock = 0;
let track: ReturnType<typeof vi.fn<TimingTrack>>;

const connect = () =>
  connectRoom('d1', { id: 'me', name: 'Me', color: '#000' }, { onPresence() {}, onOp() {} });
const timings = () => track.mock.calls.map((c) => c[2]);

beforeEach(() => {
  FakeSocket.all = [];
  clock = 0;
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  resetTimingForTests();
  track = vi.fn<TimingTrack>();
  setTimingTrack(track);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('connectRoom timings', () => {
  it('times the connection to the first roster frame, once', () => {
    const room = connect();
    clock = 300;
    FakeSocket.all[0]!.fire('open');
    clock = 420;
    FakeSocket.all[0]!.fire('message', PRESENCE);
    FakeSocket.all[0]!.fire('message', PRESENCE);
    expect(timings()).toEqual(['RoomConnect.Under500ms']);
    room.close();
  });

  it('times a drop to the roster on the new socket, back-off included', () => {
    const room = connect();
    FakeSocket.all[0]!.fire('open');
    FakeSocket.all[0]!.fire('message', PRESENCE);
    clock = 10_000;
    FakeSocket.all[0]!.fire('close');
    vi.runOnlyPendingTimers();
    clock = 12_500;
    FakeSocket.all[1]!.fire('open');
    FakeSocket.all[1]!.fire('message', PRESENCE);
    expect(timings()).toEqual(['RoomConnect.Under100ms', 'RoomReconnect.Under4000ms']);
    room.close();
  });

  it('keeps timing the first connection across a drop before the roster arrived', () => {
    const room = connect();
    FakeSocket.all[0]!.fire('open');
    FakeSocket.all[0]!.fire('close');
    vi.runOnlyPendingTimers();
    clock = 1_500;
    FakeSocket.all[1]!.fire('open');
    FakeSocket.all[1]!.fire('message', PRESENCE);
    expect(timings()).toEqual(['RoomConnect.Under2000ms']);
    room.close();
  });

  it('records nothing for a connection the editor closed first', () => {
    const room = connect();
    room.close();
    FakeSocket.all[0]!.fire('close');
    FakeSocket.all[0]!.fire('message', PRESENCE);
    expect(timings()).toEqual([]);
  });

  it('records nothing for a room that ends the session', () => {
    connect();
    FakeSocket.all[0]!.fire('open');
    FakeSocket.all[0]!.fire('message', PRESENCE);
    FakeSocket.all[0]!.fire('close', undefined, DOCUMENT_TRASHED_CLOSE);
    expect(timings()).toEqual(['RoomConnect.Under100ms']);
  });

  it('records nothing for a reconnect that never lands', () => {
    connect();
    FakeSocket.all[0]!.fire('open');
    FakeSocket.all[0]!.fire('message', PRESENCE);
    FakeSocket.all[0]!.fire('close');
    for (let i = 1; i < 10 && FakeSocket.all[i - 1]; i++) {
      vi.runOnlyPendingTimers();
      FakeSocket.all[i]?.fire('close');
    }
    FakeSocket.all.at(-1)!.fire('message', PRESENCE);
    expect(timings()).toEqual(['RoomConnect.Under100ms']);
  });
});
