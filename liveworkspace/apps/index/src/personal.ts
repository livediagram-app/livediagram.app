// A person's own things about items (liveworkspace/docs/one-explorer-contracts.md "Folders, favourites,
// defaults"): favourites, what they hid from Recent, and the folder New files each kind of item into.

import { personalScope, scopesOf } from './auth';
import { decodeCursor, encodeCursor, isId, parseLimit } from './codec';
import { DEFAULT_KEY_MAX } from './config';
import type { PersonContext } from './context';
import { reachableFolder } from './folders';
import { badRequest, json, noContent, notFound, readObject } from './http';
import { eventStatements } from './timeline';

const isForeignKeyError = (err: unknown) => String(err).includes('FOREIGN KEY');

export async function handleFavourites(ctx: PersonContext): Promise<Response> {
  const { request, env, url, segments, person } = ctx;
  const db = env.INDEX_DB;
  if (segments.length === 1 && request.method === 'GET') {
    const limit = parseLimit(url.searchParams.get('limit'));
    const cursor = decodeCursor(url.searchParams.get('cursor'));
    if (limit === null) return badRequest('invalid_query');
    if (cursor === null) return badRequest('invalid_cursor');
    const { results } = await db
      .prepare(
        `SELECT item_id, created_at FROM favourites WHERE person_id = ?
         ${cursor ? 'AND (created_at, item_id) < (?, ?)' : ''}
         ORDER BY created_at DESC, item_id DESC LIMIT ?`,
      )
      .bind(person.id, ...(cursor ? [cursor.at, cursor.id] : []), limit + 1)
      .all<{ item_id: string; created_at: number }>();
    const more = results.length > limit;
    const page = more ? results.slice(0, limit) : results;
    const last = page[page.length - 1];
    return json({
      favourites: page.map((r) => ({ itemId: r.item_id, createdAt: r.created_at })),
      nextCursor: more && last ? encodeCursor({ at: last.created_at, id: last.item_id }) : null,
    });
  }
  if (segments.length === 2 && isId(segments[1])) {
    const itemId = segments[1];
    if (request.method === 'PUT') {
      const now = Date.now();
      try {
        // A new favourite is on the person's own Timeline (theirs alone), when they reach the item.
        await db.batch([
          db
            .prepare(
              'INSERT OR IGNORE INTO favourites (person_id, item_id, created_at) VALUES (?, ?, ?)',
            )
            .bind(person.id, itemId, now),
          ...eventStatements(db, {
            itemId,
            type: 'favourited',
            actorId: person.id,
            at: now,
            scope: personalScope(person.id),
            when: {
              sql: `(SELECT created_at FROM favourites WHERE person_id = ? AND item_id = items.id) = ?
                    AND (scope IN (SELECT value FROM json_each(?))
                         OR EXISTS (SELECT 1 FROM shared_with WHERE person_id = ? AND item_id = items.id))`,
              args: [person.id, now, JSON.stringify(scopesOf(person)), person.id],
            },
          }),
        ]);
      } catch (err) {
        if (isForeignKeyError(err)) return notFound();
        throw err;
      }
      return noContent();
    }
    if (request.method === 'DELETE') {
      await db
        .prepare('DELETE FROM favourites WHERE person_id = ? AND item_id = ?')
        .bind(person.id, itemId)
        .run();
      return noContent();
    }
  }
  return notFound();
}

// PUT / DELETE /recent-hidden/:itemId: Hide from Recent and Show in Recent. The person's own view of the item, like a
// star: it leaves Recent and Jump Back In, and nothing else. Kept on the person's `opens` row; one made by hiding an
// item never opened (last_opened_at 0) goes again when it is shown.
export async function handleRecentHidden(ctx: PersonContext): Promise<Response> {
  const { request, env, segments, person } = ctx;
  const db = env.INDEX_DB;
  if (segments.length !== 2 || !isId(segments[1])) return notFound();
  const itemId = segments[1];
  if (request.method === 'PUT') {
    try {
      await db
        .prepare(
          `INSERT INTO opens (person_id, item_id, last_opened_at, hidden) VALUES (?, ?, 0, 1)
           ON CONFLICT (person_id, item_id) DO UPDATE SET hidden = 1`,
        )
        .bind(person.id, itemId)
        .run();
    } catch (err) {
      if (isForeignKeyError(err)) return notFound();
      throw err;
    }
    return noContent();
  }
  if (request.method === 'DELETE') {
    await db.batch([
      db
        .prepare('DELETE FROM opens WHERE person_id = ? AND item_id = ? AND last_opened_at = 0')
        .bind(person.id, itemId),
      db
        .prepare('UPDATE opens SET hidden = 0 WHERE person_id = ? AND item_id = ?')
        .bind(person.id, itemId),
    ]);
    return noContent();
  }
  return notFound();
}

const isDefaultKey = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length <= DEFAULT_KEY_MAX &&
  /^[A-Za-z0-9][A-Za-z0-9:_.-]*$/.test(value);

export async function handlePlacementDefaults(ctx: PersonContext): Promise<Response> {
  const { request, env, segments, person } = ctx;
  const db = env.INDEX_DB;
  if (segments.length === 1 && request.method === 'GET') {
    // The apps define a handful of keys, so one bounded answer holds them.
    const { results } = await db
      .prepare(
        'SELECT default_key, folder_id FROM placement_defaults WHERE person_id = ? ORDER BY default_key LIMIT 200',
      )
      .bind(person.id)
      .all<{ default_key: string; folder_id: string }>();
    return json({ defaults: results.map((r) => ({ key: r.default_key, folderId: r.folder_id })) });
  }
  if (segments.length === 2) {
    const key = segments[1];
    if (!isDefaultKey(key)) return badRequest('invalid_key');
    if (request.method === 'PUT') {
      const body = await readObject(request);
      if (!body || !isId(body.folderId)) return badRequest('invalid_folder');
      // Only the person's own folder or a joined team's; anything else reveals nothing.
      if (!(await reachableFolder(env, person, body.folderId))) return notFound('folder_not_found');
      await db
        .prepare(
          `INSERT INTO placement_defaults (person_id, default_key, folder_id, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT (person_id, default_key) DO UPDATE SET folder_id = excluded.folder_id, updated_at = excluded.updated_at`,
        )
        .bind(person.id, key, body.folderId, Date.now())
        .run();
      return noContent();
    }
    if (request.method === 'DELETE') {
      await db
        .prepare('DELETE FROM placement_defaults WHERE person_id = ? AND default_key = ?')
        .bind(person.id, key)
        .run();
      return noContent();
    }
  }
  return notFound();
}
