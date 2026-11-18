// A copy's pictures, vouched for by the plan it was copied from (docs/specs/026-plan/items.md "Images in use", "A copy
// is vouched for by its source"; liveworkspace/docs/specs/006-media/media.md "Unconfirmed references"; Work Tracker
// 1190). A copy holds its source's pictures from the moment it lands, but its own report to the media service can
// keep failing for longer than the source's release grace (image-release.ts). So the source notes what each copy holds
// as it hands the copy over (noteCopyClaim), and its next report sends those notes as the copy's unconfirmed
// references (pushCopyClaims), which the service keeps until the copy's own report lands. A note stays until the
// service has taken it, and the source never asks to release a picture a note still names (planStillHolds).

import { MEDIA_REFS_PER_DOCUMENT_MAX, MEDIA_REFS_SYNC_MAX } from '@liveworkspace/media';
import { mediaClient } from '../media';
import type { PlanEnv } from '../types';
import { IMAGES_OUTBOX_KIND, placedImagesSql } from './image-refs';

// Its own schema step (plan-schema.ts V37). IF NOT EXISTS, so it runs again harmlessly.
export const COPY_IMAGE_CLAIMS_SCHEMA = `
CREATE TABLE IF NOT EXISTS copy_image_claims (
  plan_id  TEXT    NOT NULL,
  copy_id  TEXT    NOT NULL,
  images   TEXT    NOT NULL,
  noted_at INTEGER NOT NULL,
  PRIMARY KEY (plan_id, copy_id)
) WITHOUT ROWID;
`;

// What a copy's media_refs row says before its first report lands (plan-copy.ts importPlanCopy): no real set (a JSON
// list) equals it, so the copy's first report always sends, and its purge always tells the service it holds none.
export const UNCONFIRMED_REFS = '"unconfirmed"';

// The pictures a copy takes: what the copied cards hold, as the copy will report them (image-refs.ts). `itemIds` null
// is every card, a list a tab copy's cards.
export async function copiedPlacedImages(
  env: Pick<PlanEnv, 'PLAN_DB'>,
  planId: string,
  itemIds: readonly string[] | null,
): Promise<string[]> {
  const scoped = itemIds !== null;
  const rows = await env.PLAN_DB.prepare(placedImagesSql(scoped))
    .bind(...(scoped ? [planId, JSON.stringify(itemIds)] : [planId]))
    .all<{ id: string }>();
  return rows.results.map((r) => r.id);
}

// The source's note of what copy `copyId` holds, with its `images` report queued so the next drain sends it. Nothing
// when the copy holds no picture. A copy past what one report carries is noted at that cap: the service can take no
// more for one document, and the copy's own report sends nothing past it either (image-refs.ts pushImageRefs).
export async function noteCopyClaim(
  env: Pick<PlanEnv, 'PLAN_DB'>,
  planId: string,
  copyId: string,
  images: readonly string[],
  now: number,
): Promise<boolean> {
  if (images.length === 0 || copyId === planId) return false;
  const db = env.PLAN_DB;
  await db.batch([
    db
      .prepare(
        `INSERT INTO copy_image_claims (plan_id, copy_id, images, noted_at) VALUES (?, ?, ?, ?)
           ON CONFLICT (plan_id, copy_id) DO UPDATE SET images = excluded.images, noted_at = excluded.noted_at`,
      )
      .bind(planId, copyId, JSON.stringify(images.slice(0, MEDIA_REFS_PER_DOCUMENT_MAX)), now),
    db
      .prepare('DELETE FROM outbox WHERE plan_id = ? AND kind = ? AND key = ?')
      .bind(planId, IMAGES_OUTBOX_KIND, ''),
    db
      .prepare('INSERT INTO outbox (plan_id, kind, key) VALUES (?, ?, ?)')
      .bind(planId, IMAGES_OUTBOX_KIND, ''),
  ]);
  console.info('[media] copy noted', { planId, images: images.length });
  return true;
}

type ClaimRow = { copy_id: string; images: string; noted_at: number };

// Send every note as its copy's unconfirmed references, MEDIA_REFS_SYNC_MAX copies a sync, each note dropped once its
// sync is answered, and only while unchanged (a copy noted again meanwhile is sent again). Answers how many syncs it
// sent. Throws when the service refuses, so the drain keeps the `images` key and tries again; the notes stay. Without
// the service there is nobody to tell, and nothing is ever released either (image-release.ts): the notes stay.
export async function pushCopyClaims(env: PlanEnv, planId: string): Promise<number> {
  const media = mediaClient(env);
  if (!media) return 0;
  const { results } = await env.PLAN_DB.prepare(
    'SELECT copy_id, images, noted_at FROM copy_image_claims WHERE plan_id = ? ORDER BY copy_id',
  )
    .bind(planId)
    .all<ClaimRow>();
  let sent = 0;
  for (let i = 0; i < results.length; i += MEDIA_REFS_SYNC_MAX) {
    const page = results.slice(i, i + MEDIA_REFS_SYNC_MAX);
    const pending = page.map((row) => ({ document: row.copy_id, images: idsOf(row.images) }));
    const answer = await media.syncRefs({ documents: [], pending });
    if (!answer.ok) throw new Error(`media copy claims sync failed: ${answer.status}`);
    await env.PLAN_DB.prepare(
      `DELETE FROM copy_image_claims
        WHERE plan_id = ? AND (copy_id, images, noted_at) IN (
          SELECT value ->> '$.copy_id', value ->> '$.images', value ->> '$.noted_at' FROM json_each(?))`,
    )
      .bind(planId, JSON.stringify(page))
      .run();
    sent++;
  }
  if (sent > 0) console.info('[media] copies vouched for', { planId, copies: results.length });
  return sent;
}

// A note's ids; a row that is not a list of ids (never written so) vouches for none.
function idsOf(images: string): string[] {
  try {
    const parsed = JSON.parse(images) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

// Every note still unsent, as pushCopyClaims sends them: what a purge of the source passes on (image-refs.ts
// forgetImageRefs). The room's own storage holds one plan, so every row is its. Empty for a plan with none, or a
// schema before the table.
export function unsentCopyClaims(sql: {
  exec(query: string): { toArray(): Record<string, unknown>[] };
}): { document: string; images: string[] }[] {
  try {
    return sql
      .exec('SELECT copy_id, images FROM copy_image_claims ORDER BY copy_id')
      .toArray()
      .map((row) => ({ document: String(row.copy_id), images: idsOf(String(row.images)) }));
  } catch {
    return [];
  }
}
