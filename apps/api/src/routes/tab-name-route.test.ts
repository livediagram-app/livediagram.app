import { afterEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// PUT /api/documents/:id/tabs/:tabId/name (docs/specs/024-agents/agent-changesets.md "Whole-tab
// saves and tab renames"): the name only, advancing the tab's revision, relayed to the room as the
// tab-meta an editor's own rename sends.

function roomRecorder() {
  const bodies: unknown[] = [];
  const binding = {
    idFromName: (name: string) => name,
    get: () => ({
      fetch: async (_url: string, init?: RequestInit) => {
        bodies.push(init?.body ? JSON.parse(String(init.body)) : null);
        return new Response(null, { status: 204 });
      },
    }),
  };
  return { bodies, binding };
}

const call = (
  db: SqliteD1,
  method: string,
  path: string,
  body?: unknown,
  owner = 'user_o',
  token = false,
) =>
  handleDocuments(
    makeTestRouteContext(method, path, {
      env: db.env,
      owner,
      clerkUserId: token ? null : owner,
      verifiedUserId: owner,
      body,
      token: token ? { id: 'tok_1' } : null,
    }),
  );

async function setUp() {
  const room = roomRecorder();
  const db = sqliteD1({ DOCUMENT_ROOM: room.binding } as unknown as Partial<Env>);
  await call(db, 'POST', '/api/documents', {
    id: 'D',
    name: 'Doc',
    tabs: [{ id: 't1', name: 'Board', elements: [] }],
  });
  return { db, room };
}

afterEach(() => vi.restoreAllMocks());

describe('the tab rename route', () => {
  it('renames, advances the revision, relays tab-meta and logs, for a token too', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db, room } = await setUp();
    const res = await call(
      db,
      'PUT',
      '/api/documents/D/tabs/t1/name',
      { name: 'Payments' },
      'user_o',
      true,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      tab: { id: 't1', name: 'Payments', documentId: 'D' },
    });
    expect(db.sql.prepare("SELECT name, rev FROM tabs WHERE id = 't1'").get()).toEqual({
      name: 'Payments',
      rev: 2,
    });
    expect(room.bodies).toContainEqual({
      op: { kind: 'tab-meta', tabId: 't1', patch: { name: 'Payments' } },
    });
    expect(info).toHaveBeenCalledWith('[changeset] tab-renamed', {
      documentId: 'D',
      tabId: 't1',
      rev: 2,
    });
  });

  it('caps an over-long name', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db } = await setUp();
    const res = await call(db, 'PUT', '/api/documents/D/tabs/t1/name', { name: 'x'.repeat(500) });
    const { tab } = (await res.json()) as { tab: { name: string } };
    expect(tab.name.length).toBeLessThan(500);
  });

  it('refuses a missing or blank name, a tab the document lacks, and a stranger', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db } = await setUp();
    expect((await call(db, 'PUT', '/api/documents/D/tabs/t1/name', { name: '  ' })).status).toBe(
      400,
    );
    expect((await call(db, 'PUT', '/api/documents/D/tabs/t1/name', {})).status).toBe(400);
    expect((await call(db, 'PUT', '/api/documents/D/tabs/nope/name', { name: 'A' })).status).toBe(
      404,
    );
    expect(
      (await call(db, 'PUT', '/api/documents/D/tabs/t1/name', { name: 'A' }, 'user_x')).status,
    ).toBe(403);
  });
});
