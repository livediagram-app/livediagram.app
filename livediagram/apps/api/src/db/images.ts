// images — the reference-index readers over the gallery (docs/specs/009-elements/images.md). The gallery rows
// and bytes live in liveworkspace's media service (src/media.ts). Which documents place each image comes
// from the image reference index (db/image-refs.ts), never from a tab body.

import { imageRefIndexOwnerStatement, isImageRefIndexComplete } from './image-refs';
import type { Env } from '../types';

// Map of imageId → the owner's documents that place it, each document once,
// ordered by name. Drives the Explorer Image Gallery's "Used in N documents"
// badge, so an image with no entry reads as unused. One query over the
// reference index; a shared tab (docs/specs/006-document/tab-document-many-to-many.md)
// is attributed to every one of the owner's documents that links it.
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
    `SELECT DISTINCT r.image_id, d.id AS document_id, d.name AS document_name
       FROM documents d
       JOIN document_tabs dt ON dt.document_id = d.id
       JOIN image_refs r ON r.tab_id = dt.tab_id
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
