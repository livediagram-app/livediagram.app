// image_grants: which images a design may serve that its owner does not own
// (docs/specs/009-elements/images.md, "Placement grants"). In the design's own SQLite (design-room/design-schema.ts).
//
// Whose an image is comes from media_images (src/media.ts): the images live in liveworkspace's media service, and
// the design asks it about each image it places once (learnMediaOwners); an image it has not met joins nothing, so
// it serves nowhere.
//
// A reference alone (image_refs) does not let a design serve an image: an id pasted into an unrelated design must
// not keep the bytes reachable after its reader loses access to the original. A design serves image X when X's
// owner owns the design, or the design holds a grant for X. Grants are written only at trusted moments, in the
// same transaction as the body they follow: when X's owner may add content to the design as the body is saved,
// and when a copy carries an image its source could serve.

import type { DesignEnv } from '../types';

// The one predicate every reader shares: the design `d` (aliased) may serve image `i` (aliased). Owner match
// first, so the common case never touches the grants table; the grant lookup is a primary-key probe.
const SERVES = `(i.owner_id = d.owner_id
   OR EXISTS (SELECT 1 FROM image_grants g WHERE g.design_id = d.id AND g.image_id = i.id))`;

// ---------- Who may add content ------------------------------------------------------------------------------

// Someone whose index grant lets them add content (edit, or participate: a Participant places images too,
// docs/specs/013-workspace/share-roles.md) reached the design: they stay entitled until that grant lapses. A
// later grant only moves it on, and the same grant again writes nothing. Called before the request it came with
// runs, so its save finds it.
export async function noteEntitled(env: DesignEnv, personId: string, until: number): Promise<void> {
  await env.DESIGN_DB.prepare(
    `INSERT INTO entitled (person_id, until) VALUES (?, ?)
     ON CONFLICT (person_id) DO UPDATE SET until = excluded.until WHERE excluded.until > entitled.until`,
  )
    .bind(personId, until)
    .run();
}

// ---------- Writers ------------------------------------------------------------------------------------------

// For each image a saved body places, in the design holding the tab: grant it when the image's owner may add
// content to the design right now (their grant has reached it and not lapsed). A revoked or expired link earns
// nothing, so an id pasted after access went cannot be laundered into a grant. The writer's identity is not
// needed. An image the design's owner owns needs no row.
export function imageGrantPlacementStatements(
  env: DesignEnv,
  tabId: string,
  ids: string[],
  now: number,
): D1PreparedStatement[] {
  if (ids.length === 0) return [];
  return [
    env.DESIGN_DB.prepare(
      `INSERT OR IGNORE INTO image_grants (design_id, image_id, created_at)
       SELECT d.id, i.id, ?3
         FROM design_tabs dt
         JOIN design d ON d.id = dt.design_id
         JOIN media_images i ON i.id IN (SELECT value FROM json_each(?2))
         JOIN entitled e ON e.person_id = i.owner_id AND e.until > ?3
        WHERE dt.tab_id = ?1
          AND i.owner_id <> ''
          AND i.owner_id <> d.owner_id`,
    ).bind(tabId, JSON.stringify(ids), now),
  ];
}

// A copy carries every image of the copied bodies that its source may serve, as a grant on the new design
// (design-content.ts): the source's side, the ids it may serve.
export async function servableImageIds(
  env: DesignEnv,
  designId: string,
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await env.DESIGN_DB.prepare(
    `SELECT i.id AS id
       FROM design d
       JOIN media_images i ON i.id IN (SELECT value FROM json_each(?2))
      WHERE d.id = ?1
        AND ${SERVES}`,
  )
    .bind(designId, JSON.stringify(ids))
    .all<{ id: string }>();
  return new Set(rows.results.map((r) => r.id));
}

// The copy's side: the grants the source sent. The copier's own images need none, and one more grant than
// needed serves nothing the copy's owner could not already.
export function imageGrantImportStatement(
  env: DesignEnv,
  designId: string,
  ids: readonly string[],
  now: number,
): D1PreparedStatement {
  return env.DESIGN_DB.prepare(
    `INSERT OR IGNORE INTO image_grants (design_id, image_id, created_at)
     SELECT ?1, value, ?3 FROM json_each(?2)`,
  ).bind(designId, JSON.stringify(ids), now);
}

// ---------- Readers ------------------------------------------------------------------------------------------

// The byte endpoint's share check: the design places image `imageId` (a tab-scoped visitor's tab only) AND may
// serve it. Answered from the reference index, never a tab body. One indexed query.
export async function designServesImage(
  env: DesignEnv,
  designId: string,
  imageId: string,
  onlyTabId: string | null = null,
): Promise<boolean> {
  const row = await env.DESIGN_DB.prepare(
    `SELECT 1 AS present
       FROM design_tabs dt
       JOIN image_refs r ON r.tab_id = dt.tab_id AND r.image_id = ?1
       JOIN design d ON d.id = dt.design_id
       JOIN media_images i ON i.id = r.image_id
      WHERE dt.design_id = ?2${onlyTabId === null ? '' : ' AND dt.tab_id = ?3'}
        AND ${SERVES}
      LIMIT 1`,
  )
    .bind(...(onlyTabId === null ? [imageId, designId] : [imageId, designId, onlyTabId]))
    .first<{ present: number }>();
  return row !== null;
}
