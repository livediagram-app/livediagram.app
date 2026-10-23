// image_grants: which designs may serve an image their owner does not own
// (docs/specs/009-elements/images.md, "Placement grants").
//
// A reference alone (image_refs) does not let a design serve an image: an id
// pasted into an unrelated design must not keep the bytes reachable after its
// reader loses access to the original. A design serves image X when X's
// owner owns the design, or the design holds a grant for X. Grants are
// written only at trusted moments, in the same batch as the body they follow:
// when X's owner is tied to the design as the body is saved, and when a copy
// carries an image its source could serve.

import type { Env } from '../types';
import { visitLinkSql } from './visit-link';
import { imageRefIndexDesignStatement, isImageRefIndexComplete } from './image-refs';

// The one predicate every reader shares: design `d` (aliased) may serve image
// `i` (aliased). Owner match first, so the common case never touches the
// grants table; the grant lookup is a primary-key probe.
const SERVES = `(i.owner_id = d.owner_id
   OR EXISTS (SELECT 1 FROM image_grants g WHERE g.design_id = d.id AND g.image_id = i.id))`;

// ---------- Writers ---------------------------------------------------

// A design changing owner (a member leaving a team hands their work on; a team design moved into someone's
// own library): the images its owner placed served only because they owned it, so they stop serving the moment
// someone else does. Grant each one first, in the same batch as the owner change, to the designs `where`
// picks (a SQL condition on `d`, its params bound from ?2 on). A grant outlives the membership
// (docs/specs/009-elements/images.md "Placement grants").
export function imageGrantOwnerChangeStatement(
  env: Env,
  where: string,
  params: readonly (string | number | null)[],
  now: number,
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT OR IGNORE INTO image_grants (design_id, image_id, created_at)
     SELECT DISTINCT d.id, i.id, ?1
       FROM designs d
       JOIN design_tabs dt ON dt.design_id = d.id
       JOIN image_refs r ON r.tab_id = dt.tab_id
       JOIN images i ON i.id = r.image_id AND i.owner_id = d.owner_id
      WHERE ${where}`,
  ).bind(now, ...params);
}

// For each image a saved body places, in each design holding the tab: grant it
// when the image's owner is entitled to place it there right now, as a joined
// member of the design's team, or a collaborator who may add content whose visit's
// link is still live: an edit collaborator, or a Participant
// (docs/specs/013-workspace/share-roles.md), who places images too. A revoked or
// expired link earns nothing, so an id pasted after access went cannot be laundered
// into a grant. The writer's identity is not needed. An image the design's owner
// owns needs no row.
export function imageGrantPlacementStatements(
  env: Env,
  tabId: string,
  ids: string[],
  now: number,
): D1PreparedStatement[] {
  if (ids.length === 0) return [];
  return [
    env.DB.prepare(
      `INSERT OR IGNORE INTO image_grants (design_id, image_id, created_at)
       SELECT d.id, i.id, ?3
         FROM design_tabs dt
         JOIN designs d ON d.id = dt.design_id
         JOIN images i ON i.id IN (SELECT value FROM json_each(?2))
        WHERE dt.tab_id = ?1
          AND i.owner_id <> d.owner_id
          AND ((d.team_id IS NOT NULL AND EXISTS (
                  SELECT 1 FROM team_members m
                   WHERE m.team_id = d.team_id AND m.user_id = i.owner_id AND m.status = 'joined'))
               OR EXISTS (
                  SELECT 1 FROM shared_with s
                   WHERE s.owner_id = i.owner_id AND s.design_id = d.id
                     AND (s.role = 'edit' OR s.level = 'participate')
                     AND d.shareable = 1 AND ${visitLinkSql('?3')} IS NOT NULL))`,
    ).bind(tabId, JSON.stringify(ids), now),
  ];
}

// A copy carries every image of the copied bodies that its source may serve,
// as a grant on the new design. The copier's own images need none (they own
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
      `INSERT OR IGNORE INTO image_grants (design_id, image_id, created_at)
       SELECT ?2, i.id, ?4
         FROM designs d
         JOIN images i ON i.id IN (SELECT value FROM json_each(?3))
        WHERE d.id = ?1
          AND ${SERVES}`,
    ).bind(sourceId, targetId, JSON.stringify(ids), now),
  ];
}

// A tab linked into another design ("Add a Tab to Another Design") carries
// what it already shows: every image the tab places that some design already
// holding it may serve, granted to the new holder. Nothing is laundered: the
// grant is derived from an existing holder's right to serve.
export function imageGrantLinkStatement(
  env: Env,
  targetId: string,
  tabId: string,
  now: number,
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT OR IGNORE INTO image_grants (design_id, image_id, created_at)
     SELECT DISTINCT ?1, i.id, ?3
       FROM image_refs r
       JOIN images i ON i.id = r.image_id
       JOIN design_tabs dt ON dt.tab_id = r.tab_id AND dt.design_id <> ?1
       JOIN designs d ON d.id = dt.design_id
      WHERE r.tab_id = ?2
        AND ${SERVES}`,
  ).bind(targetId, tabId, now);
}

// Design removal: the grants go with the design (no foreign key, like image_refs).
export function imageGrantRemovalStatement(
  env: Env,
  doomedDesigns: string,
  bind: unknown[],
): D1PreparedStatement {
  return env.DB.prepare(`DELETE FROM image_grants WHERE design_id IN (${doomedDesigns})`).bind(
    ...bind,
  );
}

// ---------- Readers ---------------------------------------------------

// The byte endpoint's share check: design `designId` places image `imageId`
// (a tab-scoped visitor's tab only) AND may serve it. Answered from the
// reference index, never a tab body; while the index backfill is incomplete,
// the design's own tabs are indexed first. One indexed query.
export async function designServesImage(
  env: Env,
  designId: string,
  imageId: string,
  onlyTabId: string | null = null,
): Promise<boolean> {
  if (!(await isImageRefIndexComplete(env))) {
    await imageRefIndexDesignStatement(env, designId).run();
  }
  const row = await env.DB.prepare(
    `SELECT 1 AS present
       FROM design_tabs dt
       JOIN image_refs r ON r.tab_id = dt.tab_id AND r.image_id = ?1
       JOIN designs d ON d.id = dt.design_id
       JOIN images i ON i.id = r.image_id
      WHERE dt.design_id = ?2${onlyTabId === null ? '' : ' AND dt.tab_id = ?3'}
        AND ${SERVES}
      LIMIT 1`,
  )
    .bind(...(onlyTabId === null ? [imageId, designId] : [imageId, designId, onlyTabId]))
    .first<{ present: number }>();
  return row !== null;
}

// The server renderer's filter: of `ids` (read from a tab of `designId`), the
// ones the design may serve. One query for the whole tab.
export async function servableImageIds(
  env: Env,
  designId: string,
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await env.DB.prepare(
    `SELECT i.id AS id
       FROM designs d
       JOIN images i ON i.id IN (SELECT value FROM json_each(?2))
      WHERE d.id = ?1
        AND ${SERVES}`,
  )
    .bind(designId, JSON.stringify(ids))
    .all<{ id: string }>();
  return new Set(rows.results.map((r) => r.id));
}
