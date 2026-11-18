// A copy's pictures, vouched for by the plan it was copied from (docs/specs/026-plan/items.md "Images in use", "A copy
// is vouched for by its source"; liveworkspace/docs/specs/006-media/media.md "Unconfirmed references"; Work Tracker
// 1190). A copy holds its source's pictures from the moment it lands, but its own report to the media service can
// keep failing for longer than the source's release grace (image-release.ts). So the source notes what each copy holds
// as it hands the copy over (noteCopyClaim), and its next report sends those notes as the copy's unconfirmed
// references (pushCopyClaims), which the service keeps until the copy's own report lands. A note stays until the
// service has taken it, and the source never asks to release a picture a note still names (planStillHolds).

import {
  MEDIA_REFS_PER_DOCUMENT_MAX as MEDIA_REFS_PER_PROJECT_MAX,
  MEDIA_REFS_SYNC_MAX,
} from '@liveworkspace/media';
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
// more for one plan, and the copy's own report sends nothing past it either (image-refs.ts pushImageRefs).
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
      .bind(planId, copyId, JSON.stringify(images.slice(0, MEDIA_REFS_PER_PROJECT_MAX)), now),
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

// A plan made from a plan file vouches for itself (items.md "A plan file vouches for itself", Work Tracker 1254): it
// can name another plan's pictures, but has no source to note them, so before its content lands (project-file.ts
// importProjectFile) the import sends what its first report will send as its own unconfirmed references. A file
// brings no grants, so that is its cards' Attachments alone (placedImagesSql with no grant). Answers whether it sent
// one. Throws when the service refuses, so nothing lands and the import is tried again. Without the service, or with
// no picture, there is nothing to say.
// The service refused an import's claim: nothing landed, and the import can be tried again.
export class ImportClaimRefused extends Error {
  constructor(status: number) {
    super(`media import claim failed: ${status}`);
    this.name = 'ImportClaimRefused';
  }
}

export async function claimImportedImages(
  env: Pick<PlanEnv, 'MEDIA_KEY' | 'MEDIA_URL'>,
  planId: string,
  items: readonly Record<string, unknown>[],
): Promise<boolean> {
  const media = mediaClient(env);
  if (!media) return false;
  const images = attachedImageIds(items);
  if (images.length === 0) return false;
  const answer = await media.syncRefs({
    documents: [],
    pending: [{ document: planId, images: images.slice(0, MEDIA_REFS_PER_PROJECT_MAX) }],
  });
  if (!answer.ok) throw new ImportClaimRefused(answer.status);
  console.info('[media] import vouched for', { planId, images: images.length });
  return true;
}

// The picture ids card rows' Attachments hold, sorted and unique, read as placedImagesSql reads them
// (json_each over `$.attachments`, each entry's `id` when it is text). An object of entries counts its values, as
// json_each walks them; anything unreadable holds none. Linear in the rows' text.
export function attachedImageIds(items: readonly Record<string, unknown>[]): string[] {
  const ids = new Set<string>();
  for (const row of items) {
    const text = row.fields;
    if (typeof text !== 'string' || !text.includes('"attachments"')) continue;
    let fields: unknown;
    try {
      fields = JSON.parse(text);
    } catch {
      continue;
    }
    const list = (fields as { attachments?: unknown } | null)?.attachments;
    if (typeof list !== 'object' || list === null) continue;
    for (const entry of Object.values(list)) {
      const id = (entry as { id?: unknown } | null)?.id;
      if (typeof id === 'string') ids.add(id);
    }
  }
  return [...ids].sort();
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
