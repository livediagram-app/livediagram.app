// The Library's rows (liveworkspace/docs/specs/006-media/libraries.md): `library_items`, `library_legacy_copies`, and
// the `refs` each item's pictures are kept under (app `library`, document the item's id), so the unused-image sweep
// never takes a picture a library still holds.

import {
  LIBRARY_ITEMS_PER_SCOPE_MAX,
  LIBRARY_REF_APP,
  type LibraryActor,
  type LibraryItemSummary,
  type LibraryScope,
} from '@liveworkspace/media';
import type { Env } from '../env';

export type LibraryRow = {
  id: string;
  scope: LibraryScope;
  scope_id: string;
  folder: string;
  title: string;
  width: number;
  height: number;
  kinds: string;
  elements: string;
  images: string;
  preview: string | null;
  app: string;
  created_by: string;
  legacy_ref: string | null;
  created_at: number;
  updated_at: number;
};

type SummaryRow = Omit<LibraryRow, 'elements' | 'images' | 'created_by' | 'legacy_ref'>;

const SUMMARY_COLUMNS =
  'id, scope, scope_id, folder, title, width, height, kinds, preview, app, created_at, updated_at';

function parseList(json: string): string[] {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function rowToSummary(row: SummaryRow): LibraryItemSummary {
  return {
    id: row.id,
    scope: row.scope,
    teamId: row.scope === 'team' ? row.scope_id : null,
    folder: row.folder,
    title: row.title,
    width: row.width,
    height: row.height,
    kinds: parseList(row.kinds),
    preview: row.preview,
    app: row.app,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// The elements an item keeps; a row that won't parse reads as none.
export function rowElements(row: Pick<LibraryRow, 'id' | 'elements'>): unknown[] {
  try {
    const value: unknown = JSON.parse(row.elements);
    if (Array.isArray(value)) return value;
  } catch {
    // Logged below.
  }
  console.warn('[library] corrupt elements', { id: row.id });
  return [];
}

export const rowImages = (row: Pick<LibraryRow, 'images'>): string[] => parseList(row.images);

// The scope's id a row of `scope` has for this actor: their owner for Personal, the team for a team.
export const scopeIdOf = (actor: LibraryActor, scope: LibraryScope, teamId: string | null) =>
  scope === 'personal' ? actor.owner : (teamId ?? '');

// Every item the actor can see, newest first: their Personal library and each of their teams'.
export async function listRows(env: Env, actor: LibraryActor): Promise<SummaryRow[]> {
  const teams = actor.teams.map((t) => t.id);
  const { results } = await env.MEDIA_DB.prepare(
    `SELECT ${SUMMARY_COLUMNS} FROM library_items
      WHERE (scope = 'personal' AND scope_id = ?1)
         OR (scope = 'team' AND scope_id IN (SELECT value FROM json_each(?2)))
      ORDER BY created_at DESC, id`,
  )
    .bind(actor.owner, JSON.stringify(teams))
    .all<SummaryRow>();
  return results;
}

export function getRow(env: Env, id: string): Promise<LibraryRow | null> {
  return env.MEDIA_DB.prepare('SELECT * FROM library_items WHERE id = ?')
    .bind(id)
    .first<LibraryRow>();
}

export function getRowByLegacy(
  env: Env,
  owner: string,
  legacyRef: string,
): Promise<LibraryRow | null> {
  return env.MEDIA_DB.prepare(
    `SELECT * FROM library_items WHERE scope = 'personal' AND scope_id = ? AND legacy_ref = ?`,
  )
    .bind(owner, legacyRef)
    .first<LibraryRow>();
}

export type NewRow = Omit<LibraryRow, 'created_at' | 'updated_at'>;

const refStatement = (env: Env, id: string, images: readonly string[]) =>
  env.MEDIA_DB.prepare(
    `INSERT OR IGNORE INTO refs (app, document, image_id) SELECT ?1, ?2, value FROM json_each(?3)`,
  ).bind(LIBRARY_REF_APP, id, JSON.stringify(images));

// Inserts rows into one scope, all or none, only while the scope then holds at most LIBRARY_ITEMS_PER_SCOPE_MAX: the
// cap is checked inside the statement, so saves racing each other can't together pass it. False when full.
export async function insertRows(
  env: Env,
  rows: readonly NewRow[],
  extra: D1PreparedStatement[] = [],
): Promise<boolean> {
  const first = rows[0];
  if (!first) return true;
  const now = Date.now();
  const db = env.MEDIA_DB;
  const count = db
    .prepare('SELECT COUNT(*) AS n FROM library_items WHERE scope = ? AND scope_id = ?')
    .bind(first.scope, first.scope_id);
  const held = (await count.first<{ n: number }>())?.n ?? 0;
  if (held + rows.length > LIBRARY_ITEMS_PER_SCOPE_MAX) return false;
  const statements: D1PreparedStatement[] = [];
  rows.forEach((row, i) => {
    statements.push(
      db
        .prepare(
          `INSERT INTO library_items (id, scope, scope_id, folder, title, width, height, kinds, elements, images,
             preview, app, created_by, legacy_ref, created_at, updated_at)
           SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?15
           WHERE (SELECT COUNT(*) FROM library_items WHERE scope = ?2 AND scope_id = ?3) < ?16`,
        )
        .bind(
          row.id,
          row.scope,
          row.scope_id,
          row.folder,
          row.title,
          row.width,
          row.height,
          row.kinds,
          row.elements,
          row.images,
          row.preview,
          row.app,
          row.created_by,
          row.legacy_ref,
          // Kept in the rows' order: the first is the newest.
          now - i,
          LIBRARY_ITEMS_PER_SCOPE_MAX,
        ),
      refStatement(env, row.id, rowImages(row)),
    );
  });
  const results = await db.batch([...statements, ...extra]);
  const inserted = results.filter((r, i) => i % 2 === 0 && i < rows.length * 2 && r.meta.changes);
  if (inserted.length === rows.length) return true;
  // A racing save filled the scope between the count and the batch: take back what landed.
  await deleteRows(
    env,
    rows.map((r) => r.id),
  );
  return false;
}

export async function renameRow(env: Env, id: string, title: string): Promise<LibraryRow | null> {
  return env.MEDIA_DB.prepare(
    'UPDATE library_items SET title = ?2, updated_at = ?3 WHERE id = ?1 RETURNING *',
  )
    .bind(id, title, Date.now())
    .first<LibraryRow>();
}

export async function renameFolderRows(
  env: Env,
  scope: LibraryScope,
  scopeId: string,
  from: string,
  to: string,
): Promise<number> {
  const result = await env.MEDIA_DB.prepare(
    `UPDATE library_items SET folder = ?4, updated_at = ?5
      WHERE scope = ?1 AND scope_id = ?2 AND folder = ?3`,
  )
    .bind(scope, scopeId, from, to, Date.now())
    .run();
  return result.meta.changes ?? 0;
}

export async function deleteRows(env: Env, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const list = JSON.stringify(ids);
  await env.MEDIA_DB.batch([
    env.MEDIA_DB.prepare(
      'DELETE FROM library_items WHERE id IN (SELECT value FROM json_each(?1))',
    ).bind(list),
    env.MEDIA_DB.prepare(
      'DELETE FROM refs WHERE app = ?1 AND document IN (SELECT value FROM json_each(?2))',
    ).bind(LIBRARY_REF_APP, list),
  ]);
}

// The old shape libraries ('<app>~<libraryId>') already copied into this owner's Personal library.
export async function copiedLegacy(env: Env, owner: string): Promise<Set<string>> {
  const { results } = await env.MEDIA_DB.prepare(
    'SELECT legacy FROM library_legacy_copies WHERE owner = ?',
  )
    .bind(owner)
    .all<{ legacy: string }>();
  return new Set(results.map((r) => r.legacy));
}

export const markCopiedStatement = (env: Env, owner: string, legacy: string) =>
  env.MEDIA_DB.prepare(
    'INSERT OR IGNORE INTO library_legacy_copies (owner, legacy, copied_at) VALUES (?, ?, ?)',
  ).bind(owner, legacy, Date.now());

// A guest signed up: their Personal items, and the shape libraries they had copied, move to the account.
export async function mergeOwnerItems(env: Env, from: string, to: string): Promise<number> {
  const [moved] = await env.MEDIA_DB.batch([
    env.MEDIA_DB.prepare(
      `UPDATE library_items SET scope_id = ?2 WHERE scope = 'personal' AND scope_id = ?1`,
    ).bind(from, to),
    env.MEDIA_DB.prepare(
      `UPDATE OR IGNORE library_legacy_copies SET owner = ?2 WHERE owner = ?1`,
    ).bind(from, to),
    env.MEDIA_DB.prepare('DELETE FROM library_legacy_copies WHERE owner = ?').bind(from),
  ]);
  return moved?.meta.changes ?? 0;
}

// An account deleted: its Personal items go, with their picture references. Items it saved to a team stay.
export async function deleteOwnerItems(env: Env, owner: string): Promise<number> {
  const { results } = await env.MEDIA_DB.prepare(
    `SELECT id FROM library_items WHERE scope = 'personal' AND scope_id = ?`,
  )
    .bind(owner)
    .all<{ id: string }>();
  const ids = results.map((r) => r.id);
  await deleteRows(env, ids);
  await env.MEDIA_DB.prepare('DELETE FROM library_legacy_copies WHERE owner = ?').bind(owner).run();
  return ids.length;
}
