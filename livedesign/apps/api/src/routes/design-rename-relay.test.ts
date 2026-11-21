import { afterEach, describe, expect, it, vi } from 'vitest';
import { sentJson } from '@liveworkspace/vitest-config/sent-request';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleDesigns } from './designs';

// PUT /api/designs/:id renaming a design (docs/specs/024-agents/agent-changesets.md "Whole-tab saves and tab
// renames"): an agent's rename reaches the open editors as the design-meta op an editor's own rename sends; an
// editor's rename, which the editor sends to the room itself, is not relayed again.

function roomRecorder(status = 204) {
  const bodies: unknown[] = [];
  const binding = {
    idFromName: (name: string) => name,
    get: () => ({
      fetch: async (_url: string, init?: RequestInit) => {
        bodies.push(init?.body ? sentJson(init) : null);
        if (status === 0) throw new Error('room down');
        return new Response(null, { status });
      },
    }),
  };
  return { bodies, binding };
}

let pending: Promise<unknown>[] = [];

function call(db: SqliteD1, method: string, path: string, body: unknown, token: boolean) {
  return handleDesigns(
    makeTestRouteContext(method, path, {
      env: db.env,
      owner: 'user_o',
      accountUserId: token ? null : 'user_o',
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
  const db = sqliteD1({ DESIGN_ROOM: room.binding } as unknown as Partial<Env>);
  await call(
    db,
    'POST',
    '/api/designs',
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

describe('a design rename', () => {
  it('relays an agent’s rename to the room with the tabs in order', async () => {
    const { db, room } = await setUp();
    expect((await call(db, 'PUT', '/api/designs/D', { name: 'Shop v2' }, true)).status).toBe(200);
    await Promise.all(pending);
    expect(room.bodies).toEqual([
      {
        op: {
          kind: 'design-meta',
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
    await call(db, 'PUT', '/api/designs/D', { name: 'Shop v2' }, false);
    await call(db, 'PUT', '/api/designs/D', { name: 'Shop v2' }, true);
    await Promise.all(pending);
    expect(room.bodies).toEqual([]);
  });

  it('keeps the rename and logs when the room cannot take it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const status of [500, 0]) {
      const { db } = await setUp(status);
      expect(
        (await call(db, 'PUT', '/api/designs/D', { name: `Shop ${status}` }, true)).status,
      ).toBe(200);
      await Promise.all(pending);
    }
    expect(warn.mock.calls.map((c): unknown => [c[0], (c[1] as { error: string }).error])).toEqual([
      ['[room-mutation] design-meta did not reach the room', 'status 500'],
      ['[room-mutation] design-meta did not reach the room', 'Error: room down'],
    ]);
  });
});

// An agent's tab order and tab folders (docs/specs/006-design/tab-folders.md "Agents", the MCP's change_tabs) reach the
// open editors the same way, so their bars regroup at once; an editor's own reorder is sent to the room by the editor.
describe('a tab order with tab folders', () => {
  const order = {
    tabs: [
      { id: 't2', folder: 'Plans' },
      { id: 't1', folder: null },
    ],
  };

  it('relays an agent’s order with each tab’s folder', async () => {
    const { db, room } = await setUp();
    expect((await call(db, 'PUT', '/api/designs/D', order, true)).status).toBe(200);
    await Promise.all(pending);
    expect(room.bodies).toEqual([
      {
        op: {
          kind: 'design-meta',
          name: 'Shop',
          tabs: [
            { id: 't2', name: 'Flow', orderIndex: 0, folder: 'Plans' },
            { id: 't1', name: 'Main', orderIndex: 1 },
          ],
        },
      },
    ]);
  });

  it('is an Editor’s alone: a Participant’s or a Viewer’s grant is refused, and nothing is relayed', async () => {
    const { db, room } = await setUp();
    for (const level of ['participate', 'view']) {
      const response = await handleDesigns(
        makeTestRouteContext('PUT', '/api/designs/D', {
          env: db.env,
          owner: 'user_v',
          accountUserId: null,
          verifiedUserId: 'user_v',
          body: order,
          token: { id: 'tok_v' },
          grant: {
            item: 'D',
            level,
            tab: null,
            sub: 'user_v',
            team: null,
            exp: 2_000_000_000,
            shareCode: null,
            token: 'g',
          } as never,
          waitUntil: (p) => void pending.push(p),
        }),
      );
      expect(response.status).toBe(403);
    }
    await Promise.all(pending);
    expect(room.bodies).toEqual([]);
  });

  it('does not relay an editor’s order again', async () => {
    const { db, room } = await setUp();
    expect((await call(db, 'PUT', '/api/designs/D', order, false)).status).toBe(200);
    await Promise.all(pending);
    expect(room.bodies).toEqual([]);
  });
});
