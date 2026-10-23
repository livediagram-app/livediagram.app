// images — the reference-index reader over the gallery (docs/specs/009-elements/images.md). The gallery rows
// and bytes live in liveworkspace's media service (src/media.ts). Which documents place each image comes
// from `document_images`, which each document's Durable Object pushes from its own reference index
// (db/image-refs.ts, document-room/document-outbox.ts), never from a tab body.

import type { Env } from '../types';

// Map of imageId → the owner's documents that place it, each document once,
// ordered by name. Drives the Explorer Image Gallery's "Used in N documents"
// badge, so an image with no entry reads as unused. One query over the
// pushed index of each document's images.
export async function imageUsageByOwner(
  env: Env,
  ownerId: string,
): Promise<Record<string, { id: string; name: string }[]>> {
  const rows = await env.DB.prepare(
    `SELECT DISTINCT r.image_id, d.id AS document_id, d.name AS document_name
       FROM documents d
       JOIN document_images r ON r.document_id = d.id
      WHERE d.owner_id = ?
      ORDER BY d.name, d.id`,
  )
    .bind(ownerId)
    .all<{ image_id: string; document_id: string; document_name: string }>();
  const usage: Record<string, { id: string; name: string }[]> = {};
  for (const row of rows.results ?? []) {
    (usage[row.image_id] ??= []).push({ id: row.document_id, name: row.document_name });
  }
  return usage;
}
