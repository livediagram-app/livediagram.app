// Which Image field and Attachments pictures a plan may serve (docs/specs/026-plan/item-types.md "Image fields",
// items.md "Attachments"), in the plan's own
// SQLite (plan-schema.ts `card_image_grants`). A grant is recorded when someone who may edit the plan's cards
// uploads a picture for it (routes/images.ts); the plan serves the picture while it holds that grant AND one of its
// cards holds the id as a field value. An id pasted into another plan serves nothing there until it is uploaded there
// again. A copy carries the source's grant for each picture its copied cards hold (copiedImageGrants, owner
// 2026-11-12, Work Item 215), so a copy shows its cards' pictures as the source does; a Drive file and the migration
// door carry none.

import type { PlanEnv } from '../types';
import { placedImagesSql } from './image-refs';

type Sql = {
  exec(query: string, ...bindings: unknown[]): { toArray(): Record<string, unknown>[] };
};

// The most grants one plan keeps, oldest dropped first as a new one comes. Well above ITEMS_MAX (2,000 cards) with
// a picture or two each and their replacements; a grant is about 100 bytes, so the table stays under a megabyte.
// Recording a grant again (the same picture uploaded again) makes it the newest.
export const IMAGE_GRANTS_MAX = 5_000;

// The longest image id a grant or a check takes: the service's ids are UUIDs, so anything longer is not one.
export const IMAGE_ID_MAX = 200;

export function recordImageGrant(sql: Sql, planId: string, imageId: string, now: number): void {
  sql.exec(
    `INSERT INTO card_image_grants (plan_id, image_id, created_at) VALUES (?, ?, ?)
       ON CONFLICT (plan_id, image_id) DO UPDATE SET created_at = excluded.created_at`,
    planId,
    imageId,
    now,
  );
  const [counted] = sql
    .exec('SELECT COUNT(*) AS n FROM card_image_grants WHERE plan_id = ?', planId)
    .toArray();
  const count = Number(counted!.n);
  if (count <= IMAGE_GRANTS_MAX) return;
  sql.exec(
    `DELETE FROM card_image_grants WHERE plan_id = ? AND image_id IN (
       SELECT image_id FROM card_image_grants WHERE plan_id = ? ORDER BY created_at, image_id LIMIT ?)`,
    planId,
    planId,
    count - IMAGE_GRANTS_MAX,
  );
}

// Which of `imageIds` the plan holds a grant for, in the order asked, each once: what an agent may place on a card
// (docs/specs/026-plan/item-types.md "Image fields", "Agents"). One query, the ids as one JSON parameter.
export function planGrantedImages(sql: Sql, planId: string, imageIds: readonly string[]): string[] {
  const asked = [...new Set(imageIds)].filter((id) => id && id.length <= IMAGE_ID_MAX);
  if (asked.length === 0) return [];
  const held = new Set(
    sql
      .exec(
        `SELECT image_id FROM card_image_grants
          WHERE plan_id = ? AND image_id IN (SELECT value FROM json_each(?))`,
        planId,
        JSON.stringify(asked),
      )
      .toArray()
      .map((r) => r.image_id as string),
  );
  return asked.filter((id) => held.has(id));
}

// The grants a copy carries (docs/specs/026-plan/item-types.md "Image fields", Copies): each picture the copied cards
// hold (an Attachments entry, an Image field value, an id in a Several Images list), kept to the ones this plan holds
// a grant for, so a copy never serves a picture its source could not. `itemIds` null takes every card, a list only
// those (a tab-scoped copy's). One query, the ids as one JSON parameter; nothing read when the plan holds no grant.
export async function copiedImageGrants(
  env: PlanEnv,
  planId: string,
  itemIds: readonly string[] | null,
): Promise<string[]> {
  const scoped = itemIds !== null;
  const rows = await env.PLAN_DB.prepare(
    `SELECT id FROM (${placedImagesSql(scoped)})
      WHERE id IN (SELECT image_id FROM card_image_grants WHERE plan_id = ?1)`,
  )
    .bind(...(scoped ? [planId, JSON.stringify(itemIds)] : [planId]))
    .all<{ id: string }>();
  return rows.results.map((r) => r.id);
}

