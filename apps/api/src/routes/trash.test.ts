import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { trashDiagram } from '../db/trash';
import { makeTestRouteContext } from './test-route-context';
import { handleTrash } from './trash';

// /api/trash (docs/specs/013-workspace/trash.md, "The API"): list, restore,
// purge one, empty. The authority is the delete authority: the owner of a
// personal diagram, any joined member for a team one.

const T0 = 1_700_000_000_000;

function insert(sql: DatabaseSync, table: string, row: Record<string, string | number | null>) {
  const cols = Object.keys(row);
  sql
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
}

function diagram(sql: DatabaseSync, id: string, owner: string, team: string | null = null) {
  insert(sql, 'diagrams', {
    id,
    owner_id: owner,
    name: `Diagram ${id}`,
    shareable: 0,
    team_id: team,
    saved_at: T0,
    created_at: T0,
  });
}

// user_me has a personal diagram `mine`; the team `crew` (user_me and
// user_bob joined) holds `ours`; user_bob has a personal `bobs`. All trashed.
async function world(): Promise<SqliteD1> {
  const db = sqliteD1();
  insert(db.sql, 'teams', { id: 'crew', name: 'Crew', created_at: T0, updated_at: T0 });
  for (const user of ['user_me', 'user_bob']) {
    insert(db.sql, 'team_members', {
      id: `m-${user}`,
      team_id: 'crew',
      user_id: user,
      role: 'member',
      status: 'joined',
      created_at: T0,
      updated_at: T0,
    });
  }
  diagram(db.sql, 'mine', 'user_me');
  diagram(db.sql, 'ours', 'user_bob', 'crew');
  diagram(db.sql, 'bobs', 'user_bob');
  for (const id of ['mine', 'ours', 'bobs']) await trashDiagram(db.env, id, T0);
  return db;
}

const me = { owner: 'user_me', clerkUserId: 'user_me' };

function call(
  db: SqliteD1,
  method: string,
  path: string,
  opts: Parameters<typeof makeTestRouteContext>[2] = {},
) {
  return handleTrash(makeTestRouteContext(method, path, { env: db.env, ...opts }));
}

function ids(db: SqliteD1): string[] {
  return db.sql
    .prepare('SELECT id FROM diagrams ORDER BY id')
    .all()
    .map((r) => r.id as string);
}

function trashedAt(db: SqliteD1, id: string): unknown {
  return db.sql.prepare('SELECT trashed_at FROM diagrams WHERE id = ?').get(id)?.trashed_at;
}

describe('GET /api/trash', () => {
  it('lists the personal Trash and the joined team Trash', async () => {
    const db = await world();
    const res = await call(db, 'GET', '/api/trash', me);
    expect(res.status).toBe(200);
    const { trash } = (await res.json()) as { trash: { id: string; teamName: string | null }[] };
    expect(trash.map((t) => [t.id, t.teamName]).sort()).toEqual([
      ['mine', null],
      ['ours', 'Crew'],
    ]);
  });

  it('needs a caller', async () => {
    const db = await world();
    expect((await call(db, 'GET', '/api/trash')).status).toBe(400);
  });
});

describe('POST /api/trash/:id/restore', () => {
  it('restores the owner’s diagram and returns it', async () => {
    const db = await world();
    const res = await call(db, 'POST', '/api/trash/mine/restore', me);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { diagram: { id: string } }).diagram.id).toBe('mine');
    expect(trashedAt(db, 'mine')).toBeNull();
  });

  it('restores a team diagram for any joined member', async () => {
    const db = await world();
    expect((await call(db, 'POST', '/api/trash/ours/restore', me)).status).toBe(200);
    expect(trashedAt(db, 'ours')).toBeNull();
  });

  it('refuses someone else’s personal diagram as missing', async () => {
    const db = await world();
    expect((await call(db, 'POST', '/api/trash/bobs/restore', me)).status).toBe(404);
    expect(trashedAt(db, 'bobs')).toBe(T0);
  });

  it('refuses a guest holding the team owner’s id', async () => {
    // A team diagram's owner id is visible to teammates; the header alone
    // never proves membership or ownership.
    const db = await world();
    const res = await call(db, 'POST', '/api/trash/ours/restore', { owner: 'user_bob' });
    expect(res.status).toBe(404);
  });

  it('answers 404 for a live or unknown id', async () => {
    const db = await world();
    diagram(db.sql, 'live', 'user_me');
    expect((await call(db, 'POST', '/api/trash/live/restore', me)).status).toBe(404);
    expect((await call(db, 'POST', '/api/trash/nope/restore', me)).status).toBe(404);
  });
});

describe('DELETE /api/trash/:id', () => {
  it('purges one diagram for good', async () => {
    const db = await world();
    expect((await call(db, 'DELETE', '/api/trash/mine', me)).status).toBe(204);
    expect(ids(db)).toEqual(['bobs', 'ours']);
  });

  it('refuses what the caller may not delete', async () => {
    const db = await world();
    expect((await call(db, 'DELETE', '/api/trash/bobs', me)).status).toBe(404);
    expect(ids(db)).toEqual(['bobs', 'mine', 'ours']);
  });
});

describe('DELETE /api/trash', () => {
  it('empties the personal Trash only', async () => {
    const db = await world();
    const res = await call(db, 'DELETE', '/api/trash', me);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ purged: 1 });
    expect(ids(db)).toEqual(['bobs', 'ours']);
  });

  it('empties a team Trash for a joined member', async () => {
    const db = await world();
    const res = await call(db, 'DELETE', '/api/trash?team=crew', me);
    expect(await res.json()).toEqual({ purged: 1 });
    expect(ids(db)).toEqual(['bobs', 'mine']);
  });

  it('refuses a team Trash to anyone not joined', async () => {
    const db = await world();
    const stranger = { owner: 'user_x', clerkUserId: 'user_x' };
    expect((await call(db, 'DELETE', '/api/trash?team=crew', stranger)).status).toBe(404);
    expect((await call(db, 'DELETE', '/api/trash?team=crew', { owner: 'user_me' })).status).toBe(
      404,
    );
    expect(ids(db)).toEqual(['bobs', 'mine', 'ours']);
  });

  it('leaves live diagrams alone', async () => {
    const db = await world();
    diagram(db.sql, 'live', 'user_me');
    await call(db, 'DELETE', '/api/trash', me);
    expect(ids(db)).toContain('live');
  });
});

describe('unknown /api/trash routes', () => {
  it('answer 404', async () => {
    const db = await world();
    expect((await call(db, 'PUT', '/api/trash', me)).status).toBe(404);
    expect((await call(db, 'GET', '/api/trash/mine', me)).status).toBe(404);
  });
});
