import { afterEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Runtime } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// PUT /api/documents/:id renaming a document (docs/specs/024-agents/agent-changesets.md "Whole-tab saves and tab
// renames"): an agent's rename reaches the open editors as the document-meta op an editor's own rename sends; an
// editor's rename, which the editor sends to the room itself, is not relayed again.

function roomRecorder(status = 204) {
  const bodies: unknown[] = [];
  const binding = {
    for: () => ({
      fetch: async (_url: string, init?: RequestInit) => {
        bodies.push(init?.body ? JSON.parse(String(init.body)) : null);
        if (status === 0) throw new Error('room down');
        return new Response(null, { status });
      },
    }),
  };
  return { bodies, binding };
}

let pending: Promise<unknown>[] = [];

function call(db: SqliteD1, method: string, path: string, body: unknown, token: boolean) {
  return handleDocuments(
    makeTestRouteContext(method, path, {
      env: db.env,
      owner: 'user_o',
      clerkUserId: token ? null : 'user_o',
      verifiedUserId: 'user_o',
      body,
      token: token ? { id: 'tok_1' } : null,
      waitUntil: (p) => void pending.push(p),
    }),
  );
}

async function setUp(status?: number) {
  pending = [];
  const room = roomRecorder(status);
  const db = sqliteD1({ rooms: room.binding } as unknown as Partial<Runtime>);
  await call(
    db,
    'POST',
    '/api/documents',
    {
      id: 'D',
      name: 'Shop',
      tabs: [
        { id: 't1', name: 'Main', elements: [] },
        { id: 't2', name: 'Flow', elements: [] },
      ],
    },
    false,
  );
  room.bodies.length = 0;
  return { db, room };
}

afterEach(() => vi.restoreAllMocks());

describe('a document rename', () => {
  it('relays an agent’s rename to the room with the tabs in order', async () => {
    const { db, room } = await setUp();
    expect((await call(db, 'PUT', '/api/documents/D', { name: 'Shop v2' }, true)).status).toBe(200);
    await Promise.all(pending);
    expect(room.bodies).toEqual([
      {
        op: {
          kind: 'document-meta',
          name: 'Shop v2',
          tabs: [
            { id: 't1', name: 'Main', orderIndex: 0 },
            { id: 't2', name: 'Flow', orderIndex: 1 },
          ],
        },
      },
    ]);
  });

  it('relays neither an editor’s rename nor an agent’s unchanged name', async () => {
    const { db, room } = await setUp();
    await call(db, 'PUT', '/api/documents/D', { name: 'Shop v2' }, false);
    await call(db, 'PUT', '/api/documents/D', { name: 'Shop v2' }, true);
    await Promise.all(pending);
    expect(room.bodies).toEqual([]);
  });

  it('keeps the rename and logs when the room cannot take it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const status of [500, 0]) {
      const { db } = await setUp(status);
      expect(
        (await call(db, 'PUT', '/api/documents/D', { name: `Shop ${status}` }, true)).status,
      ).toBe(200);
      await Promise.all(pending);
    }
    expect(warn.mock.calls.map((c) => [c[0], (c[1] as { error: string }).error])).toEqual([
      ['[room-mutation] document-meta did not reach the room', 'status 500'],
      ['[room-mutation] document-meta did not reach the room', 'Error: room down'],
    ]);
  });
});