// Where a copy's grants land, in its import's transaction (plan-copy.ts importPlanCopy), before its cards, so their
// insert queues the copy's `images` report (image-refs.ts). One statement, the ids as one JSON parameter; an id past
// IMAGE_ID_MAX is dropped and at most IMAGE_GRANTS_MAX land. Null with nothing to write.
export function copiedGrantsStatement(
  env: PlanEnv,
  planId: string,
  imageIds: readonly string[] | undefined,
  now: number,
): D1PreparedStatement | null {
  const ids = [...new Set(imageIds ?? [])]
    .filter((id) => typeof id === 'string' && id.length > 0 && id.length <= IMAGE_ID_MAX)
    .slice(0, IMAGE_GRANTS_MAX);
  if (ids.length === 0) return null;
  return env.PLAN_DB.prepare(
    `INSERT INTO card_image_grants (plan_id, image_id, created_at)
     SELECT ?1, value, ?2 FROM json_each(?3) WHERE true
       ON CONFLICT (plan_id, image_id) DO NOTHING`,
  ).bind(planId, now, JSON.stringify(ids));
}

// Whether the plan serves `imageId`: the grant first (a key lookup), then a card holding it. A text prefilter
// (`instr` on the id as its JSON string, quoted and escaped as a card's fields store it) skips every card whose fields
// never mention it before the exact check (a field whose value is the id itself, a list holding it, as a Several
// Images field's, or an Attachments entry's id, read from the JSON; `json_each` reads only an array's value, through
// the CASE, so a text value is never parsed as JSON), and the first
// match ends the scan. `onlyCards` confines the match to those cards (a tab-scoped reader's: the cards its tab
// shows, docs/specs/026-plan/items.md "Who sees the bytes"); null leaves every card of the plan in. The ids go in as
// one JSON parameter, so a tab of many Plan cards never meets a bound-parameter cap.
export function planServesImage(
  sql: Sql,
  planId: string,
  imageId: string,
  onlyCards: readonly string[] | null = null,
): boolean {
  if (!imageId || imageId.length > IMAGE_ID_MAX) return false;
  if (onlyCards !== null && onlyCards.length === 0) return false;
  const granted = sql
    .exec(
      'SELECT 1 FROM card_image_grants WHERE plan_id = ? AND image_id = ? LIMIT 1',
      planId,
      imageId,
    )
    .toArray();
  if (granted.length === 0) return false;
  // `instr`, never a bound LIKE: Durable Object SQLite refuses a LIKE pattern over 50 bytes, and an id may be 200.
  const needle = JSON.stringify(imageId);
  const scoped = onlyCards === null ? '' : 'AND items.id IN (SELECT value FROM json_each(?))';
  const bindings = onlyCards === null ? [] : [JSON.stringify(onlyCards)];
  return (
    sql
      .exec(
        `SELECT 1 FROM items, json_each(items.fields) AS f
          WHERE items.plan_id = ? ${scoped} AND instr(items.fields, ?) > 0
            AND ((f.type = 'text' AND f.value = ?)
              OR (f.type = 'array' AND EXISTS (
                    SELECT 1 FROM json_each(CASE WHEN f.type = 'array' THEN f.value ELSE '[]' END) AS a
                     WHERE (a.type = 'text' AND a.value = ?)
                        OR (f.key = 'attachments'
                            AND CASE WHEN a.type = 'object' THEN json_extract(a.value, '$.id') END = ?))))
          LIMIT 1`,
        planId,
        ...bindings,
        needle,
        imageId,
        imageId,
        imageId,
      )
      .toArray().length > 0
  );
}
