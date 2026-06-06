// images — gallery rows (spec/19). Bytes live in R2; D1 carries the
// metadata + owner. Usage / reference scans parse tab bodies to find
// which diagrams place each image.

import { isBoxed, type Tab } from '@livediagram/diagram';
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
): Promise<ImageSummary> {
  const createdAt = Date.now();
  await env.DB.prepare(
    'INSERT INTO images (id, owner_id, content_type, byte_size, width, height, sha256, original_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
    )
    .run();
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
// soft-cap enforcement in POST /api/images (spec/19) plus the usage
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

// Build a map of imageId → list of the owner's diagrams that use it.
// Used by the Explorer Image Gallery so the user can spot unused
// images (empty list, safe to delete) vs. live ones (which diagrams
// would break on delete).
//
// Single pass over the owner's diagrams + their joined tabs: one
// query, then JSON-parse each tab body and walk its elements.
// O(diagrams + tabs + elements) per call, with no per-image work.
// Tabs that share an id across diagrams (per spec/17) get attributed
// to every diagram that references them, which is the user-facing
// truth.
export async function imageUsageByOwner(
  env: Env,
  ownerId: string,
): Promise<Record<string, { id: string; name: string }[]>> {
  const rows = await env.DB.prepare(
    `SELECT d.id AS diagram_id, d.name AS diagram_name, t.data AS tab_data
       FROM diagrams d
       JOIN diagram_tabs dt ON dt.diagram_id = d.id
       JOIN tabs t ON t.id = dt.tab_id
      WHERE d.owner_id = ?`,
  )
    .bind(ownerId)
    .all<{ diagram_id: string; diagram_name: string; tab_data: string }>();
  // diagramId → already-attributed image ids (avoids double-counting
  // when an image is reused across multiple tabs of one diagram, or
  // a shared tab attaches the diagram twice via the many-to-many).
  const seen = new Map<string, Set<string>>();
  const usage: Record<string, { id: string; name: string }[]> = {};
  for (const row of rows.results ?? []) {
    let tab: Tab;
    try {
      tab = JSON.parse(row.tab_data) as Tab;
    } catch {
      continue;
    }
    for (const el of tab.elements ?? []) {
      if (!isBoxed(el) || el.type !== 'image') continue;
      const imageId = (el as { imageId?: string | null }).imageId;
      if (!imageId) continue;
      let dedupe = seen.get(row.diagram_id);
      if (!dedupe) {
        dedupe = new Set();
        seen.set(row.diagram_id, dedupe);
      }
      if (dedupe.has(imageId)) continue;
      dedupe.add(imageId);
      const list = usage[imageId] ?? [];
      list.push({ id: row.diagram_id, name: row.diagram_name });
      usage[imageId] = list;
    }
  }
  return usage;
}

// Used by the byte-read endpoint to authorise share-code readers: a
// visitor with a valid X-Share-Code for diagram `d` can read image
// `id` IFF some tab on diagram `d` references that image via an
// ImageElement. Iterates the diagram's tabs and looks for the id
// in any image element. Sparse scan: most tabs have no image
// elements at all.
export async function diagramReferencesImage(
  env: Env,
  diagramId: string,
  imageId: string,
): Promise<boolean> {
  // Tabs live behind diagram_tabs (many-to-many per spec/17), so the
  // lookup joins through the link table rather than reading the
  // legacy `tabs.diagram_id` column directly.
  const rows = await env.DB.prepare(
    `SELECT t.data
       FROM diagram_tabs dt
       JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.diagram_id = ?`,
  )
    .bind(diagramId)
    .all<{ data: string }>();
  for (const row of rows.results ?? []) {
    try {
      const tab = JSON.parse(row.data) as Tab;
      for (const el of tab.elements ?? []) {
        if (
          isBoxed(el) &&
          el.type === 'image' &&
          (el as { imageId?: string | null }).imageId === imageId
        ) {
          return true;
        }
      }
    } catch {
      // Malformed JSON in a tab row is its own bug; for the auth
      // check we conservatively treat unparseable tabs as having
      // no image references rather than throwing the request away.
      continue;
    }
  }
  return false;
}
