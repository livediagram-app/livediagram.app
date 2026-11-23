import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A Participant in the room (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Share roles"): an Editor minus
// the Review Period, the Knowledgebase Style and automations. Its element ops, article frames and page tree
// changes relay as an Editor's, with no write by the room (its editor saves, as an Editor's does); the settings and the
// style never ride its metadata. A Viewer's changes are dropped.

const { store } = vi.hoisted(() => {
  const store: { data: string | null; rev: number; writes: number } = {
    data: '',
    rev: 0,
    writes: 0,
  };
  return { store };
});
vi.mock('./db', async (orig) => ({
  ...(await orig<typeof import('./db')>()),
  getTabRow: async () =>
    store.data === null ? null : { data: store.data, rev: store.rev, updatedAt: 0 },
  swapTabData: async (
    _env: unknown,
    _d: string,
    _t: string,
    expected: { rev: number },
    next: string,
  ) => {
    if (store.rev !== expected.rev) return false;
    store.data = next;
    store.rev++;
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

describe('DocumentRoom: a Participant writes as an Editor', () => {
  it("relays a Participant's writing in an article as sent, and the room writes nothing", async () => {
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
    expect(ops(editor)).toEqual([expect.objectContaining({ from: 'P', op: frame })]);
    expect(frames(part)).toContainEqual(expect.objectContaining({ kind: 'cursor', ref: 3 }));
    expect(store.writes).toBe(0);
  });

  it("relays an Editor's writing in an article as sent", async () => {
    const { room, join } = newRoom();
    store.data = articleTab('Hello');
    const editor = join('E', 'edit');
    const reader = join('V', 'view');
    const frame = {
      kind: 'article',
      tabId: 't1',
      flow: 'f1',
      ops: [{ kind: 'put', block: paragraph('Hello there') }],
    };
    await send(room, editor, frame);
    expect(ops(reader)).toEqual([expect.objectContaining({ from: 'E', op: frame })]);
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

  it("relays a Participant's page tree changes and elements, never the settings or the style", async () => {
    const { room, join } = newRoom();
    const editor = join('E', 'edit');
    const part = join('P', 'participate');
    await send(room, part, { kind: 'tab-meta', tabId: 't1', patch: { name: 'Renamed' } });
    await send(room, part, {
      kind: 'el',
      tabId: 't1',
      op: { kind: 'update', element: shape('col', { label: 'Changed' }) },
    });
    await send(room, part, {
      kind: 'document-meta',
      name: 'K',
      tabs: [],
      knowledgeSettings: { reviewEvery: 30 },
      knowledgeStyle: { theme: 'ink' },
    });
    const relayed = ops(editor).map((f) => f.op as Record<string, unknown>);
    expect(relayed.map((o) => o.kind)).toEqual(['tab-meta', 'el', 'document-meta']);
    expect(relayed[2]).toEqual({ kind: 'document-meta', name: 'K', tabs: [] });
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

// A page's own fields (owner, Verify, approval) are the api's to tell (docs/specs/030-knowledgebase/verification.md
// "Share roles"): no socket's op carries them to a peer, whoever sent it, while the api's own patch still does.
describe('DocumentRoom: a page’s fields ride only the api’s op', () => {
  const verified = { owner: 'acct_x', verifiedAt: 1_800_000_000_000, verifiedBy: 'acct_x' };

  it.each([
    ['an Editor', 'edit', false],
    ['a Participant', 'participate', false],
    ['an API token granted write', 'edit', true],
  ] as const)(
    'relays the tab-meta of %s without knowledge, set or cleared',
    async (_who, role, token) => {
      const { room, join } = newRoom();
      const reader = join('V', 'view');
      const sender = join('S', role);
      if (token) (sender.attachment as Record<string, unknown>).apiToken = 'tok_1';
      await send(
        room,
        sender,
        { kind: 'tab-meta', tabId: 't1', patch: { name: 'Renamed', knowledge: verified } },
        4,
      );
      await send(room, sender, {
        kind: 'tab-meta',
        tabId: 't1',
        patch: {},
        clear: ['knowledge', 'cover'],
      });
      await send(room, sender, { kind: 'tab-meta', tabId: 't1', patch: {}, clear: ['knowledge'] });
      expect(ops(reader).map((f) => f.op)).toEqual([
        { kind: 'tab-meta', tabId: 't1', patch: { name: 'Renamed' } },
        { kind: 'tab-meta', tabId: 't1', patch: {}, clear: ['cover'] },
        { kind: 'tab-meta', tabId: 't1', patch: {} },
      ]);
      // The sender still hears its op landed, so a save waiting on it goes on.
      expect(frames(sender)).toContainEqual(expect.objectContaining({ kind: 'cursor', ref: 4 }));
      expect(store.writes).toBe(0);
    },
  );

  it('relays a writer’s whole tab without the page’s fields', async () => {
    const { room, join } = newRoom();
    const reader = join('V', 'view');
    const editor = join('E', 'edit');
    await send(room, editor, {
      kind: 'tab',
      tabId: 't1',
      tab: { id: 't1', name: 'Page', elements: [], knowledge: verified },
    });
    expect(ops(reader).map((f) => f.op)).toEqual([
      { kind: 'tab', tabId: 't1', tab: { id: 't1', name: 'Page', elements: [] } },
    ]);
  });

  it('drops a Viewer’s tab-meta whole, knowledge and all', async () => {
    const { room, join } = newRoom();
    const editor = join('E', 'edit');
    const viewer = join('V', 'view');
    await send(room, viewer, { kind: 'tab-meta', tabId: 't1', patch: { knowledge: verified } });
    expect(ops(editor)).toEqual([]);
  });

  it('carries the api’s own patch, set or cleared, to every open editor', async () => {
    const { room, join } = newRoom();
    const editor = join('E', 'edit');
    const reader = join('V', 'view');
    const op = { kind: 'tab-meta', tabId: 't1', patch: { knowledge: verified } };
    const cleared = { kind: 'tab-meta', tabId: 't1', patch: {}, clear: ['knowledge'] };
    for (const sent of [op, cleared]) {
      const res = await room.fetch(
        new Request('https://room/mutation', {
          method: 'POST',
          body: JSON.stringify({ op: sent }),
        }),
      );
      expect(res.status).toBe(204);
    }
    for (const s of [editor, reader]) {
      expect(ops(s)).toEqual([
        expect.objectContaining({ from: 'system', op }),
        expect.objectContaining({ from: 'system', op: cleared }),
      ]);
    }
  });
});
