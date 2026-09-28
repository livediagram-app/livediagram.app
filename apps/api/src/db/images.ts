// images — gallery rows (docs/specs/009-elements/images.md). Bytes live in R2; D1 carries the
// metadata + owner. Which diagrams place each image comes from the image
// reference index (db/image-refs.ts), never from a tab body.

import {
  imageRefIndexDiagramStatement,
  imageRefIndexOwnerStatement,
  isImageRefIndexComplete,
} from './image-refs';
import { imageRowToSummary, type ImageRow } from '../image-row';
import type { Env, ImageSummary } from '../types';

export async function listImagesByOwner(env: Env, ownerId: string): Promise<ImageSummary[]> {
  const rows = await env.DB.prepare(
    'SELECT id, owner_id, content_type, byte_size, width, height, sha256, original_name, created_at FROM images WHERE owner_id = ? ORDER BY created_at DESC',
  )
    .bind(ownerId)
    .all<ImageRow>();
  return (rows.results ?? []).map(imageRowToSummary);
}

export async function findImageBySha(
  env: Env,
  ownerId: string,
  sha256: string,
): Promise<ImageSummary | null> {
  const row = await env.DB.prepare(
    'SELECT id, owner_id, content_type, byte_size, width, height, sha256, original_name, created_at FROM images WHERE owner_id = ? AND sha256 = ?',
  )
    .bind(ownerId, sha256)
    .first<ImageRow>();
  return row ? imageRowToSummary(row) : null;
}

export async function getImage(env: Env, id: string): Promise<{ ownerId: string } | null> {
  // The byte-read endpoint resolves auth from owner_id alone, so the
  // narrow projection is intentional. The byte-payload itself comes
  // from R2; D1 is only consulted for "does this image exist + who
  // owns it".
  const row = await env.DB.prepare('SELECT owner_id FROM images WHERE id = ?')
    .bind(id)
    .first<{ owner_id: string }>();
  return row ? { ownerId: row.owner_id } : null;
}

// The per-owner caps (docs/specs/009-elements/images.md "Size cap"); null = no cap.
export type ImageCaps = { maxImages: number | null; maxBytes: number | null };

// Inserts the row only while the owner stays within the caps. The check rides
// inside the INSERT, so it is atomic: concurrent uploads that each saw room in
// an earlier totals query cannot all land (the import pipeline uploads three
// at once). Returns null when the caps refused it.
export async function insertImage(
  env: Env,
  row: {
    id: string;
    ownerId: string;
    contentType: string;
    byteSize: number;
    width: number;
    height: number;
    sha256: string;
    originalName: string | null;
  },
  caps: ImageCaps = { maxImages: null, maxBytes: null },
): Promise<ImageSummary | null> {
  const createdAt = Date.now();
  const result = await env.DB.prepare(
    `INSERT INTO images (id, owner_id, content_type, byte_size, width, height, sha256, original_name, created_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
     WHERE (?10 IS NULL OR (SELECT COUNT(*) FROM images WHERE owner_id = ?2) < ?10)
       AND (?11 IS NULL OR (SELECT COALESCE(SUM(byte_size), 0) FROM images WHERE owner_id = ?2) + ?4 <= ?11)`,
  )
    .bind(
      row.id,
      row.ownerId,
      row.contentType,
      row.byteSize,
      row.width,
      row.height,
      row.sha256,
      row.originalName,
      createdAt,
      caps.maxImages,
      caps.maxBytes,
    )
    .run();
  if (!result.meta.changes) return null;
  return {
    id: row.id,
    contentType: row.contentType,
    byteSize: row.byteSize,
    width: row.width,
    height: row.height,
    originalName: row.originalName ?? undefined,
    createdAt,
  };
}

export async function deleteImage(env: Env, id: string): Promise<void> {
  await env.DB.prepare('DELETE FROM images WHERE id = ?').bind(id).run();
}

// Total image count + summed byte_size for one owner. Drives the
// soft-cap enforcement in POST /api/images (docs/specs/009-elements/images.md) plus the usage
// bar surfaced in the picker. Single grouped query so the worker
// doesn't pay two D1 round-trips per upload attempt.
export async function imageTotalsByOwner(
  env: Env,
  ownerId: string,
): Promise<{ count: number; bytes: number }> {
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS count, COALESCE(SUM(byte_size), 0) AS bytes FROM images WHERE owner_id = ?',
  )
    .bind(ownerId)
    .first<{ count: number; bytes: number }>();
  return {
    count: row?.count ?? 0,
    bytes: row?.bytes ?? 0,
  };
}

// Map of imageId → the owner's diagrams that place it, each diagram once,
// ordered by name. Drives the Explorer Image Gallery's "Used in N diagrams"
// badge, so an image with no entry reads as unused. One query over the
// reference index; a shared tab (docs/specs/006-diagram/tab-diagram-many-to-many.md)
// is attributed to every one of the owner's diagrams that links it.
//
// While the index backfill is incomplete the owner's tabs are indexed first,
// so an older image never reads as unused (and gets deleted by hand).
export async function imageUsageByOwner(
  env: Env,
  ownerId: string,
): Promise<Record<string, { id: string; name: string }[]>> {
  if (!(await isImageRefIndexComplete(env))) {
    await imageRefIndexOwnerStatement(env, ownerId).run();
  }
  const rows = await env.DB.prepare(
    `SELECT DISTINCT r.image_id, d.id AS diagram_id, d.name AS diagram_name
       FROM diagrams d
       JOIN diagram_tabs dt ON dt.diagram_id = d.id
       JOIN image_refs r ON r.tab_id = dt.tab_id
      WHERE d.owner_id = ?
      ORDER BY d.name, d.id`,
  )
    .bind(ownerId)
    .all<{ image_id: string; diagram_id: string; diagram_name: string }>();
  const usage: Record<string, { id: string; name: string }[]> = {};
  for (const row of rows.results ?? []) {
    (usage[row.image_id] ??= []).push({ id: row.diagram_id, name: row.diagram_name });
  }
  return usage;
}

// The byte-read endpoint's share check: a visitor with read access to
// diagram `d` may read image `id` only when one of `d`'s tabs places it. Read
// from the reference index, never a tab body; while the backfill is
// incomplete, the diagram's own tabs are indexed first.
export async function diagramReferencesImage(
  env: Env,
  diagramId: string,
  imageId: string,
  // A tab-scoped visitor (docs/specs/013-workspace/tab-scoped-share-links.md): only their tab counts.
  onlyTabId: string | null = null,
): Promise<boolean> {
  if (!(await isImageRefIndexComplete(env))) {
    await imageRefIndexDiagramStatement(env, diagramId).run();
  }
  const row = await env.DB.prepare(
    `SELECT 1 AS present
       FROM diagram_tabs dt
       JOIN image_refs r ON r.tab_id = dt.tab_id AND r.image_id = ?
      WHERE dt.diagram_id = ?${onlyTabId === null ? '' : ' AND dt.tab_id = ?'}
      LIMIT 1`,
  )
    .bind(...(onlyTabId === null ? [imageId, diagramId] : [imageId, diagramId, onlyTabId]))
    .first<{ present: number }>();
  return row !== null;
}
