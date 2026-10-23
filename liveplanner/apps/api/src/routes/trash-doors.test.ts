import { describe, expect, it, vi } from 'vitest';
import { sentJson } from '@liveplanner/vitest-config/sent-request';
import type { DatabaseSync } from 'node:sqlite';
import { PROJECT_CONVERSION_HEADER } from '@liveplanner/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { upsertTab } from '../db/tabs';
import { trashProject } from '../db/trash';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';
import { handleShare } from './share';
import { handleShared } from './shared';
import { handleFavourites } from './favourites';

// Every door onto a project, once it is in the Trash
// (docs/specs/013-workspace/trash.md, "While a project is in the Trash").
// A caller who could have opened it hears 410 `project_trashed`; anyone else
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
    PLAN_ROOM: {
      idFromName: (name: string) => `id:${name}`,
      get: () => ({
        fetch: async (url: string, init?: RequestInit) => {
          if (String(url).endsWith('/broadcast')) {
            room.broadcasts.push(sentJson(init));
          }
          return new Response(null, { status: 204 });
        },
      }),
    },
  } as unknown as Partial<Env>);
  insert(db.sql, 'projects', {
    id: 'A',
    owner_id: 'owner',
    name: 'A',
    shareable: 1,
    team_id: null,
    saved_at: T0,
    created_at: T0,
  });
  insert(db.sql, 'share_links', { code: 'code-A', project_id: 'A', role: 'edit', created_at: T0 });
  insert(db.sql, 'shared_with', {
    owner_id: 'visitor',
    project_id: 'A',
    role: 'edit',
    last_seen: T0,
  });
  insert(db.sql, 'favourites', { owner_id: 'owner', project_id: 'A', created_at: T0 });
  return Object.assign(db, room);
}

async function seedTab(db: SqliteD1) {
  await upsertTab(db.env, 'A', { id: 't1', name: 't1', elements: [] }, 0);
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
  return handleProjects(ctx);
}

async function status(res: Promise<Response> | Response | undefined) {
  const r = await res;
  return r
    ? { status: r.status, body: r.status === 204 ? null : await r.json().catch(() => null) }
    : null;
}

const TRASHED = { status: 410, body: { error: 'project_trashed' } };

async function trashed() {
  const db = world();
  await seedTab(db);
  await trashProject(db.env, 'A', T0);
  return db;
}

