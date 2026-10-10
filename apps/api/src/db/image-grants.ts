// image_grants: which documents may serve an image their owner does not own
// (docs/specs/009-elements/images.md, "Placement grants").
//
// A reference alone (image_refs) does not let a document serve an image: an id
// pasted into an unrelated document must not keep the bytes reachable after its
// reader loses access to the original. A document serves image X when X's
// owner owns the document, or the document holds a grant for X. Grants are
// written only at trusted moments, in the same batch as the body they follow:
// when X's owner is tied to the document as the body is saved, and when a copy
// carries an image its source could serve.

import type { Env } from '../types';
import { visitLinkSql } from './shared';
import { imageRefIndexDocumentStatement, isImageRefIndexComplete } from './image-refs';

// The one predicate every reader shares: document `d` (aliased) may serve image
// `i` (aliased). Owner match first, so the common case never touches the
// grants table; the grant lookup is a primary-key probe.
const SERVES = `(i.owner_id = d.owner_id
   OR EXISTS (SELECT 1 FROM image_grants g WHERE g.document_id = d.id AND g.image_id = i.id))`;

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
       JOIN document_tabs dt ON dt.document_id = d.id
       JOIN image_refs r ON r.tab_id = dt.tab_id
       JOIN images i ON i.id = r.image_id AND i.owner_id = d.owner_id
      WHERE ${where}`,
  ).bind(now, ...params);
}

// For each image a saved body places, in each document holding the tab: grant it
// when the image's owner is entitled to place it there right now, as a joined
// member of the document's team or an edit collaborator whose visit's link is still
// live (a revoked or expired link earns nothing, so an id pasted after access went
// cannot be laundered into a grant). The writer's identity is not needed. An image
// the document's owner owns needs no row.
export function imageGrantPlacementStatements(
  env: Env,
  tabId: string,
  ids: string[],
  now: number,
): D1PreparedStatement[] {
  if (ids.length === 0) return [];
  return [
    env.DB.prepare(
      `INSERT OR IGNORE INTO image_grants (document_id, image_id, created_at)
       SELECT d.id, i.id, ?3
         FROM document_tabs dt
         JOIN documents d ON d.id = dt.document_id
         JOIN images i ON i.id IN (SELECT value FROM json_each(?2))
        WHERE dt.tab_id = ?1
          AND i.owner_id <> d.owner_id
          AND ((d.team_id IS NOT NULL AND EXISTS (
                  SELECT 1 FROM team_members m
                   WHERE m.team_id = d.team_id AND m.user_id = i.owner_id AND m.status = 'joined'))
               OR EXISTS (
                  SELECT 1 FROM shared_with s
                   WHERE s.owner_id = i.owner_id AND s.document_id = d.id AND s.role = 'edit'
                     AND d.shareable = 1 AND ${visitLinkSql('?3')} IS NOT NULL))`,
    ).bind(tabId, JSON.stringify(ids), now),
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
         JOIN images i ON i.id IN (SELECT value FROM json_each(?3))
        WHERE d.id = ?1
          AND ${SERVES}`,
    ).bind(sourceId, targetId, JSON.stringify(ids), now),
  ];
}

// A tab linked into another document ("Add a Tab to Another Document") carries
// what it already shows: every image the tab places that some document already
// holding it may serve, granted to the new holder. Nothing is laundered: the
// grant is derived from an existing holder's right to serve.
export function imageGrantLinkStatement(
  env: Env,
  targetId: string,
  tabId: string,
  now: number,
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT OR IGNORE INTO image_grants (document_id, image_id, created_at)
     SELECT DISTINCT ?1, i.id, ?3
       FROM image_refs r
       JOIN images i ON i.id = r.image_id
       JOIN document_tabs dt ON dt.tab_id = r.tab_id AND dt.document_id <> ?1
       JOIN documents d ON d.id = dt.document_id
      WHERE r.tab_id = ?2
        AND ${SERVES}`,
  ).bind(targetId, tabId, now);
}

// Document removal: the grants go with the document (no foreign key, like image_refs).
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

// The byte endpoint's share check: document `documentId` places image `imageId`
// (a tab-scoped visitor's tab only) AND may serve it. Answered from the
// reference index, never a tab body; while the index backfill is incomplete,
// the document's own tabs are indexed first. One indexed query.
export async function documentServesImage(
  env: Env,
  documentId: string,
  imageId: string,
  onlyTabId: string | null = null,
): Promise<boolean> {
  if (!(await isImageRefIndexComplete(env))) {
    await imageRefIndexDocumentStatement(env, documentId).run();
  }
  const row = await env.DB.prepare(
    `SELECT 1 AS present
       FROM document_tabs dt
       JOIN image_refs r ON r.tab_id = dt.tab_id AND r.image_id = ?1
       JOIN documents d ON d.id = dt.document_id
       JOIN images i ON i.id = r.image_id
      WHERE dt.document_id = ?2${onlyTabId === null ? '' : ' AND dt.tab_id = ?3'}
        AND ${SERVES}
      LIMIT 1`,
  )
    .bind(...(onlyTabId === null ? [imageId, documentId] : [imageId, documentId, onlyTabId]))
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
       JOIN images i ON i.id IN (SELECT value FROM json_each(?2))
      WHERE d.id = ?1
        AND ${SERVES}`,
  )
    .bind(documentId, JSON.stringify(ids))
    .all<{ id: string }>();
  return new Set(rows.results.map((r) => r.id));
}
