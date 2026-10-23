// image_grants: which documents may serve an image their owner does not own
// (docs/specs/009-elements/images.md, "Placement grants").
//
// A reference alone (image_refs, in the document's own SQLite) does not let a document serve an image: an id
// pasted into an unrelated document must not keep the bytes reachable after its
// reader loses access to the original. A document serves image X when X's
// owner owns the document, X's owner is entitled to place it there right now, or the document holds a grant for
// X. Grants are written only at trusted moments: when the document's Durable Object pushes the images its bodies
// place (document-room/document-outbox.ts) while X's owner is entitled, and when a copy carries an image its source
// could serve. The live entitlement serves a placement before that push lands; the grant keeps serving it after
// the entitlement ends.

import type { Env } from '../types';
import { visitLinkSql } from './visit-link';

// Image `i`'s owner may place it in document `d` right now: a joined member of the document's team, or an edit
// collaborator whose visit's link is still live. A Participant edits text only and places no image
// (docs/specs/013-workspace/share-roles.md). A revoked or expired link earns nothing, so an id pasted after access
// went cannot be laundered into a grant. `now` is the bound parameter holding the current time.
function entitledSql(now: string): string {
  return `((d.team_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM team_members m
               WHERE m.team_id = d.team_id AND m.user_id = i.owner_id AND m.status = 'joined'))
           OR EXISTS (
              SELECT 1 FROM shared_with s
               WHERE s.owner_id = i.owner_id AND s.document_id = d.id
                 AND s.role = 'edit'
                 AND d.shareable = 1 AND ${visitLinkSql(now)} IS NOT NULL))`;
}

// The one predicate every reader shares: document `d` (aliased) may serve image
// `i` (aliased). Owner match first, so the common case never touches the
// grants table; the grant lookup is a primary-key probe, and the entitlement two indexed probes.
function servesSql(now: string): string {
  return `(i.owner_id = d.owner_id
   OR EXISTS (SELECT 1 FROM image_grants g WHERE g.document_id = d.id AND g.image_id = i.id)
   OR (i.owner_id <> '' AND ${entitledSql(now)}))`;
}

// ---------- Writers ---------------------------------------------------

// A document changing owner (a member leaving a team hands their work on; a team document moved into someone's
// own library): the images its owner placed served only because they owned it, so they stop serving the moment
// someone else does. Grant each one first, in the same batch as the owner change, to the documents `where`
// picks (a SQL condition on `d`, its params bound from ?2 on). A grant outlives the membership
// (docs/specs/009-elements/images.md "Placement grants").
export function imageGrantOwnerChangeStatement(
  env: Env,
  where: string,
  params: readonly (string | number | null)[],
  now: number,
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT OR IGNORE INTO image_grants (document_id, image_id, created_at)
     SELECT DISTINCT d.id, i.id, ?1
       FROM documents d
       JOIN document_images r ON r.document_id = d.id
       JOIN media_images i ON i.id = r.image_id AND i.owner_id = d.owner_id
      WHERE ${where}`,
  ).bind(now, ...params);
}

// For each image the document places, grant it when the image's owner is entitled to place it there right now
// (entitledSql). The writer's identity is not needed. An image the document's owner owns needs no row. Run by the
// document's push with its whole set (document-room/document-outbox.ts), so a placement keeps serving after the
// entitlement that let it in ends.
export function imageGrantPlacementStatements(
  env: Env,
  documentId: string,
  ids: string[],
  now: number,
): D1PreparedStatement[] {
  if (ids.length === 0) return [];
  return [
    env.DB.prepare(
      `INSERT OR IGNORE INTO image_grants (document_id, image_id, created_at)
       SELECT d.id, i.id, ?3
         FROM documents d
         JOIN media_images i ON i.id IN (SELECT value FROM json_each(?2))
        WHERE d.id = ?1
          AND i.owner_id <> d.owner_id
          AND ${entitledSql('?3')}`,
    ).bind(documentId, JSON.stringify(ids), now),
  ];
}

// A copy carries every image of the copied bodies that its source may serve,
// as a grant on the new document. The copier's own images need none (they own
// the copy); one the source could not serve is not laundered into a grant.
export function imageGrantCopyStatements(
  env: Env,
  sourceId: string,
  targetId: string,
  ids: string[],
  now: number,
): D1PreparedStatement[] {
  if (ids.length === 0) return [];
  return [
    env.DB.prepare(
      `INSERT OR IGNORE INTO image_grants (document_id, image_id, created_at)
       SELECT ?2, i.id, ?4
         FROM documents d
         JOIN media_images i ON i.id IN (SELECT value FROM json_each(?3))
        WHERE d.id = ?1
          AND ${servesSql('?4')}`,
    ).bind(sourceId, targetId, JSON.stringify(ids), now),
  ];
}

// Document removal: the grants go with the document (no foreign key, like document_images).
export function imageGrantRemovalStatement(
  env: Env,
  doomedDocuments: string,
  bind: unknown[],
): D1PreparedStatement {
  return env.DB.prepare(`DELETE FROM image_grants WHERE document_id IN (${doomedDocuments})`).bind(
    ...bind,
  );
}

// ---------- Readers ---------------------------------------------------

// The byte endpoint's share check, its D1 half: document `documentId` may serve image `imageId`. That the
// document places it (a tab-scoped visitor's tab only) is the other half, asked of the document itself
// (db/image-refs.ts documentPlacesImage). One indexed query.
export async function documentMayServeImage(
  env: Env,
  documentId: string,
  imageId: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 AS present
       FROM documents d
       JOIN media_images i ON i.id = ?1
      WHERE d.id = ?2
        AND ${servesSql('?3')}
      LIMIT 1`,
  )
    .bind(imageId, documentId, Date.now())
    .first<{ present: number }>();
  return row !== null;
}

// The server renderer's filter: of `ids` (read from a tab of `documentId`), the
// ones the document may serve. One query for the whole tab.
export async function servableImageIds(
  env: Env,
  documentId: string,
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await env.DB.prepare(
    `SELECT i.id AS id
       FROM documents d
       JOIN media_images i ON i.id IN (SELECT value FROM json_each(?2))
      WHERE d.id = ?1
        AND ${servesSql('?3')}`,
  )
    .bind(documentId, JSON.stringify(ids), Date.now())
    .all<{ id: string }>();
  return new Set(rows.results.map((r) => r.id));
}
