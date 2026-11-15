import { afterEach, describe, expect, it, vi } from 'vitest';
import { ARTICLE_HOLD_EXPIRE_MS } from '@livedocuments/api-schema';
import { DocumentRoom } from './document-room';

// docs/specs/007-editor/article-pages.md "Holding a paragraph": the room gives a paragraph to the first claim it
// receives, answers the claimant alone, relays only what it gave, and lets go with a release, a socket's end or the
// expiry. Driven through the hibernation handlers with socket and state fakes, as document-room.test.ts does.

type FakeSocket = {
  sent: string[];
  attachment: unknown;
  send: (data: string) => void;
  serializeAttachment: (value: unknown) => void;
  deserializeAttachment: () => unknown;
};

const asWs = (s: FakeSocket) => s as unknown as WebSocket;

function makeSocket(): FakeSocket {
  const socket: FakeSocket = {
    sent: [],
    attachment: null,
    send: (data) => socket.sent.push(data),
    serializeAttachment: (value) => {
      socket.attachment = value;
    },
    deserializeAttachment: () => socket.attachment,
  };
  return socket;
}

function newRoom() {
  const store = new Map<string, unknown>();
  const sockets: WebSocket[] = [];
  const state = {
    acceptWebSocket: (ws: WebSocket) => sockets.push(ws),
    getWebSockets: () => [...sockets],
    storage: {
      get: (key: string) => Promise.resolve(store.get(key)),
      put: (key: string, value: unknown) => Promise.resolve(void store.set(key, value)),
      delete: (key: string) => Promise.resolve(store.delete(key)),
      list: ({ prefix }: { prefix: string }) =>
        Promise.resolve(new Map([...store].filter(([key]) => key.startsWith(prefix)))),
      setAlarm: () => Promise.resolve(),
      deleteAlarm: () => Promise.resolve(),
      deleteAll: () => Promise.resolve(store.clear()),
    },
    blockConcurrencyWhile: (fn: () => Promise<void>) => fn(),
    waitUntil: () => {},
  };
  const room = new DocumentRoom(state as unknown as DurableObjectState);
  const close = (s: FakeSocket) => {
    sockets.splice(sockets.indexOf(asWs(s)), 1);
    room.webSocketClose(asWs(s));
  };
  return { room, close };
}

function connect(room: DocumentRoom, name: string, role: 'edit' | 'participate' | 'view') {
  const ws = makeSocket();
  room.acceptSession(asWs(ws), role);
  room.webSocketMessage(
    asWs(ws),
    JSON.stringify({ kind: 'hello', participant: { id: name, name, color: '#123456' } }),
  );
  ws.sent.length = 0;
  const id = (ws.attachment as { presence: { id: string } }).presence.id;
  return { ws, id };
}

const send = (room: DocumentRoom, s: FakeSocket, op: unknown, ref?: number) =>
  room.webSocketMessage(asWs(s), JSON.stringify({ kind: 'op', op, ...(ref ? { ref } : {}) }));

// What the room sent a socket, the roster frames of later joins aside.
const frames = (s: FakeSocket) =>
  s.sent
    .map((raw) => JSON.parse(raw) as Record<string, unknown>)
    .filter((f) => f.kind !== 'presence');
const ops = (s: FakeSocket) => frames(s).filter((f) => f.kind === 'op');

const claim = (blockId = 'b1', extra: Record<string, string> = {}) => ({
  kind: 'article-hold',
  tabId: 't',
  flow: 'f',
  blockId,
  ...extra,
});

