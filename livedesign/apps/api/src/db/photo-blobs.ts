// The photo blob store's rows (docs/specs/031-photo/photo-store.md "What is stored where"): one row a
// blob, stored once by content, and the tabs that hold a ref to it. Bytes live in R2 under
// `photo/<id>`; a tab reads a blob only through a ref.
import type { Env } from '../types';

export const photoBlobKey = (id: string): string => `photo/${id}`;

// D1 binds at most 100 parameters a statement: id lists are read and written in pages.
const PAGE = 90;

function pages<T>(list: readonly T[], size = PAGE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const marks = (n: number) => Array.from({ length: n }, () => '?').join(', ');

/** Of `ids`, those the tab holds a ref to. */
export async function tabHoldsBlobs(
  env: Env,
  tabId: string,
  ids: readonly string[],
): Promise<Set<string>> {
  const held = new Set<string>();
  for (const page of pages(ids)) {
    const rows = await env.DB.prepare(
      `SELECT blob_id FROM photo_blob_refs WHERE tab_id = ? AND blob_id IN (${marks(page.length)})`,
    )
      .bind(tabId, ...page)
      .all<{ blob_id: string }>();
    for (const r of rows.results ?? []) held.add(r.blob_id);
  }
  return held;
}

/** Of `ids`, those stored at all (by any tab). */
export async function storedBlobs(env: Env, ids: readonly string[]): Promise<Set<string>> {
  const stored = new Set<string>();
  for (const page of pages(ids)) {
    const rows = await env.DB.prepare(
      `SELECT id FROM photo_blobs WHERE id IN (${marks(page.length)})`,
    )
      .bind(...page)
      .all<{ id: string }>();
    for (const r of rows.results ?? []) stored.add(r.id);
  }
  return stored;
}

/** The bytes the tab's refs name, for its cap. */
export async function tabPhotoBytes(env: Env, tabId: string): Promise<number> {
  const row = await env.DB.prepare(
    'SELECT COALESCE(SUM(b.byte_size), 0) AS bytes FROM photo_blob_refs r JOIN photo_blobs b ON b.id = r.blob_id WHERE r.tab_id = ?',
  )
    .bind(tabId)
    .first<{ bytes: number }>();
  return row?.bytes ?? 0;
}

/** The blobs' rows (where new) and the tab's refs to them, in one batch. */
export async function recordBlobs(
  env: Env,
  tabId: string,
  blobs: readonly { id: string; type: string; size: number }[],
  now = Date.now(),
): Promise<void> {
  const statements = blobs.flatMap((b) => [
    env.DB.prepare(
      'INSERT OR IGNORE INTO photo_blobs (id, content_type, byte_size, created_at) VALUES (?, ?, ?, ?)',
    ).bind(b.id, b.type, b.size, now),
    // A ref made again is renewed: the blob was just named, so the sweep's grace starts over.
    env.DB.prepare(
      'INSERT INTO photo_blob_refs (tab_id, blob_id, created_at) VALUES (?, ?, ?) ON CONFLICT (tab_id, blob_id) DO UPDATE SET created_at = excluded.created_at',
    ).bind(tabId, b.id, now),
  ]);
  for (const page of pages(statements, 50)) await env.DB.batch(page);
}

/** Refs for `toTab` to every one of `ids` that `fromTab` holds. Answers those adopted. */
export async function adoptBlobs(
  env: Env,
  fromTab: string,
  toTab: string,
  ids: readonly string[],
  now = Date.now(),
): Promise<string[]> {
  const held = [...(await tabHoldsBlobs(env, fromTab, ids))];
  if (held.length === 0) return [];
  const statements = held.map((id) =>
    env.DB.prepare(
      'INSERT INTO photo_blob_refs (tab_id, blob_id, created_at) VALUES (?, ?, ?) ON CONFLICT (tab_id, blob_id) DO UPDATE SET created_at = excluded.created_at',
    ).bind(toTab, id, now),
  );
  for (const page of pages(statements, 50)) await env.DB.batch(page);
  return held;
}

/** Statements giving `toTab` a ref to every blob `fromTab` holds (a document copy, in its batch). */
export function copyBlobRefsStatements(env: Env, fromTab: string, toTab: string, now = Date.now()) {
  return [
    env.DB.prepare(
      'INSERT OR IGNORE INTO photo_blob_refs (tab_id, blob_id, created_at) SELECT ?, blob_id, ? FROM photo_blob_refs WHERE tab_id = ?',
    ).bind(toTab, now, fromTab),
  ];
}

/** A blob's content type, when the tab holds a ref to it. */
export async function blobForTab(
  env: Env,
  tabId: string,
  id: string,
): Promise<{ contentType: string } | null> {
  const row = await env.DB.prepare(
    'SELECT b.content_type AS content_type FROM photo_blob_refs r JOIN photo_blobs b ON b.id = r.blob_id WHERE r.tab_id = ? AND r.blob_id = ?',
  )
    .bind(tabId, id)
    .first<{ content_type: string }>();
  return row ? { contentType: row.content_type } : null;
}
