// Folders (liveworkspace/docs/one-explorer-contracts.md "Folders, tags, favourites, defaults"): one tree
// per person and one per team, holding items from any app. A folder's parent is always in its own scope.
// Deleting one moves its folders and items up a level.

import { FOLDER_NAME_MAX, type Folder } from '@liveworkspace/index-client';
import { personalScope, scopeOf, scopesOf, teamScope, type Person } from './auth';
import { decodeCursor, encodeCursor, isId, parseLimit } from './codec';
import type { PersonContext } from './context';
import type { Env } from './env';
import { handleFolderPreviews } from './folder-previews';
import { badRequest, conflict, forbidden, json, noContent, notFound, readObject } from './http';

export type FolderRow = {
  id: string;
  name: string;
  parent_id: string | null;
  owner_id: string;
  team_id: string | null;
  scope: string;
  created_at: number;
  updated_at: number;
};

export const toFolder = (row: FolderRow): Folder => ({
  id: row.id,
  name: row.name,
  parentId: row.parent_id,
  teamId: row.team_id,
  ownerId: row.owner_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function getFolderRow(env: Env, id: string): Promise<FolderRow | null> {
  return env.INDEX_DB.prepare('SELECT * FROM folders WHERE id = ?').bind(id).first<FolderRow>();
}

// A folder the person can file into: their own, or a team's they have joined.
export async function reachableFolder(
  env: Env,
  person: Person,
  id: string,
): Promise<FolderRow | null> {
  const row = await getFolderRow(env, id);
  return row && scopesOf(person).includes(row.scope) ? row : null;
}

// The `team` filter as scopes: a joined team's, `personal`, or (absent) every one the person has. A
// team they have not joined is refused.
export function teamFilter(person: Person, team: string | null): string[] | Response | undefined {
  if (team === null || team === '') return undefined;
  if (team === 'personal') return [personalScope(person.id)];
  if (!person.teams.includes(team)) return forbidden('not_team_member');
  return [teamScope(team)];
}

export function readName(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name.length > 0 && name.length <= max ? name : null;
}

export async function handleFolders(ctx: PersonContext): Promise<Response> {
  const { request, env, url, segments, person } = ctx;
  const method = request.method;

  if (segments.length === 1) {
    if (method === 'GET') {
      const scopes = teamFilter(person, url.searchParams.get('team'));
      if (scopes instanceof Response) return scopes;
      const limit = parseLimit(url.searchParams.get('limit'), 200);
      const cursor = decodeCursor(url.searchParams.get('cursor'));
      if (limit === null || cursor === null) return badRequest('invalid_query');
      const { results } = await env.INDEX_DB.prepare(
        `SELECT * FROM folders WHERE scope IN (SELECT value FROM json_each(?))
         ${cursor ? 'AND (created_at, id) > (?, ?)' : ''}
         ORDER BY created_at, id LIMIT ?`,
      )
        .bind(
          JSON.stringify(scopes ?? scopesOf(person)),
          ...(cursor ? [cursor.at, cursor.id] : []),
          limit + 1,
        )
        .all<FolderRow>();
      const more = results.length > limit;
      const page = more ? results.slice(0, limit) : results;
      const last = page[page.length - 1];
      return json({
        folders: page.map(toFolder),
        nextCursor: more && last ? encodeCursor({ at: last.created_at, id: last.id }) : null,
      });
    }
    if (method === 'POST') return createFolder(ctx);
  }

  if (segments.length === 2 && segments[1] === 'previews' && method === 'GET') {
    return handleFolderPreviews(ctx);
  }

  if (segments.length === 2 && isId(segments[1])) {
    const folder = await reachableFolder(env, person, segments[1]);
    if (!folder) return notFound();
    if (method === 'PATCH') return updateFolder(ctx, folder);
    if (method === 'DELETE') {
      const db = env.INDEX_DB;
      await db.batch([
        db
          .prepare('UPDATE folders SET parent_id = ? WHERE parent_id = ?')
          .bind(folder.parent_id, folder.id),
        db
          .prepare('UPDATE items SET folder_id = ? WHERE folder_id = ?')
          .bind(folder.parent_id, folder.id),
        db.prepare('DELETE FROM folders WHERE id = ?').bind(folder.id),
      ]);
      return noContent();
    }
  }
  return notFound();
}

async function createFolder(ctx: PersonContext): Promise<Response> {
  const { request, env, person } = ctx;
  const body = await readObject(request);
  if (!body) return badRequest();
  const name = readName(body.name, FOLDER_NAME_MAX);
  if (!name) return badRequest('invalid_name');
  if (body.id !== undefined && !isId(body.id)) return badRequest('invalid_folder');
  if (body.teamId != null && !isId(body.teamId)) return badRequest('invalid_team');
  const teamId = (body.teamId as string | null | undefined) ?? null;
  if (teamId && !person.teams.includes(teamId)) return forbidden('not_team_member');
  const scope = scopeOf(person.id, teamId);
  let parentId: string | null = null;
  if (body.parentId != null) {
    if (!isId(body.parentId)) return badRequest('invalid_folder');
    const parent = await getFolderRow(env, body.parentId);
    if (!parent || parent.scope !== scope) return notFound('folder_not_found');
    parentId = parent.id;
  }
  const now = Date.now();
  const row: FolderRow = {
    id: (body.id as string | undefined) ?? crypto.randomUUID(),
    name,
    parent_id: parentId,
    owner_id: person.id,
    team_id: teamId,
    scope,
    created_at: now,
    updated_at: now,
  };
  try {
    await env.INDEX_DB.prepare(
      `INSERT INTO folders (id, name, parent_id, owner_id, team_id, scope, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(row.id, row.name, row.parent_id, row.owner_id, row.team_id, row.scope, now, now)
      .run();
  } catch (err) {
    // An id already taken: a retried create, or a client reusing one.
    if (String(err).includes('UNIQUE')) return conflict('folder_exists');
    throw err;
  }
  return json({ folder: toFolder(row) }, { status: 201 });
}

async function updateFolder(ctx: PersonContext, folder: FolderRow): Promise<Response> {
  const { request, env } = ctx;
  const body = await readObject(request);
  if (!body) return badRequest();
  // Check the whole body before writing any of it.
  let name: string | undefined;
  if (body.name !== undefined) {
    const read = readName(body.name, FOLDER_NAME_MAX);
    if (!read) return badRequest('invalid_name');
    name = read;
  }
  let parentId: string | null | undefined;
  if (body.parentId !== undefined) {
    if (body.parentId === null) parentId = null;
    else {
      if (!isId(body.parentId)) return badRequest('invalid_folder');
      const parent = await getFolderRow(env, body.parentId);
      if (!parent || parent.scope !== folder.scope) return notFound('folder_not_found');
      parentId = parent.id;
    }
  }
  const now = Date.now();
  if (parentId !== undefined) {
    // The cycle check is inside the move's own UPDATE, so two crossing moves can't both pass it.
    const res = await env.INDEX_DB.prepare(
      `UPDATE folders SET parent_id = ?, updated_at = ? WHERE id = ? AND NOT EXISTS (
         WITH RECURSIVE up(id) AS (
           SELECT ? UNION SELECT f.parent_id FROM folders f JOIN up ON f.id = up.id WHERE f.parent_id IS NOT NULL
         ) SELECT 1 FROM up WHERE id = ?)`,
    )
      .bind(parentId, now, folder.id, parentId, folder.id)
      .run();
    if (res.meta.changes === 0) return conflict('cycle');
  }
  if (name !== undefined) {
    await env.INDEX_DB.prepare('UPDATE folders SET name = ?, updated_at = ? WHERE id = ?')
      .bind(name, now, folder.id)
      .run();
  }
  const updated = await getFolderRow(env, folder.id);
  return json({ folder: toFolder(updated!) });
}