async function holds(room: DocumentRoom, tab = 't') {
  const res = await room.fetch(new Request(`https://room/holds?tab=${tab}`));
  return ((await res.json()) as { holds: unknown[] }).holds;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('paragraph holds in the room', () => {
  it('gives a free paragraph, relays it unordered to the others and answers the claimant', async () => {
    const { room } = newRoom();
    const a = connect(room, 'a', 'edit');
    const b = connect(room, 'b', 'edit');
    send(room, a.ws, claim(), 7);
    expect(ops(b.ws)).toEqual([{ kind: 'op', from: a.id, op: claim() }]);
    // The answer: the claim's ref echoed on a cursor frame, the stream's seq unmoved.
    expect(frames(a.ws)).toEqual([{ kind: 'cursor', epoch: room.epoch, seq: 0, ref: 7 }]);
    expect(await holds(room)).toEqual([{ flow: 'f', blockId: 'b1', name: 'a', color: '#123456' }]);
  });

  it('refuses a second claim on a held paragraph: the claimant alone hears who holds it, nothing relayed', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { room } = newRoom();
    const a = connect(room, 'a', 'edit');
    const b = connect(room, 'b', 'participate');
    const c = connect(room, 'c', 'edit');
    send(room, a.ws, claim());
    b.ws.sent.length = 0;
    c.ws.sent.length = 0;
    send(room, b.ws, claim(), 3);
    expect(frames(b.ws)).toEqual([
      { kind: 'op', from: a.id, op: claim() },
      { kind: 'cursor', epoch: room.epoch, seq: 0, ref: 3 },
    ]);
    expect(frames(c.ws)).toHaveLength(0);
    expect(info).toHaveBeenCalledWith('[room] hold refused', { tabId: 't' });
  });

  it('holds a cell apart from its table and from other cells', async () => {
    const { room } = newRoom();
    const a = connect(room, 'a', 'edit');
    const b = connect(room, 'b', 'edit');
    send(room, a.ws, claim('tbl', { row: 'r1', col: 'c1' }));
    send(room, b.ws, claim('tbl', { row: 'r1', col: 'c2' }));
    expect(ops(a.ws)).toEqual([
      { kind: 'op', from: b.id, op: claim('tbl', { row: 'r1', col: 'c2' }) },
    ]);
    expect(await holds(room)).toHaveLength(2);
  });

  it('lets a holder move on: a claim elsewhere replaces its hold, and the old paragraph is free', () => {
    const { room } = newRoom();
    const a = connect(room, 'a', 'edit');
    const b = connect(room, 'b', 'edit');
    send(room, a.ws, claim('b1'));
    send(room, a.ws, claim('b2'));
    b.ws.sent.length = 0;
    send(room, b.ws, claim('b1'), 1);
    expect(frames(b.ws)).toEqual([{ kind: 'cursor', epoch: room.epoch, seq: 0, ref: 1 }]);
  });

  it('takes a refused claimant out of whatever it held before', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { room } = newRoom();
    const a = connect(room, 'a', 'edit');
    const b = connect(room, 'b', 'edit');
    send(room, a.ws, claim('b1'));
    send(room, b.ws, claim('b2'));
    a.ws.sent.length = 0;
    send(room, b.ws, claim('b1'));
    expect(ops(a.ws)).toEqual([{ kind: 'op', from: b.id, op: { kind: 'article-hold', tabId: 't', flow: null } }]);
    expect(await holds(room)).toEqual([{ flow: 'f', blockId: 'b1', name: 'a', color: '#123456' }]);
  });

  it('frees a paragraph on release, relayed; a release with nothing held relays nothing', async () => {
    const { room } = newRoom();
    const a = connect(room, 'a', 'edit');
    const b = connect(room, 'b', 'edit');
    send(room, b.ws, { kind: 'article-hold', tabId: 't', flow: null }, 2);
    expect(ops(a.ws)).toHaveLength(0);
    expect(frames(b.ws)).toEqual([{ kind: 'cursor', epoch: room.epoch, seq: 0, ref: 2 }]);
    send(room, a.ws, claim());
    send(room, a.ws, { kind: 'article-hold', tabId: 't', flow: null });
    expect(ops(b.ws).at(-1)).toEqual({
      kind: 'op',
      from: a.id,
      op: { kind: 'article-hold', tabId: 't', flow: null },
    });
    expect(await holds(room)).toEqual([]);
  });

  it('frees a paragraph when its socket goes', async () => {
    const { room, close } = newRoom();
    const a = connect(room, 'a', 'edit');
    const b = connect(room, 'b', 'edit');
    send(room, a.ws, claim());
    close(a.ws);
    send(room, b.ws, claim(), 4);
    expect(frames(b.ws).at(-1)).toEqual({ kind: 'cursor', epoch: room.epoch, seq: 0, ref: 4 });
    expect(await holds(room)).toEqual([{ flow: 'f', blockId: 'b1', name: 'b', color: '#123456' }]);
  });

  it('lets a hold not said again within the expiry go, and a refresh keep it', async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const { room } = newRoom();
    const a = connect(room, 'a', 'edit');
    const b = connect(room, 'b', 'edit');
    send(room, a.ws, claim());
    vi.setSystemTime(1_000_000 + ARTICLE_HOLD_EXPIRE_MS - 1);
    send(room, a.ws, claim());
    vi.setSystemTime(1_000_000 + ARTICLE_HOLD_EXPIRE_MS + 5);
    expect(await holds(room)).toHaveLength(1);
    vi.setSystemTime(1_000_000 + 2 * ARTICLE_HOLD_EXPIRE_MS);
    expect(await holds(room)).toEqual([]);
    b.ws.sent.length = 0;
    send(room, b.ws, claim(), 9);
    expect(frames(b.ws)).toEqual([{ kind: 'cursor', epoch: room.epoch, seq: 0, ref: 9 }]);
  });

  it("drops a Viewer's claim and a malformed one: nothing held, relayed or answered", async () => {
    const { room } = newRoom();
    const v = connect(room, 'v', 'view');
    const a = connect(room, 'a', 'edit');
    send(room, v.ws, claim(), 5);
    send(room, a.ws, { kind: 'article-hold', tabId: 't', flow: 'f' }, 6);
    expect(frames(v.ws)).toHaveLength(0);
    expect(frames(a.ws)).toHaveLength(0);
    expect(await holds(room)).toEqual([]);
  });

  it('answers each tab its own holds, and refuses a holds read without a tab', async () => {
    const { room } = newRoom();
    const a = connect(room, 'a', 'edit');
    send(room, a.ws, claim());
    expect(await holds(room, 'other')).toEqual([]);
    const res = await room.fetch(new Request('https://room/holds'));
    expect(res.status).toBe(400);
  });
});
