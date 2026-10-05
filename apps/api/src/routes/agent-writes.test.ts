import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livediagram/document';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// livediagram-app/livediagram.app#343: agent and API tab writes were lost or clobbered people's
// edits (docs/specs/024-agents/agent-changesets.md "Why"). An agent wrote with the editor's
// whole-tab PUT, which never reached the room; a person's next save, built from a copy without the
// agent's change, erased it; and a personal document had no room at all.

const OWNER = 'user_owner';

function box(id: string, x = 0, label = id): Element {
  return { id, type: 'shape', shape: 'square', x, y: 0, width: 120, height: 60, label };
}

// A room that records what reached it and holds nothing.
function roomRecorder() {
  const calls: { url: string; body: unknown }[] = [];
  const binding = {
    idFromName: (name: string) => name,
    get: () => ({
      fetch: async (input: string | Request, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.url;
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        calls.push({ url, body });
        if (url.includes('/selections')) return Response.json({ selections: [] });
        return new Response(null, { status: 204 });
      },
    }),
  };
  return { calls, binding };
}

type Caller = 'person' | 'agent';

function call(
  db: SqliteD1,
  who: Caller,
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
) {
  const base = makeTestRouteContext(method, path, {
    env: db.env,
    owner: OWNER,
    clerkUserId: who === 'person' ? OWNER : null,
    verifiedUserId: OWNER,
    body,
    headers,
  });
  return handleDocuments(who === 'agent' ? { ...base, token: { id: 'tok_1' } } : base);
}

function storedIds(db: SqliteD1, tabId: string): string[] {
  const row = db.sql.prepare('SELECT data FROM tabs WHERE id = ?').get(tabId);
  return (JSON.parse(row!.data as string) as { elements: Element[] }).elements.map((e) => e.id);
}

async function personalDocument(room: ReturnType<typeof roomRecorder>) {
  const db = sqliteD1({ DOCUMENT_ROOM: room.binding } as unknown as Partial<Env>);
  const created = await call(db, 'person', 'POST', '/api/documents', {
    id: 'D',
    name: 'Board',
    tabs: [{ id: 't1', name: 'Board', elements: [box('a')] }],
  });
  expect(created.status).toBe(201);
  return db;
}

afterEach(() => vi.restoreAllMocks());

describe('agent writes (#343)', () => {
  it('refuses a whole-tab save presented with an API token', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await personalDocument(roomRecorder());
    const res = await call(db, 'agent', 'PUT', '/api/documents/D/tabs/t1', {
      id: 't1',
      name: 'Board',
      elements: [box('a'), box('b', 200)],
    });
    expect(res.status).toBe(405);
    expect(await res.json()).toMatchObject({ error: 'use_changesets' });
    expect(storedIds(db, 't1')).toEqual(['a']);
  });

  it("relays an agent's changeset to a personal document's room", async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const room = roomRecorder();
    const db = await personalDocument(room);
    const res = await call(db, 'agent', 'POST', '/api/documents/D/tabs/t1/changesets', {
      operations: [{ op: 'add', element: box('b', 200) }],
    });
    expect(res.status).toBe(200);
    const relayed = room.calls.find((c) => c.url.endsWith('/mutation'));
    expect(relayed?.body).toMatchObject({ op: { kind: 'changeset', tabId: 't1' } });
  });

  it("keeps an agent's element through a person's save from a copy without it", async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await personalDocument(roomRecorder());
    const seen = await call(db, 'person', 'GET', '/api/documents/D/tabs/t1');
    const { tab } = (await seen.json()) as { tab: { rev: number } };
    await call(db, 'agent', 'POST', '/api/documents/D/tabs/t1/changesets', {
      operations: [{ op: 'add', element: box('b', 200) }],
    });
    // The person's autosave, built before the agent's change reached them.
    const saved = await call(
      db,
      'person',
      'PUT',
      '/api/documents/D/tabs/t1',
      { id: 't1', name: 'Board', elements: [box('a', 0, 'moved by the person')] },
      { 'X-Changeset-Seen': String(tab.rev) },
    );
    expect(saved.status).toBe(200);
    expect(storedIds(db, 't1')).toEqual(['a', 'b']);
  });

  it("keeps a person's save made between an agent's read and its write", async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await personalDocument(roomRecorder());
    const read = await call(db, 'agent', 'GET', '/api/documents/D/tabs/t1');
    const { tab } = (await read.json()) as { tab: { rev: number } };
    // The person adds c while the model thinks.
    await call(db, 'person', 'PUT', '/api/documents/D/tabs/t1', {
      id: 't1',
      name: 'Board',
      elements: [box('a'), box('c', 400)],
    });
    const res = await call(db, 'agent', 'POST', '/api/documents/D/tabs/t1/changesets', {
      operations: [{ op: 'add', element: box('b', 200) }],
      base: { rev: tab.rev },
    });
    expect(res.status).toBe(200);
    expect(storedIds(db, 't1').sort()).toEqual(['a', 'b', 'c']);
  });
});
