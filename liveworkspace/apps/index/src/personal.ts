// A person's own things about items (liveworkspace/docs/one-explorer-contracts.md "Folders, tags,
// favourites, defaults"): tags, favourites, what they hid from Recent, and the folder New files each kind of item
// into. Like a star, putting a tag on an item grants and reveals nothing, so it checks only that the item exists.

import { isTagColour, TAG_LIMIT, TAG_NAME_MAX, type Tag } from '@liveworkspace/index-client';
import { personalScope, scopesOf } from './auth';
import { decodeCursor, encodeCursor, isId, parseLimit } from './codec';
import { DEFAULT_KEY_MAX } from './config';
import type { PersonContext } from './context';
import { reachableFolder } from './folders';
import { badRequest, conflict, json, noContent, notFound, readObject } from './http';
import { eventStatements } from './timeline';

type TagRow = { id: string; name: string; colour: string; created_at: number };

const toTag = (row: TagRow): Tag => ({
  id: row.id,
  name: row.name,
  colour: row.colour,
  createdAt: row.created_at,
});

// Trimmed, inner whitespace runs kept as one space; null when empty or too long.
function tagName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  return name && Array.from(name).length <= TAG_NAME_MAX ? name : null;
}

const isTagId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);

const isForeignKeyError = (err: unknown) => String(err).includes('FOREIGN KEY');
const isUniqueError = (err: unknown) => String(err).includes('UNIQUE');

async function getTag(ctx: PersonContext, id: string): Promise<TagRow | null> {
  return ctx.env.INDEX_DB.prepare(
    'SELECT id, name, colour, created_at FROM tags WHERE id = ? AND owner_id = ?',
  )
    .bind(id, ctx.person.id)
    .first<TagRow>();
}

export async function handleTags(ctx: PersonContext): Promise<Response> {
  const { request, env, segments, person } = ctx;
  const method = request.method;
  const db = env.INDEX_DB;

  if (segments.length === 1) {
    if (method === 'GET') {
      // At most TAG_LIMIT, so one answer holds them all.
      const { results } = await db
        .prepare(
          `SELECT id, name, colour, created_at FROM tags WHERE owner_id = ?
           ORDER BY name COLLATE NOCASE LIMIT ?`,
        )
        .bind(person.id, TAG_LIMIT)
        .all<TagRow>();
      return json({ tags: results.map(toTag) });
    }
    if (method === 'POST') {
      const body = await readObject(request);
      if (!body) return badRequest();
      if (body.id !== undefined && !isTagId(body.id)) return badRequest('invalid_tag');
      const name = tagName(body.name);
      if (!name || !isTagColour(body.colour)) return badRequest('invalid_tag');
      const now = Date.now();
      const row: TagRow = {
        id: (body.id as string | undefined) ?? crypto.randomUUID(),
        name,
        colour: body.colour.toLowerCase(),
        created_at: now,
      };
      try {
        // The limit is checked inside the insert, so two at once can't both pass it.
        const res = await db
          .prepare(
            `INSERT INTO tags (id, owner_id, name, colour, created_at, updated_at)
             SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM tags WHERE owner_id = ?) < ?`,
          )
          .bind(row.id, person.id, row.name, row.colour, now, now, person.id, TAG_LIMIT)
          .run();
        if (res.meta.changes === 0) return conflict('tag_limit');
      } catch (err) {
        if (isUniqueError(err)) {
          return conflict(String(err).includes('tags.id') ? 'invalid_tag' : 'tag_name_taken');
        }
        throw err;
      }
      return json({ tag: toTag(row) }, { status: 201 });
    }
  }

  const tagId = segments[1];
  if (!isTagId(tagId)) return notFound();

  if (segments.length === 2) {
    const tag = await getTag(ctx, tagId);
    if (!tag) return notFound();
    if (method === 'PATCH') {
      const body = await readObject(request);
      if (!body) return badRequest();
      const name = body.name === undefined ? tag.name : tagName(body.name);
      if (!name) return badRequest('invalid_tag');
      if (body.colour !== undefined && !isTagColour(body.colour)) return badRequest('invalid_tag');
      const colour = body.colour === undefined ? tag.colour : (body.colour as string).toLowerCase();
      try {
        await db
          .prepare('UPDATE tags SET name = ?, colour = ?, updated_at = ? WHERE id = ?')
          .bind(name, colour, Date.now(), tag.id)
          .run();
      } catch (err) {
        if (isUniqueError(err)) return conflict('tag_name_taken');
        throw err;
      }
      return json({ tag: toTag({ ...tag, name, colour }) });
    }
    if (method === 'DELETE') {
      await db.prepare('DELETE FROM tags WHERE id = ?').bind(tag.id).run();
      return noContent();
    }
  }

  // /tags/:id/items/:itemId
  if (segments.length === 4 && segments[2] === 'items' && isId(segments[3])) {
    const itemId = segments[3];
    if (!(await getTag(ctx, tagId))) return notFound();
    if (method === 'PUT') {
      try {
        await db
          .prepare('INSERT OR IGNORE INTO item_tags (tag_id, item_id, created_at) VALUES (?, ?, ?)')
          .bind(tagId, itemId, Date.now())
          .run();
      } catch (err) {
        if (isForeignKeyError(err)) return notFound();
        throw err;
      }
      return noContent();
    }
    if (method === 'DELETE') {
      await db
        .prepare('DELETE FROM item_tags WHERE tag_id = ? AND item_id = ?')
        .bind(tagId, itemId)
        .run();
      return noContent();
    }
  }
  return notFound();
}

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