describe('a trashed project, to someone who could open it', () => {
  const doors: [string, string, Parameters<typeof makeTestRouteContext>[2]?][] = [
    ['GET', '/api/projects/A'],
    ['PUT', '/api/projects/A', { body: { name: 'renamed' } }],
    ['GET', '/api/projects/A/tabs/t1'],
    ['PUT', '/api/projects/A/tabs/t1', { body: { id: 't1', name: 't1', elements: [] } }],
    ['DELETE', '/api/projects/A/tabs/t1'],
    ['POST', '/api/projects/A/copy', { body: {} }],
    ['PUT', '/api/projects/A/folder', { body: { folderId: null } }],
    ['GET', '/api/projects/A/shared-tabs'],
    ['GET', '/api/projects/A/share'],
    ['POST', '/api/projects/A/room-ticket'],
  ];

  it.each(doors)('%s %s answers project_trashed to its owner', async (method, path, opts) => {
    const db = await trashed();
    expect(await status(call(db, method, path, { owner: 'owner', ...opts }))).toEqual(TRASHED);
  });

  it('answers project_trashed to a share-link holder', async () => {
    const db = await trashed();
    const res = call(db, 'GET', '/api/projects/A/tabs/t1', {
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
    expect((await call(db, 'GET', '/api/share/code-A/image.svg')).status).toBe(410);
  });

  it('refuses to be re-created over by its owner', async () => {
    const db = await trashed();
    const res = call(db, 'POST', '/api/projects', {
      owner: 'owner',
      body: { id: 'A', name: 'again', tabs: [] },
    });
    expect(await status(res)).toEqual(TRASHED);
    expect(db.sql.prepare("SELECT name FROM projects WHERE id = 'A'").get()?.name).toBe('A');
  });
});

describe('a trashed project, to anyone else', () => {
  it('reads as missing', async () => {
    const db = await trashed();
    expect((await call(db, 'GET', '/api/projects/A', { owner: 'stranger' })).status).toBe(404);
    expect((await call(db, 'GET', '/api/projects/A/tabs/t1', { owner: 'stranger' })).status).toBe(
      404,
    );
  });

  it('cannot be claimed by re-creating its id', async () => {
    const db = await trashed();
    const res = call(db, 'POST', '/api/projects', {
      owner: 'attacker',
      body: { id: 'A', name: 'mine now', tabs: [] },
    });
    expect((await res).status).toBe(403);
    expect(db.sql.prepare("SELECT owner_id FROM projects WHERE id = 'A'").get()?.owner_id).toBe(
      'owner',
    );
  });

  it('refuses a realtime join, even with its share code', async () => {
    const db = await trashed();
    const res = await call(db, 'GET', '/api/projects/A/ws?s=code-A&o=owner', {
      headers: { Upgrade: 'websocket' },
    });
    expect(res.status).toBe(404);
  });

  it('serves no thumbnail', async () => {
    const db = await trashed();
    expect(
      (await call(db, 'GET', '/api/projects/A/thumbnail', { owner: 'owner' })).status,
    ).not.toBe(200);
  });
});

describe('the lists, while it is in the Trash', () => {
  it('leave it out of the project list, Shared with you and Favourites', async () => {
    const db = await trashed();
    const list = await (await call(db, 'GET', '/api/projects', { owner: 'owner' })).json();
    const shared = await (await call(db, 'GET', '/api/shared', { owner: 'visitor' })).json();
    const stars = await (await call(db, 'GET', '/api/favourites', { owner: 'owner' })).json();
    expect(list).toEqual({ projects: [] });
    expect(shared).toEqual({ shared: [] });
    expect(stars).toEqual({ ids: [] });
  });
});

describe('DELETE /api/projects/:id', () => {
  it('moves the project to the Trash, keeping everything', async () => {
    const db = world();
    await seedTab(db);

    const res = await call(db, 'DELETE', '/api/projects/A', { owner: 'owner' });

    expect(res.status).toBe(204);
    expect(
      db.sql.prepare("SELECT trashed_at FROM projects WHERE id = 'A'").get()?.trashed_at,
    ).toEqual(expect.any(Number));
    expect(db.sql.prepare("SELECT COUNT(*) AS n FROM tabs WHERE id = 't1'").get()?.n).toBe(1);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM share_links').get()?.n).toBe(1);
  });

  it('ends the realtime sessions with the deleted state', async () => {
    const db = world();
    await call(db, 'DELETE', '/api/projects/A', { owner: 'owner', waitUntil: (p) => void p });
    await vi.waitFor(() => expect(db.broadcasts).toEqual([{ op: { kind: 'project-trashed' } }]));
  });

  it('deletes for good with ?permanent=true', async () => {
    const db = world();
    await seedTab(db);

    const res = await call(db, 'DELETE', '/api/projects/A?permanent=true', { owner: 'owner' });

    expect(res.status).toBe(204);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM projects').get()?.n).toBe(0);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM tabs').get()?.n).toBe(0);
  });

  it('purges a project already in the Trash with ?permanent=true', async () => {
    const db = await trashed();
    const res = await call(db, 'DELETE', '/api/projects/A?permanent=true', { owner: 'owner' });
    expect(res.status).toBe(204);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM projects').get()?.n).toBe(0);
  });

  it('answers project_trashed for a project already in the Trash', async () => {
    const db = await trashed();
    expect(await status(call(db, 'DELETE', '/api/projects/A', { owner: 'owner' }))).toEqual(
      TRASHED,
    );
  });

  it('bypasses the Trash when the owner takes it offline', async () => {
    const db = world();
    const res = await call(db, 'DELETE', '/api/projects/A', {
      owner: 'owner',
      headers: { [PROJECT_CONVERSION_HEADER]: 'offline' },
    });
    expect(res.status).toBe(204);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM projects').get()?.n).toBe(0);
  });

  it('sends a teammate’s Take Offline of a team project to the team Trash', async () => {
    // From the team's side a teammate taking the project into their own
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
    db.sql.prepare("UPDATE projects SET team_id = 'team', owner_id = 'user_alice'").run();

    const res = await call(db, 'DELETE', '/api/projects/A', {
      owner: 'user_bob',
      accountUserId: 'user_bob',
      headers: { [PROJECT_CONVERSION_HEADER]: 'offline' },
    });

    expect(res.status).toBe(204);
    expect(
      db.sql.prepare("SELECT trashed_at FROM projects WHERE id = 'A'").get()?.trashed_at,
    ).toEqual(expect.any(Number));
  });

  it('still refuses a share-link visitor', async () => {
    const db = world();
    const res = await call(db, 'DELETE', '/api/projects/A', {
      owner: 'visitor',
      headers: { 'X-Share-Code': 'code-A' },
    });
    expect(res.status).toBe(403);
    expect(db.sql.prepare("SELECT trashed_at FROM projects WHERE id = 'A'").get()?.trashed_at).toBe(
      null,
    );
  });
});
