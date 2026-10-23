// image_refs: the image reference index (docs/specs/009-elements/images.md, "Reference index"), in the
// document's own SQLite (docs/specs/015-api/api.md "Storage"). A projection of the image elements inside
// `tabs.data`, so the share check and the push to D1 never read a tab body.
//
// Writes are STATEMENTS appended to the batch that writes the body, so the index lands in the same transaction
// as the blob it mirrors. Each change fills the document's outbox (document-room/document-schema.ts), and the
// room's next push hands D1's `document_images` the document's whole set, queues it for the media service
// (src/media.ts) and writes its placement grants (document-room/document-outbox.ts). A tab's rows go with the tab
// (a foreign key).

import type { DocumentEnv } from '../types';

// ---------- Writers ---------------------------------------------------

// A body replace: drop the tab's references the new body no longer has, then add the ones it does. A save that
// changes no image writes no row, so it owes D1 nothing.
export function imageRefReplaceStatements(
  env: DocumentEnv,
  tabId: string,
  ids: string[],
): D1PreparedStatement[] {
  return [
    env.DOCUMENT_DB.prepare(
      'DELETE FROM image_refs WHERE tab_id = ?1 AND image_id NOT IN (SELECT value FROM json_each(?2))',
    ).bind(tabId, JSON.stringify(ids)),
    ...imageRefAddStatements(env, tabId, ids),
  ];
}

// Add only: for a write that may have lost a race (a participant swap, the Q&A swap), where deleting could remove a
// reference the winner wrote.
export function imageRefAddStatements(
  env: DocumentEnv,
  tabId: string,
  ids: string[],
): D1PreparedStatement[] {
  if (ids.length === 0) return [];
  return [
    env.DOCUMENT_DB.prepare(
      'INSERT OR IGNORE INTO image_refs (tab_id, image_id) SELECT ?1, value FROM json_each(?2)',
    ).bind(tabId, JSON.stringify(ids)),
  ];
}

// ---------- Readers ---------------------------------------------------

// Every image the document places, each once: what D1's document_images holds for it after the next push.
export async function documentImageIds(env: DocumentEnv, documentId: string): Promise<string[]> {
  const { results } = await env.DOCUMENT_DB.prepare(
    `SELECT DISTINCT r.image_id
       FROM document_tabs dt JOIN image_refs r ON r.tab_id = dt.tab_id
      WHERE dt.document_id = ?
      ORDER BY r.image_id`,
  )
    .bind(documentId)
    .all<{ image_id: string }>();
  return results.map((r) => r.image_id);
}

// Whether the document places image `imageId` (on `onlyTabId` only, for a tab-scoped visitor): the byte
// endpoint's first question, answered from the document itself so an image placed a moment ago serves at once.
export async function documentPlacesImage(
  env: DocumentEnv,
  documentId: string,
  imageId: string,
  onlyTabId: string | null = null,
): Promise<boolean> {
  const row = await env.DOCUMENT_DB.prepare(
    `SELECT 1 AS present
       FROM document_tabs dt JOIN image_refs r ON r.tab_id = dt.tab_id AND r.image_id = ?1
      WHERE dt.document_id = ?2${onlyTabId === null ? '' : ' AND dt.tab_id = ?3'}
      LIMIT 1`,
  )
    .bind(...(onlyTabId === null ? [imageId, documentId] : [imageId, documentId, onlyTabId]))
    .first<{ present: number }>();
  return row !== null;
}
