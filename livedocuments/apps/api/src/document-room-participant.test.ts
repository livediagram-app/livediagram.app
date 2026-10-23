import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A Participant in the room (docs/specs/013-workspace/share-roles.md "Integrity"): it edits text only. Its element
// ops and article frames go through the participant rules against what D1 holds and only the rules' result reaches
// anyone; everything else from a Participant is dropped.

const { store } = vi.hoisted(() => {
  const store: { data: string | null; writes: number } = { data: '', writes: 0 };
  return { store };
});
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

import { DocumentRoom } from './document-room/document-room';

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
  const join = (id: string, role: 'view' | 'participate' | 'edit') => {
    const s = socket({
      presenceId: id,
      verifiedRole: role,
      presence: { id, key: `key-${id}`, name: id, color: '#abc', role },
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
const storedTab = () => JSON.parse(store.data!) as { elements: unknown[]; articles?: unknown };
const storedElements = () => storedTab().elements;
const settle = () => new Promise((r) => setTimeout(r, 0));

async function send(room: DocumentRoom, from: Socket, op: unknown, ref?: number) {
  room.webSocketMessage(wsOf(from), JSON.stringify({ kind: 'op', op, ...(ref ? { ref } : {}) }));
  await settle();
}

beforeEach(() => {
  store.data = JSON.stringify({ elements: [shape('col'), sticky('ed')] });
  store.writes = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

const paragraph = (text: string) => ({ id: 'b1', type: 'paragraph', runs: [{ text }] });
const articleTab = (text: string) =>
  JSON.stringify({
    elements: [shape('col')],
    pages: [{ id: 'p1', kind: 'article', orientation: 'portrait', flow: 'f1' }],
    articles: { f1: { blocks: [paragraph(text)] } },
  });

describe('DocumentRoom: a Participant edits text only', () => {
  it('relays and persists a change of words, only the fields it changed, and answers its cursor', async () => {
    const { room, join } = newRoom();
    const editor = join('E', 'edit');
    const part = join('P', 'participate');
    const op = { kind: 'update', element: shape('col', { label: 'Start doing' }) };
    await send(room, part, { kind: 'el', tabId: 't1', op }, 7);
    expect(storedElements()[0]).toMatchObject({ label: 'Start doing' });
    expect(store.writes).toBe(1);
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
    const part = join('P', 'participate');
    const op = { kind: 'update', element: shape('col', { label: 'New', width: 999 }) };
    await send(room, part, { kind: 'el', tabId: 't1', op });
    expect(storedElements()[0]).toMatchObject({ label: 'New', width: 100 });
    expect(ops(editor)[0]).toMatchObject({
      from: 'P',
      op: { op: { kind: 'patch', id: 'col', set: { label: 'New' } } },
    });
    expect(ops(part)).toEqual([]);
  });

  it('drops a move and a restyle: nothing written, nothing relayed', async () => {
    const { room, join } = newRoom();
    const editor = join('E', 'edit');
    const part = join('P', 'participate');
    const before = store.data;
    for (const element of [sticky('ed', { x: 300, y: 40 }), sticky('ed', { fillColor: '#000' })]) {
      await send(room, part, { kind: 'el', tabId: 't1', op: { kind: 'update', element } });
    }
    expect(store.writes).toBe(0);
    expect(store.data).toBe(before);
    expect(ops(editor)).toEqual([]);
  });

  it('drops an add: nothing written, and the sender takes it back off', async () => {
    const { room, join } = newRoom();
    const editor = join('E', 'edit');
    const part = join('P', 'participate');
    await send(room, part, {
      kind: 'el',
      tabId: 't1',
      op: { kind: 'add', element: sticky('n'), at: 2 },
    });
    expect(store.writes).toBe(0);
    expect(storedElements()).toHaveLength(2);
    expect(ops(editor)).toEqual([]);
    expect(ops(part)).toEqual([
      {
        kind: 'op',
        from: 'system',
        op: { kind: 'el', tabId: 't1', op: { kind: 'remove', id: 'n' } },
      },
    ]);
  });

  it('drops a delete: nothing written, and the sender gets the element back', async () => {
    const { room, join } = newRoom();
    const editor = join('E', 'edit');
    const part = join('P', 'participate');
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

  it('re-hydrates the sender when the element is not saved yet', async () => {
    const { room, join } = newRoom();
    const part = join('P', 'participate');
    await send(room, part, {
      kind: 'el',
      tabId: 't1',
      op: { kind: 'update', element: sticky('unsaved') },
    });
    expect(frames(part)).toContainEqual(expect.objectContaining({ kind: 'catchup', resync: true }));
  });

  it('re-hydrates the sender when the tab is gone', async () => {
    const { room, join } = newRoom();
    const part = join('P', 'participate');
    store.data = null;
    await send(room, part, {
      kind: 'el',
      tabId: 't1',
      op: { kind: 'update', element: sticky('ed', { label: 'y' }) },
    });
    expect(frames(part)).toContainEqual(expect.objectContaining({ kind: 'catchup', resync: true }));
  });

  it('writes in an article: persisted, and relayed marked for an editor to grow its pages', async () => {
    const { room, join } = newRoom();
    store.data = articleTab('Hello');
    const editor = join('E', 'edit');
    const part = join('P', 'participate');
    const frame = {
      kind: 'article',
      tabId: 't1',
      flow: 'f1',
      ops: [{ kind: 'put', block: paragraph('Hello there') }],
    };
    await send(room, part, frame, 3);
    expect(storedTab().articles).toEqual({ f1: { blocks: [paragraph('Hello there')] } });
    expect(ops(editor)).toEqual([
      expect.objectContaining({ from: 'P', op: { ...frame, grow: true } }),
    ]);
    expect(frames(part)).toContainEqual(expect.objectContaining({ kind: 'cursor', ref: 3 }));
  });

  it("drops an article's restyle, removal or creation, and re-hydrates the sender", async () => {
    const { room, join } = newRoom();
    store.data = articleTab('Hello');
    const editor = join('E', 'edit');
    const part = join('P', 'participate');
    await send(room, part, {
      kind: 'article',
      tabId: 't1',
      flow: 'f1',
      ops: [{ kind: 'style', style: { look: 'bold' } }],
    });
    expect(frames(part)).toContainEqual(expect.objectContaining({ kind: 'catchup', resync: true }));
    await send(room, part, { kind: 'article', tabId: 't1', flow: 'f1', removed: true });
    await send(room, part, {
      kind: 'article',
      tabId: 't1',
      flow: 'f2',
      created: true,
      ops: [{ kind: 'put', block: paragraph('New') }],
    });
    expect(store.writes).toBe(0);
    expect(ops(editor)).toEqual([]);
  });

  it('drops writing on a tab outside its link', async () => {
    const { room, join } = newRoom();
    store.data = articleTab('Hello');
    const editor = join('E', 'edit');
    const part = join('P', 'participate');
    (part.attachment as Record<string, unknown>).tabScope = 't9';
    await send(room, part, {
      kind: 'article',
      tabId: 't1',
      flow: 'f1',
      ops: [{ kind: 'put', block: paragraph('Sneaky') }],
    });
    await send(room, part, {
      kind: 'el',
      tabId: 't1',
      op: { kind: 'update', element: shape('col', { label: 'Sneaky' }) },
    });
    expect(store.writes).toBe(0);
    expect(ops(editor)).toEqual([]);
  });

  it('drops structure from a Participant: tabs, metadata, ticks, drag previews', async () => {
    const { room, join } = newRoom();
    const editor = join('E', 'edit');
    const part = join('P', 'participate');
    for (const op of [
      { kind: 'tab', tabId: 't1', tab: { id: 't1', name: 'x', elements: [] } },
      { kind: 'tab-meta', tabId: 't1', patch: { locked: true } },
      { kind: 'document-meta', name: 'Renamed', tabs: [] },
      {
        kind: 'el-delta',
        tabId: 't1',
        elementId: 'col',
        delta: { kind: 'check', index: 0, text: 'a', done: true },
      },
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
    const part = join('P', 'participate');
    const op = { kind: 'el', tabId: 't1', op: { kind: 'remove', id: 'ed' } };
    await send(room, editor, op);
    expect(ops(part)).toEqual([expect.objectContaining({ from: 'E', op })]);
    expect(store.writes).toBe(0);
  });

  it('drops every content op from a Viewer', async () => {
    const { room, join } = newRoom();
    const editor = join('E', 'edit');
    const viewer = join('V', 'view');
    await send(room, viewer, {
      kind: 'el',
      tabId: 't1',
      op: { kind: 'update', element: shape('col', { label: 'x' }) },
    });
    await send(room, viewer, {
      kind: 'article',
      tabId: 't1',
      flow: 'f1',
      ops: [{ kind: 'put', block: paragraph('x') }],
    });
    expect(ops(editor)).toEqual([]);
    expect(store.writes).toBe(0);
  });
});
