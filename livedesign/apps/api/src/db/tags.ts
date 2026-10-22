// tags — per-person document tags (migration 0094, docs/specs/013-workspace/tags.md).

import { TAG_LIMIT, type Tag, type TagLink, type TagsList } from '@livedesign/api-schema';
import type { Env } from '../types';

type TagRow = { id: string; name: string; colour: string; created_at: number };

const toTag = (r: TagRow): Tag => ({
  id: r.id,
  name: r.name,
  colour: r.colour,
  createdAt: r.created_at,
});

// What a tag write can refuse with: the name is the owner's already, the owner is at the limit, or the tag (or the
// document) is not there for this owner.
export type TagWriteResult<T> =
  { ok: true; value: T } | { ok: false; reason: 'name-taken' | 'limit' | 'not-found' };

const isUniqueViolation = (err: unknown) =>
  err instanceof Error && /UNIQUE constraint failed/.test(err.message);
const isForeignKeyViolation = (err: unknown) =>
  err instanceof Error && /FOREIGN KEY constraint failed/.test(err.message);

// The owner's tags and their links, in two reads served by the owner index and the document_tags primary key. A
// document in the Trash keeps its links for the restore but is left out here (docs/specs/013-workspace/trash.md), so
// a link returned always pointed at a live document at query time.
export async function listTags(env: Env, ownerId: string): Promise<TagsList> {
  const [tags, links] = await env.DB.batch([
    env.DB.prepare(
      'SELECT id, name, colour, created_at FROM tags WHERE owner_id = ?1 ORDER BY name COLLATE NOCASE',
    ).bind(ownerId),
    env.DB.prepare(
      `SELECT dt.tag_id, dt.document_id FROM tags t
         JOIN document_tags dt ON dt.tag_id = t.id
        WHERE t.owner_id = ?1
          AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.id = dt.document_id AND d.trashed_at IS NOT NULL)`,
    ).bind(ownerId),
  ]);
  return {
    tags: ((tags?.results ?? []) as TagRow[]).map(toTag),
    links: ((links?.results ?? []) as { tag_id: string; document_id: string }[]).map(
      (r): TagLink => ({ tagId: r.tag_id, documentId: r.document_id }),
    ),
  };
}

// Make a tag. The limit is counted in the same statement as the insert (INSERT ... SELECT WHERE count < limit), so two
// tabs racing at 99 cannot both land; the unique index answers a name already used.
export async function createTag(
  env: Env,
  ownerId: string,
  input: { id: string; name: string; colour: string },
): Promise<TagWriteResult<Tag>> {
  const now = Date.now();
  try {
    const res = await env.DB.prepare(
      `INSERT INTO tags (id, owner_id, name, colour, created_at, updated_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?5
        WHERE (SELECT COUNT(*) FROM tags WHERE owner_id = ?2) < ?6`,
    )
      .bind(input.id, ownerId, input.name, input.colour, now, TAG_LIMIT)
      .run();
    if ((res.meta?.changes ?? 0) === 0) return { ok: false, reason: 'limit' };
  } catch (err) {
    // A name the owner uses, or (vanishingly) an id someone already holds: either way not this tag.
    if (isUniqueViolation(err)) return { ok: false, reason: 'name-taken' };
    throw err;
  }
  return {
    ok: true,
    value: { id: input.id, name: input.name, colour: input.colour, createdAt: now },
  };
}

// Rename and / or recolour one of the owner's tags.
export async function updateTag(
  env: Env,
  ownerId: string,
  id: string,
  patch: { name?: string; colour?: string },
): Promise<TagWriteResult<Tag>> {
  try {
    const row = await env.DB.prepare(
      `UPDATE tags SET name = COALESCE(?3, name), colour = COALESCE(?4, colour), updated_at = ?5
        WHERE id = ?1 AND owner_id = ?2
        RETURNING id, name, colour, created_at`,
    )
      .bind(id, ownerId, patch.name ?? null, patch.colour ?? null, Date.now())
      .first<TagRow>();
    return row ? { ok: true, value: toTag(row) } : { ok: false, reason: 'not-found' };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: 'name-taken' };
    throw err;
  }
}

