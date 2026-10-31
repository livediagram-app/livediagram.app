// Which Image field pictures a plan may serve (docs/specs/026-plan/item-types.md "Image fields"), in the plan's own
// SQLite (plan-schema.ts `card_image_grants`). A grant is recorded when someone who may edit the plan's cards
// uploads a picture for it (routes/images.ts); the plan serves the picture while it holds that grant AND one of its
// cards holds the id as a field value. An id pasted into another plan, or carried there by a copy, serves nothing
// there until it is uploaded there again.

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

// LIKE's own characters in an id, escaped, so the prefilter matches the id's text and nothing wider.
const likeEscaped = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

// Whether the plan serves `imageId`: the grant first (a key lookup), then a card holding it. A text prefilter
// (LIKE on the id as its JSON string, quoted and escaped as a card's fields store it) skips every card whose fields
// never mention it before the exact check (a field whose value is the id itself, read from the JSON), and the first
// match ends the scan.
export function planServesImage(sql: Sql, planId: string, imageId: string): boolean {
  if (!imageId || imageId.length > IMAGE_ID_MAX) return false;
  const granted = sql
    .exec(
      'SELECT 1 FROM card_image_grants WHERE plan_id = ? AND image_id = ? LIMIT 1',
      planId,
      imageId,
    )
    .toArray();
  if (granted.length === 0) return false;
  return (
    sql
      .exec(
        `SELECT 1 FROM items, json_each(items.fields) AS f
          WHERE items.plan_id = ? AND items.fields LIKE ? ESCAPE '\\'
            AND f.type = 'text' AND f.value = ?
          LIMIT 1`,
        planId,
        `%${likeEscaped(JSON.stringify(imageId))}%`,
        imageId,
      )
      .toArray().length > 0
  );
}
