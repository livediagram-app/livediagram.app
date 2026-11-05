import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROOM_ALARM_FLOOR_MS } from '@liveworkspace/api-kit/room-alarm';
import { GRANT_LAPSED_CLOSE, ROOM_GRANT_ASK_BEFORE_MS } from '@livehuddle/api-schema';
import { DocumentRoom } from './document-room';

// A session holds the index's grant, which lapses after ten minutes (liveworkspace/docs/specs/004-index/one-explorer-contracts.md
// "Grants"): the room asks for a fresh one ROOM_GRANT_ASK_BEFORE_MS before and drops the socket once it has lapsed.
// Only open sockets count: one the room closed stays listed until its peer answers, and must not keep the alarm ringing.

const T0 = 1_800_000_000_000;

type FakeSocket = {
  sent: string[];
  attachment: unknown;
  closed: { code: number; reason: string } | null;
  // 1 open, 2 closing, 3 closed: as the runtime's, a socket the room closed stays listed until its peer answers.
  readyState: number;
  send: (data: string) => void;
  serializeAttachment: (value: unknown) => void;
  deserializeAttachment: () => unknown;
  close: (code: number, reason: string) => void;
};

function room() {
  const sockets: FakeSocket[] = [];
  const alarms: number[] = [];
  const store = new Map<string, unknown>();
  const state = {
    id: { name: 'D', toString: () => 'D' },
    acceptWebSocket: (ws: FakeSocket) => void sockets.push(ws),
    getWebSockets: () => sockets.filter((s) => s.readyState !== 3),
    storage: {
      get: async (key: string) => store.get(key),
      put: async (key: string, value: unknown) => void store.set(key, value),
      delete: async (key: string) => store.delete(key),
      list: async ({ prefix }: { prefix: string }) =>
        new Map([...store].filter(([key]) => key.startsWith(prefix))),
      setAlarm: async (at: number) => void alarms.push(at),
      deleteAlarm: async () => {},
      deleteAll: async () => store.clear(),
    },
    blockConcurrencyWhile: async (fn: () => Promise<void>) => fn(),
    waitUntil: () => {},
  };
  const document = new DocumentRoom(state as unknown as DurableObjectState, {} as never);
  const join = (expMs: number) => {
    const ws: FakeSocket = {
      sent: [],
      attachment: null,
      closed: null,
      readyState: 1,
      send: (data) => void ws.sent.push(data),
      serializeAttachment: (value) => void (ws.attachment = value),
      deserializeAttachment: () => ws.attachment,
      close: (code, reason) => {
        ws.closed = { code, reason };
        ws.readyState = 2;
      },
    };
    state.acceptWebSocket(ws);
    document.acceptSession(
      ws as unknown as WebSocket,
      'edit',
      false,
      null,
      null,
      null,
      null,
      null,
      'D',
      expMs,
    );
    return ws;
  };
  return { document, join, alarms };
}

const kinds = (ws: FakeSocket) => ws.sent.map((raw) => (JSON.parse(raw) as { kind: string }).kind);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('a session grant', () => {
  it('is asked to renew once, inside the window, and dropped once it lapses', async () => {
    const { document, join } = room();
    const ws = join(T0 + 600_000);

    vi.setSystemTime(T0 + 600_000 - ROOM_GRANT_ASK_BEFORE_MS);
    await document.alarm();
    await document.alarm();
    expect(kinds(ws).filter((k) => k === 'grant-renew')).toHaveLength(1);

    vi.setSystemTime(T0 + 600_000);
    await document.alarm();
    expect(ws.closed).toEqual({ code: GRANT_LAPSED_CLOSE, reason: 'grant-lapsed' });
  });

  // A lapsed session whose peer never answers the close (a laptop asleep) stays in getWebSockets(), still holding
  // the lapsed grant. Counting it re-armed the alarm in the past, and the alarm fired back to back for hours.
  it('lets a lapsed session go: a closed socket still listed never re-arms the alarm in the past', async () => {
    const { document, join, alarms } = room();
    const ws = join(T0 + 600_000);
    vi.setSystemTime(T0 + 600_000);
    await document.alarm();
    expect(ws.closed?.code).toBe(GRANT_LAPSED_CLOSE);
    expect(ws.readyState).toBe(2);

    alarms.length = 0;
    ws.closed = null;
    await document.alarm();
    expect(ws.closed).toBeNull();
    expect(alarms.filter((at) => at <= Date.now())).toEqual([]);
  });
});

// A time already due must never fire the alarm back to back (liveworkspace/docs/specs/002-architecture/architecture.md
// "A Durable Object's alarm"): the room arms it a second from now instead.
describe('the room alarm', () => {
  it('arms a time stuck in the past a second from now, never at once', async () => {
    const { document, join, alarms } = room();
    const ws = join(T0 + 600_000);
    // A socket that stays open after the room closes it (a bug of the kind that once looped the alarm): its lapsed
    // grant stays due, in the past, on every arm.
    ws.close = (code, reason) => void (ws.closed = { code, reason });
    vi.setSystemTime(T0 + 600_000);
    await document.alarm();
    expect(ws.closed?.code).toBe(GRANT_LAPSED_CLOSE);
    expect(alarms.at(-1)).toBe(T0 + 600_000 + ROOM_ALARM_FLOOR_MS);

    // Still stuck when that alarm fires a second later: the next waits another second, never at once.
    vi.setSystemTime(T0 + 600_000 + ROOM_ALARM_FLOOR_MS);
    await document.alarm();
    expect(alarms.at(-1)).toBe(T0 + 600_000 + 2 * ROOM_ALARM_FLOOR_MS);
  });
});
