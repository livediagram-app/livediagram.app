import { describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { Tab } from '@livediagram/document';
import { DOCUMENT_CONVERSION_HEADER } from '@livediagram/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { upsertTab } from '../db/tabs';
import { trashDocument } from '../db/trash';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';
import { handleShare } from './share';
import { handleShared } from './shared';
import { handleFavourites } from './favourites';

// Every door onto a diagram, once it is in the Trash
// (docs/specs/013-workspace/trash.md, "While a diagram is in the Trash").
// A caller who could have opened it hears 410 `diagram_trashed`; anyone else
// the 404 a never-existing id gets; the lists simply don't have it.

const T0 = 1_700_000_000_000;

function insert(sql: DatabaseSync, table: string, row: Record<string, string | number | null>) {
  const cols = Object.keys(row);
  sql
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
}

type Room = { broadcasts: unknown[] };

function world(): SqliteD1 & Room {
  const room: Room = { broadcasts: [] };
  const db = sqliteD1({
    DOCUMENT_ROOM: {
      idFromName: (name: string) => `id:${name}`,
      get: () => ({
        fetch: async (url: string, init?: RequestInit) => {
          if (String(url).endsWith('/broadcast')) {
            room.broadcasts.push(JSON.parse(String(init?.body)));
          }
          return new Response(null, { status: 204 });
        },
      }),
    },
  } as unknown as Partial<Env>);
  insert(db.sql, 'documents', {
    id: 'A',
    owner_id: 'owner',
    name: 'A',
    shareable: 1,
    team_id: null,
    saved_at: T0,
    created_at: T0,
  });
  insert(db.sql, 'share_links', { code: 'code-A', document_id: 'A', role: 'edit', created_at: T0 });
  insert(db.sql, 'shared_with', {
    owner_id: 'visitor',
    document_id: 'A',
    role: 'edit',
    last_seen: T0,
  });
  insert(db.sql, 'favourites', { owner_id: 'owner', document_id: 'A', created_at: T0 });
  return Object.assign(db, room);
}

async function seedTab(db: SqliteD1) {
  await upsertTab(db.env, 'A', { id: 't1', name: 't1', elements: [] } as unknown as Tab, 0);
}

function call(
  db: SqliteD1,
  method: string,
  path: string,
  opts: Parameters<typeof makeTestRouteContext>[2] = {},
) {
  const ctx = makeTestRouteContext(method, path, { env: db.env, ...opts });
  const segment = ctx.segments[1];
  if (segment === 'share') return handleShare(ctx);
  if (segment === 'shared') return handleShared(ctx);
  if (segment === 'favourites') return handleFavourites(ctx);
  return handleDocuments(ctx);
}

async function status(res: Promise<Response> | Response | undefined) {
  const r = await res;
  return r
    ? { status: r.status, body: r.status === 204 ? null : await r.json().catch(() => null) }
    : null;
}

const TRASHED = { status: 410, body: { error: 'document_trashed' } };

async function trashed() {
  const db = world();
  await seedTab(db);
  await trashDocument(db.env, 'A', T0);
  return db;
}

describe('a trashed diagram, to someone who could open it', () => {
  const doors: [string, string, Parameters<typeof makeTestRouteContext>[2]?][] = [
    ['GET', '/api/diagrams/A'],
    ['PUT', '/api/diagrams/A', { body: { name: 'renamed' } }],
    ['GET', '/api/diagrams/A/tabs/t1'],
    ['PUT', '/api/diagrams/A/tabs/t1', { body: { id: 't1', name: 't1', elements: [] } }],
    ['DELETE', '/api/diagrams/A/tabs/t1'],
    ['GET', '/api/diagrams/A/log'],
    [
      'POST',
      '/api/diagrams/A/log',
      {
        body: {
          id: 'e1',
          tabId: 't1',
          kind: 'edit',
          summary: 's',
          elementIds: [],
          before: {},
          after: {},
          createdAt: T0,
        },
      },
    ],
    ['POST', '/api/diagrams/A/copy', { body: {} }],
    ['PUT', '/api/diagrams/A/folder', { body: { folderId: null } }],
    ['GET', '/api/diagrams/A/shared-tabs'],
    ['GET', '/api/diagrams/A/share'],
    ['POST', '/api/diagrams/A/room-ticket'],
  ];

  it.each(doors)('%s %s answers document_trashed to its owner', async (method, path, opts) => {
    const db = await trashed();
    expect(await status(call(db, method, path, { owner: 'owner', ...opts }))).toEqual(TRASHED);
  });

  it('answers document_trashed to a share-link holder', async () => {
    const db = await trashed();
    const res = call(db, 'GET', '/api/diagrams/A/tabs/t1', {
      owner: 'visitor',
      headers: { 'X-Share-Code': 'code-A' },
    });
    expect(await status(res)).toEqual(TRASHED);
  });

  it('resolves its share link to the deleted state', async () => {
    const db = await trashed();
    expect(await status(call(db, 'GET', '/api/share/code-A', { owner: 'visitor' }))).toEqual(
      TRASHED,
    );
    expect((await call(db, 'GET', '/api/share/code-A/image.svg'))!.status).toBe(410);
  });

  it('refuses to be re-created over by its owner', async () => {
    const db = await trashed();
    const res = call(db, 'POST', '/api/diagrams', {
      owner: 'owner',
      body: { id: 'A', name: 'again', tabs: [] },
    });
    expect(await status(res)).toEqual(TRASHED);
    expect(db.sql.prepare("SELECT name FROM documents WHERE id = 'A'").get()?.name).toBe('A');
  });
});

describe('a trashed diagram, to anyone else', () => {
  it('reads as missing', async () => {
    const db = await trashed();
    expect((await call(db, 'GET', '/api/diagrams/A', { owner: 'stranger' }))!.status).toBe(404);
    expect((await call(db, 'GET', '/api/diagrams/A/tabs/t1', { owner: 'stranger' }))!.status).toBe(
      404,
    );
  });

  it('cannot be claimed by re-creating its id', async () => {
    const db = await trashed();
    const res = call(db, 'POST', '/api/diagrams', {
      owner: 'attacker',
      body: { id: 'A', name: 'mine now', tabs: [] },
    });
    expect((await res)!.status).toBe(403);
    expect(db.sql.prepare("SELECT owner_id FROM documents WHERE id = 'A'").get()?.owner_id).toBe(
      'owner',
    );
  });

  it('refuses a realtime join, even with its share code', async () => {
    const db = await trashed();
    const res = await call(db, 'GET', '/api/diagrams/A/ws?s=code-A&o=owner', {
      headers: { Upgrade: 'websocket' },
    });
    expect(res!.status).toBe(404);
  });

  it('serves no thumbnail', async () => {
    const db = await trashed();
    expect(
      (await call(db, 'GET', '/api/diagrams/A/thumbnail', { owner: 'owner' }))!.status,
    ).not.toBe(200);
  });
});

describe('the lists, while it is in the Trash', () => {
  it('leave it out of the diagram list, Shared with you and Favourites', async () => {
    const db = await trashed();
    const list = await (await call(db, 'GET', '/api/diagrams', { owner: 'owner' }))!.json();
    const shared = await (await call(db, 'GET', '/api/shared', { owner: 'visitor' }))!.json();
    const stars = await (await call(db, 'GET', '/api/favourites', { owner: 'owner' }))!.json();
    expect(list).toEqual({ documents: [] });
    expect(shared).toEqual({ shared: [] });
    expect(stars).toEqual({ ids: [] });
  });
});

describe('DELETE /api/diagrams/:id', () => {
  it('moves the diagram to the Trash, keeping everything', async () => {
    const db = world();
    await seedTab(db);

    const res = await call(db, 'DELETE', '/api/diagrams/A', { owner: 'owner' });

    expect(res!.status).toBe(204);
    expect(
      db.sql.prepare("SELECT trashed_at FROM documents WHERE id = 'A'").get()?.trashed_at,
    ).toEqual(expect.any(Number));
    expect(db.sql.prepare("SELECT COUNT(*) AS n FROM tabs WHERE id = 't1'").get()?.n).toBe(1);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM share_links').get()?.n).toBe(1);
  });

  it('ends the realtime sessions with the deleted state', async () => {
    const db = world();
    await call(db, 'DELETE', '/api/diagrams/A', { owner: 'owner', waitUntil: (p) => void p });
    await vi.waitFor(() => expect(db.broadcasts).toEqual([{ op: { kind: 'diagram-trashed' } }]));
  });

  it('deletes for good with ?permanent=true', async () => {
    const db = world();
    await seedTab(db);

    const res = await call(db, 'DELETE', '/api/diagrams/A?permanent=true', { owner: 'owner' });

    expect(res!.status).toBe(204);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM documents').get()?.n).toBe(0);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM tabs').get()?.n).toBe(0);
  });

  it('purges a diagram already in the Trash with ?permanent=true', async () => {
    const db = await trashed();
    const res = await call(db, 'DELETE', '/api/diagrams/A?permanent=true', { owner: 'owner' });
    expect(res!.status).toBe(204);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM documents').get()?.n).toBe(0);
  });

  it('answers document_trashed for a diagram already in the Trash', async () => {
    const db = await trashed();
    expect(await status(call(db, 'DELETE', '/api/diagrams/A', { owner: 'owner' }))).toEqual(
      TRASHED,
    );
  });

  it('bypasses the Trash when the owner takes it offline', async () => {
    const db = world();
    const res = await call(db, 'DELETE', '/api/diagrams/A', {
      owner: 'owner',
      headers: { [DOCUMENT_CONVERSION_HEADER]: 'offline' },
    });
    expect(res!.status).toBe(204);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM documents').get()?.n).toBe(0);
  });

  it('sends a teammate’s Take Offline of a team diagram to the team Trash', async () => {
    // From the team's side a teammate taking the diagram into their own
    // browser is a deletion, the same reading the Timeline gives it.
    const db = world();
    insert(db.sql, 'teams', { id: 'team', name: 'Team', created_at: T0, updated_at: T0 });
    insert(db.sql, 'team_members', {
      id: 'm-bob',
      team_id: 'team',
      user_id: 'user_bob',
      role: 'member',
      status: 'joined',
      created_at: T0,
      updated_at: T0,
    });
    db.sql.prepare("UPDATE documents SET team_id = 'team', owner_id = 'user_alice'").run();

    const res = await call(db, 'DELETE', '/api/diagrams/A', {
      owner: 'user_bob',
      clerkUserId: 'user_bob',
      headers: { [DOCUMENT_CONVERSION_HEADER]: 'offline' },
    });

    expect(res!.status).toBe(204);
    expect(
      db.sql.prepare("SELECT trashed_at FROM documents WHERE id = 'A'").get()?.trashed_at,
    ).toEqual(expect.any(Number));
  });

  it('still refuses a share-link visitor', async () => {
    const db = world();
    const res = await call(db, 'DELETE', '/api/diagrams/A', {
      owner: 'visitor',
      headers: { 'X-Share-Code': 'code-A' },
    });
    expect(res!.status).toBe(403);
    expect(
      db.sql.prepare("SELECT trashed_at FROM documents WHERE id = 'A'").get()?.trashed_at,
    ).toBe(null);
  });
});
