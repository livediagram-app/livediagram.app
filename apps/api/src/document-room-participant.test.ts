import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A Participant in the room (docs/specs/013-workspace/share-roles.md "Integrity"): content ops go through the
// participant content rule against what D1 holds and only the rule's result reaches anyone; dots, responses and
// ideas relay like an Editor's and reach D1 without one; everything else from a Participant is dropped.

const { store } = vi.hoisted(() => ({ store: { data: '' as string | null, writes: 0 } }));
vi.mock('./db', async (orig) => ({
  ...(await orig<typeof import('./db')>()),
  getTabData: async () => store.data,
  swapTabData: async (_env: unknown, _d: string, _t: string, expected: string, next: string) => {
    if (store.data !== expected) return false;
    store.data = next;
    store.writes++;
    return true;
  },
}));

import { DocumentRoom } from './document-room';
import { ANSWERS_FLUSH_MS } from './room-participant';

const ME = 'a'.repeat(32);
const box = { x: 0, y: 0, width: 100, height: 80 };
const sticky = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'sticky',
  ...box,
  label: 'x',
  ...extra,
});
const shape = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'shape',
  shape: 'rectangle',
  ...box,
  label: 'Column',
  ...extra,
});

type Socket = { sent: string[]; attachment: unknown };

function socket(attachment: Record<string, unknown>): Socket {
  return { sent: [], attachment };
}

function newRoom() {
  const sockets: Socket[] = [];
  const kv = new Map<string, unknown>();
  const state = {
    acceptWebSocket: () => {},
    // Every socket through one WebSocket object each, since the room compares them by identity.
    getWebSockets: () => sockets.map(wsOf),
    storage: {
      get: (k: string) => Promise.resolve(kv.get(k)),
      put: (k: string, v: unknown) => Promise.resolve(void kv.set(k, v)),
      delete: (k: string) => Promise.resolve(kv.delete(k)),
      list: ({ prefix }: { prefix: string }) =>
        Promise.resolve(new Map([...kv].filter(([k]) => k.startsWith(prefix)))),
      setAlarm: () => Promise.resolve(),
      deleteAlarm: () => Promise.resolve(),
    },
    blockConcurrencyWhile: (fn: () => Promise<void>) => fn(),
    waitUntil: () => {},
  };
  const room = new DocumentRoom(state as unknown as DurableObjectState, {} as never);
  const join = (
    id: string,
    role: 'view' | 'participate' | 'edit',
    adderKey: string | null = null,
  ) => {
    const s = socket({
      presenceId: id,
      verifiedRole: role,
      presence: { id, key: `key-${id}`, name: id, color: '#abc', role },
      adderKey,
      documentId: 'd1',
    });
    sockets.push(s);
    return s;
  };
  return { room, join };
}

function asWs(s: Socket): WebSocket {
  return {
    send: (d: string) => void s.sent.push(d),
    serializeAttachment: (v: unknown) => void (s.attachment = v),
    deserializeAttachment: () => s.attachment,
    __socket: s,
  } as unknown as WebSocket;
}

// The room compares sockets by identity, so every frame from one fake must come through one WebSocket object.
const wsCache = new WeakMap<Socket, WebSocket>();
function wsOf(s: Socket): WebSocket {
  let ws = wsCache.get(s);
  if (!ws) {
    ws = asWs(s);
    wsCache.set(s, ws);
  }
  return ws;
}

const frames = (s: Socket) => s.sent.map((f) => JSON.parse(f) as Record<string, unknown>);
const ops = (s: Socket) => frames(s).filter((f) => f.kind === 'op');
const storedElements = () => (JSON.parse(store.data!) as { elements: unknown[] }).elements;
const settle = () => new Promise((r) => setTimeout(r, 0));

async function send(room: DocumentRoom, from: Socket, op: unknown, ref?: number) {
  await room.webSocketMessage(
    wsOf(from),
    JSON.stringify({ kind: 'op', op, ...(ref ? { ref } : {}) }),
  );
  await settle();
}

