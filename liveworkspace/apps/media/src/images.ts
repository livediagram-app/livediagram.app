// The images index (liveworkspace/docs/specs/006-media/media.md "Storage"): one row per stored image, its bytes in R2
// under the same id.

import {
  LIBRARY_REF_APP,
  type ImageSource,
  type MediaApp,
  type MediaImage,
  type MediaUsage,
  type MediaUsageResponse,
} from '@liveworkspace/media';
import type { Env } from './env';

export type ImageRow = {
  id: string;
  owner: string;
  app: MediaApp;
  content_type: string;
  byte_size: number;
  width: number;
  height: number;
  sha256: string;
  original_name: string | null;
  created_at: number;
  // The document it was uploaded for (migrations/0002_image_document.sql), or null.
  document: string | null;
  // The tool that uploaded it (migrations/0003_image_source.sql), or null for a person's upload.
  source: ImageSource | null;
};

// The gallery's view of a row. The owner and the hash never leave the service through it.
export function rowToImage(row: ImageRow): MediaImage {
  return {
    id: row.id,
    contentType: row.content_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    originalName: row.original_name ?? undefined,
    createdAt: row.created_at,
    app: row.app,
    ...(row.source ? { source: row.source } : {}),
  };
}

export type Caps = { maxImages: number | null; maxBytes: number | null };

// The owner's uploads, newest first: every one (the data export), or its pictures alone (an app's gallery, which
// never offers a PDF: media.md "PDFs").
export async function listImages(
  env: Env,
  owner: string,
  kinds: 'all' | 'pictures' = 'all',
): Promise<MediaImage[]> {
  const only = kinds === 'pictures' ? " AND content_type LIKE 'image/%'" : '';
  const { results } = await env.MEDIA_DB.prepare(
    `SELECT * FROM images WHERE owner = ?${only} ORDER BY created_at DESC, id`,
  )
    .bind(owner)
    .all<ImageRow>();
  return results.map(rowToImage);
}

export function getImage(env: Env, id: string): Promise<ImageRow | null> {
  return env.MEDIA_DB.prepare('SELECT * FROM images WHERE id = ?').bind(id).first<ImageRow>();
}

export async function findBySha(
  env: Env,
  owner: string,
  sha256: string,
): Promise<MediaImage | null> {
  const row = await env.MEDIA_DB.prepare('SELECT * FROM images WHERE owner = ? AND sha256 = ?')
    .bind(owner, sha256)
    .first<ImageRow>();
  return row ? rowToImage(row) : null;
}

export async function ownerTotals(
  env: Env,
  owner: string,
): Promise<{ count: number; bytes: number }> {
  const row = await env.MEDIA_DB.prepare(
    'SELECT COUNT(*) AS count, COALESCE(SUM(byte_size), 0) AS bytes FROM images WHERE owner = ?',
  )
    .bind(owner)
    .first<{ count: number; bytes: number }>();
  return { count: row?.count ?? 0, bytes: row?.bytes ?? 0 };
}

// Insert a stored image, checking both caps inside the statement so uploads racing each other can't
// together pass one. Null when nothing was inserted: the same bytes landed first from another upload, or
// a cap refused it.
export async function insertImage(
  env: Env,
  row: Omit<ImageRow, 'created_at'>,
  caps: Caps,
): Promise<MediaImage | null> {
  const createdAt = Date.now();
  const result = await env.MEDIA_DB.prepare(
    `INSERT OR IGNORE INTO images (id, owner, app, content_type, byte_size, width, height, sha256, original_name, created_at, document, source)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?13, ?14
     WHERE (?11 IS NULL OR (SELECT COUNT(*) FROM images WHERE owner = ?2) < ?11)
       AND (?12 IS NULL OR (SELECT COALESCE(SUM(byte_size), 0) FROM images WHERE owner = ?2) + ?5 <= ?12)`,
  )
    .bind(
      row.id,
      row.owner,
      row.app,
      row.content_type,
      row.byte_size,
      row.width,
      row.height,
      row.sha256,
      row.original_name,
      createdAt,
      caps.maxImages,
      caps.maxBytes,
      row.document,
      row.source,
    )
    .run();
  if (!result.meta.changes) return null;
  return rowToImage({ ...row, created_at: createdAt });
}