// Delete one of the owner's tags; its links cascade. False when it was not theirs.
export async function deleteTag(env: Env, ownerId: string, id: string): Promise<boolean> {
  const res = await env.DB.prepare('DELETE FROM tags WHERE id = ?1 AND owner_id = ?2')
    .bind(id, ownerId)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

// Put one of the owner's tags on a document, idempotently. The owner check rides in the insert (a tag that is not
// theirs inserts nothing), and the foreign key answers a document that is not there, without a lookup first.
export async function addDocumentTag(
  env: Env,
  ownerId: string,
  tagId: string,
  documentId: string,
): Promise<boolean> {
  try {
    const res = await env.DB.prepare(
      `INSERT INTO document_tags (tag_id, document_id, created_at)
       SELECT id, ?3, ?4 FROM tags WHERE id = ?1 AND owner_id = ?2
       ON CONFLICT (tag_id, document_id) DO NOTHING`,
    )
      .bind(tagId, ownerId, documentId, Date.now())
      .run();
    // Nothing inserted: on already, or not their tag. Only then is the second read paid.
    if ((res.meta?.changes ?? 0) > 0) return true;
  } catch (err) {
    if (isForeignKeyViolation(err)) return false;
    throw err;
  }
  return ownsTag(env, ownerId, tagId);
}

// Take one of the owner's tags off a document; silent when it was not on. False when the tag is not theirs.
export async function removeDocumentTag(
  env: Env,
  ownerId: string,
  tagId: string,
  documentId: string,
): Promise<boolean> {
  const res = await env.DB.prepare(
    `DELETE FROM document_tags
      WHERE tag_id = ?1 AND document_id = ?3
        AND EXISTS (SELECT 1 FROM tags WHERE id = ?1 AND owner_id = ?2)`,
  )
    .bind(tagId, ownerId, documentId)
    .run();
  if ((res.meta?.changes ?? 0) > 0) return true;
  return ownsTag(env, ownerId, tagId);
}

async function ownsTag(env: Env, ownerId: string, tagId: string): Promise<boolean> {
  const row = await env.DB.prepare('SELECT 1 AS ok FROM tags WHERE id = ?1 AND owner_id = ?2')
    .bind(tagId, ownerId)
    .first<{ ok: number }>();
  return row !== null;
}

// Signing up (docs/specs/013-workspace/tags.md "Tags follow the owner"): the statements that carry a guest's tags into
// the account, in order, for the owner migration's one batch. A guest tag whose name the account uses merges into the
// account's (its documents gain that tag, then it goes, its links cascading); the rest move over.
export function migrateTagStatements(env: Env, fromOwnerId: string, toOwnerId: string) {
  return {
    tagsMerge: env.DB.prepare(
      `INSERT OR IGNORE INTO document_tags (tag_id, document_id, created_at)
       SELECT a.id, dt.document_id, dt.created_at
         FROM tags g
         JOIN tags a ON a.owner_id = ?2 AND a.name = g.name COLLATE NOCASE
         JOIN document_tags dt ON dt.tag_id = g.id
        WHERE g.owner_id = ?1`,
    ).bind(fromOwnerId, toOwnerId),
    tagsMergeDrop: env.DB.prepare(
      `DELETE FROM tags
        WHERE owner_id = ?1
          AND EXISTS (SELECT 1 FROM tags a WHERE a.owner_id = ?2 AND a.name = tags.name COLLATE NOCASE)`,
    ).bind(fromOwnerId, toOwnerId),
    tags: env.DB.prepare('UPDATE tags SET owner_id = ?2 WHERE owner_id = ?1').bind(
      fromOwnerId,
      toOwnerId,
    ),
  };
}