beforeEach(() => {
  store.data = JSON.stringify({ elements: [shape('col'), sticky('ed')] });
  store.writes = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DocumentRoom: a Participant adds and writes', () => {
  it('stores an added sticky stamped with its adder, and everyone takes the stored copy', async () => {
    const { room, join } = newRoom();
    const editor = join('E', 'edit');
    const part = join('P', 'participate', ME);
    await send(room, part, {
      kind: 'el',
      tabId: 't1',
      op: { kind: 'add', element: sticky('n'), at: 2 },
    });
    expect(storedElements()[2]).toMatchObject({ id: 'n', addedBy: ME });
    for (const s of [editor, part]) {
      expect(ops(s)).toEqual([
        expect.objectContaining({
          from: 'system',
          op: { kind: 'el', tabId: 't1', op: expect.objectContaining({ kind: 'add', at: 2 }) },
        }),
      ]);
    }
  });

  it('relays only the fields it changed, from the Participant, and answers its cursor', async () => {
    const { room, join } = newRoom();
    const editor = join('E', 'edit');
    const part = join('P', 'participate', ME);
    const op = { kind: 'update', element: shape('col', { label: 'Start doing' }) };
    await send(room, part, { kind: 'el', tabId: 't1', op }, 7);
    expect(storedElements()[0]).toMatchObject({ label: 'Start doing' });
    expect(ops(editor)).toEqual([
      expect.objectContaining({
        from: 'P',
        op: {
          kind: 'el',
          tabId: 't1',
          op: { kind: 'patch', id: 'col', set: { label: 'Start doing' } },
        },
      }),
    ]);
    expect(ops(part)).toEqual([]);
    expect(frames(part)).toContainEqual(expect.objectContaining({ kind: 'cursor', ref: 7 }));
  });

  // The review's case: an Editor resized the shape a moment ago and has not saved yet. The Participant's label
  // must reach everyone without the stored (older) size coming back with it.
  it('never sends the stored copy over live state: forbidden fields are simply not in the patch', async () => {
    const { room, join } = newRoom();
    const editor = join('E', 'edit');
    const part = join('P', 'participate', ME);
    const op = { kind: 'update', element: shape('col', { label: 'New', width: 999 }) };
    await send(room, part, { kind: 'el', tabId: 't1', op });
    expect(storedElements()[0]).toMatchObject({ label: 'New', width: 100 });
    expect(ops(editor)[0]).toMatchObject({
      from: 'P',
      op: { op: { kind: 'patch', id: 'col', set: { label: 'New' } } },
    });
    expect(ops(part)).toEqual([]);
  });

  it('re-hydrates the sender when the element is not saved yet', async () => {
    const { room, join } = newRoom();
    const part = join('P', 'participate', ME);
    await send(room, part, {
      kind: 'el',
      tabId: 't1',
      op: { kind: 'update', element: sticky('unsaved') },
    });
    expect(frames(part)).toContainEqual(expect.objectContaining({ kind: 'catchup', resync: true }));
  });

  it("refuses to delete an Editor's sticky: nothing written, the sender gets it back", async () => {
    const { room, join } = newRoom();
    const editor = join('E', 'edit');
    const part = join('P', 'participate', ME);
    await send(room, part, { kind: 'el', tabId: 't1', op: { kind: 'remove', id: 'ed' } });
    expect(store.writes).toBe(0);
    expect(ops(editor)).toEqual([]);
    expect(ops(part)).toEqual([
      {
        kind: 'op',
        from: 'system',
        op: { kind: 'el', tabId: 't1', op: { kind: 'add', element: sticky('ed'), at: 1 } },
      },
    ]);
  });

  it('re-hydrates the sender when the tab is gone', async () => {
    const { room, join } = newRoom();
    const part = join('P', 'participate', ME);
    store.data = null;
    await send(room, part, {
      kind: 'el',
      tabId: 't1',
      op: { kind: 'add', element: sticky('n'), at: 0 },
    });
    expect(frames(part)).toContainEqual(expect.objectContaining({ kind: 'catchup', resync: true }));
  });

  it('drops structure from a Participant: tabs, metadata, ticks, board changes', async () => {
    const { room, join } = newRoom();
    const editor = join('E', 'edit');
    const part = join('P', 'participate', ME);
    for (const op of [
      { kind: 'tab', tabId: 't1', tab: { id: 't1', name: 'x', elements: [] } },
      { kind: 'tab-meta', tabId: 't1', patch: { locked: true } },
      {
        kind: 'el-delta',
        tabId: 't1',
        elementId: 'col',
        delta: { kind: 'check', index: 0, text: 'a', done: true },
      },
      { kind: 'poll-start', poll: {} },
      { kind: 'drag-preview', tabId: 't1', ids: ['col'] },
    ]) {
      await send(room, part, op);
    }
    expect(ops(editor)).toEqual([]);
    expect(store.writes).toBe(0);
  });

  it('lets an Editor relay content as before, with no write by the room', async () => {
    const { room, join } = newRoom();
    const editor = join('E', 'edit');
    const part = join('P', 'participate', ME);
    const op = { kind: 'el', tabId: 't1', op: { kind: 'remove', id: 'ed' } };
    await send(room, editor, op);
    expect(ops(part)).toEqual([expect.objectContaining({ from: 'E', op })]);
    expect(store.writes).toBe(0);
  });

  it('drops every content op and answer from a Viewer', async () => {
    const { room, join } = newRoom();
    const editor = join('E', 'edit');
    const viewer = join('V', 'view');
    await send(room, viewer, {
      kind: 'el',
      tabId: 't1',
      op: { kind: 'add', element: sticky('n'), at: 0 },
    });
    await send(room, viewer, { kind: 'vote', tabId: 't1', elementId: 'ed', voter: 'V', delta: 1 });
    expect(ops(editor)).toEqual([]);
    expect(store.writes).toBe(0);
  });
});

describe("DocumentRoom: a Participant's answers", () => {
  it('relays a dot like an Editor and writes it to D1 without one', async () => {
    vi.useFakeTimers();
    store.data = JSON.stringify({
      elements: [sticky('ed')],
      vote: { active: true, revealed: false, votesPerPerson: 3, votes: {}, round: 'r1' },
    });
    const { room, join } = newRoom();
    const editor = join('E', 'edit');
    const part = join('P', 'participate', ME);
    const dot = {
      kind: 'vote',
      tabId: 't1',
      elementId: 'ed',
      voter: 'key-P',
      delta: 1,
      round: 'r1',
    };
    // A dot in someone else's name goes nowhere.
    const forged = { ...dot, voter: 'key-E' };
    await room.webSocketMessage(wsOf(part), JSON.stringify({ kind: 'op', op: forged }));
    await room.webSocketMessage(wsOf(part), JSON.stringify({ kind: 'op', op: dot }));
    expect(ops(editor)).toEqual([expect.objectContaining({ from: 'P', op: dot })]);
    expect(store.writes).toBe(0);
    await vi.advanceTimersByTimeAsync(ANSWERS_FLUSH_MS);
    expect(JSON.parse(store.data!).vote.votes).toEqual({ ed: ['key-P'] });
  });
});