export async function deleteImageRow(env: Env, id: string): Promise<void> {
  await env.MEDIA_DB.prepare('DELETE FROM images WHERE id = ?').bind(id).run();
}

// Which documents place each of the owner's images, in any app, and which of them a Library item holds
// (libraries.md "Pictures": used, though no document places them). One read of the owner's references.
export async function usageOf(env: Env, owner: string): Promise<MediaUsageResponse> {
  const { results } = await env.MEDIA_DB.prepare(
    `SELECT r.image_id, r.app, r.document FROM refs r JOIN images i ON i.id = r.image_id
      WHERE i.owner = ? ORDER BY r.image_id, r.app, r.document`,
  )
    .bind(owner)
    .all<{ image_id: string; app: MediaApp | typeof LIBRARY_REF_APP; document: string }>();
  const usage: MediaUsage = {};
  const library = new Set<string>();
  for (const r of results) {
    if (r.app === LIBRARY_REF_APP) library.add(r.image_id);
    else (usage[r.image_id] ??= []).push({ app: r.app, document: r.document });
  }
  return { usage, library: [...library] };
}

// Which of the owner's images of `ids` nothing but `document` (in `app`) uses (media.md "Unused after a delete"): no
// other document's reference in any app, no Library item's, no unconfirmed reference but that document's own. One read,
// the release's rule without its claim, so an editor offers to delete only what nothing could miss.
export async function unusedOf(
  env: Env,
  app: MediaApp,
  owner: string,
  document: string,
  ids: readonly string[],
): Promise<string[]> {
  const { results } = await env.MEDIA_DB.prepare(
    `SELECT i.id FROM images i JOIN json_each(?4) j ON j.value = i.id
      WHERE i.owner = ?1
        AND NOT EXISTS (SELECT 1 FROM refs r WHERE r.image_id = i.id AND NOT (r.app = ?2 AND r.document = ?3))
        AND NOT EXISTS (SELECT 1 FROM pending_refs p WHERE p.image_id = i.id AND NOT (p.app = ?2 AND p.document = ?3))
      ORDER BY i.id`,
  )
    .bind(owner, app, document, JSON.stringify(ids))
    .all<{ id: string }>();
  return results.map((r) => r.id);
}

// A guest signed up: their images move to the account, in one statement, except those whose bytes the
// account already holds, which stay on the guest.
export async function mergeOwner(
  env: Env,
  from: string,
  to: string,
): Promise<{ moved: string[]; kept: string[] }> {
  const moved = await env.MEDIA_DB.prepare(
    `UPDATE images SET owner = ?2
      WHERE owner = ?1
        AND NOT EXISTS (SELECT 1 FROM images held WHERE held.owner = ?2 AND held.sha256 = images.sha256)
      RETURNING id`,
  )
    .bind(from, to)
    .all<{ id: string }>();
  const kept = await env.MEDIA_DB.prepare('SELECT id FROM images WHERE owner = ? ORDER BY id')
    .bind(from)
    .all<{ id: string }>();
  return { moved: moved.results.map((r) => r.id).sort(), kept: kept.results.map((r) => r.id) };
}

// Every image an owner uploaded, in every app: their ids, for R2, then the rows.
export async function deleteOwnerRows(env: Env, owner: string): Promise<string[]> {
  const gone = await env.MEDIA_DB.prepare('DELETE FROM images WHERE owner = ? RETURNING id')
    .bind(owner)
    .all<{ id: string }>();
  return gone.results.map((r) => r.id);
}
