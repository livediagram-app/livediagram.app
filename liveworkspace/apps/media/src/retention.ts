// The daily unused-image sweep (liveworkspace/docs/specs/006-media/media.md "Retention"). An image goes once it is old
// enough and no document in any app places it. It keeps bytes whenever in doubt: it waits until every
// app that could be placing an image has reported its documents, a tripwire slows a run that would reap a
// suspicious share, and each page re-checks the references at the moment it deletes.
//
// An image claimed at upload (images.document) is vouched for by its own app document by document: it is
// unplaced there only because its document reported a set without it. So it waits only for the other keyed
// apps. An unclaimed one waits for every keyed app, its own included.

import { SWEEP_PAGE, SWEEP_TRIPWIRE_MIN, SWEEP_TRIPWIRE_RATIO } from './config';
import { keyedApps, type Env } from './env';
import { pendingApps } from './refs';

// ?1 is the JSON list of keyed apps that have not reported complete (at most one when this runs).
const SWEEPABLE = `NOT EXISTS (SELECT 1 FROM refs r WHERE r.image_id = images.id)
  AND (json_array_length(?1) = 0
       OR (images.document IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM json_each(?1) p WHERE p.value != images.app)))`;

export function sweepTripped(old: number, unused: number): boolean {
  return unused > SWEEP_TRIPWIRE_MIN && unused / old > SWEEP_TRIPWIRE_RATIO;
}

// Deletes the images older than `cutoff` that no document places. Returns how many went.
export async function sweepUnusedImages(env: Env, cutoff: number): Promise<number> {
  const bucket = env.MEDIA;
  if (!bucket) return 0;
  const keyed = keyedApps(env);
  const pending = await pendingApps(env, keyed);
  if (keyed.length === 0 || pending.length > 1) {
    console.log('[media] sweep paused: not every app has reported its documents yet');
    return 0;
  }
  const waiting = JSON.stringify(pending);
  const counts = await env.MEDIA_DB.prepare(
    `SELECT COUNT(*) AS old, COALESCE(SUM(${SWEEPABLE}), 0) AS unused
       FROM images WHERE created_at < ?2`,
  )
    .bind(waiting, cutoff)
    .first<{ old: number; unused: number }>();
  const old = counts?.old ?? 0;
  const unused = counts?.unused ?? 0;
  if (unused === 0) return 0;

  if (sweepTripped(old, unused)) {
    console.error(
      `[media] sweep tripwire: ${unused} of ${old} old images unplaced; deleting at most ${SWEEP_PAGE}, oldest first`,
    );
    const page = await env.MEDIA_DB.prepare(
      `SELECT id FROM images WHERE created_at < ?2 AND ${SWEEPABLE}
        ORDER BY created_at, id LIMIT ?3`,
    )
      .bind(waiting, cutoff, SWEEP_PAGE)
      .all<{ id: string }>();
    return reap(
      env,
      bucket,
      waiting,
      page.results.map((r) => r.id),
    );
  }

  let deleted = 0;
  let after = '';
  for (;;) {
    const page = await env.MEDIA_DB.prepare(
      `SELECT id FROM images WHERE created_at < ?2 AND id > ?3 AND ${SWEEPABLE}
        ORDER BY id LIMIT ?4`,
    )
      .bind(waiting, cutoff, after, SWEEP_PAGE)
      .all<{ id: string }>();
    const ids = page.results.map((r) => r.id);
    if (ids.length === 0) break;
    after = ids[ids.length - 1]!;
    deleted += await reap(env, bucket, waiting, ids);
    if (ids.length < SWEEP_PAGE) break;
  }
  return deleted;
}

// The rows of these ids still sweepable at this instant, then their bytes. Rows first: if the R2 delete
// fails the bytes stay with no row (storage kept, never a broken picture).
async function reap(env: Env, bucket: R2Bucket, waiting: string, ids: string[]): Promise<number> {
  const gone = await env.MEDIA_DB.prepare(
    `DELETE FROM images WHERE id IN (SELECT value FROM json_each(?2)) AND ${SWEEPABLE}
      RETURNING id`,
  )
    .bind(waiting, JSON.stringify(ids))
    .all<{ id: string }>();
  const goneIds = gone.results.map((r) => r.id);
  if (goneIds.length === 0) return 0;
  try {
    await bucket.delete(goneIds);
  } catch (err) {
    console.error('[media] sweep: R2 delete failed', goneIds, err);
  }
  return goneIds.length;
}
