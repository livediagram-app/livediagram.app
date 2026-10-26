// The daily unused-image sweep (liveworkspace/docs/specs/006-media/media.md "Retention"). An image goes once it is old
// enough and no document in any app places it. It keeps bytes whenever in doubt: it waits until every
// app with a key has reported its documents, a tripwire slows a run that would reap a suspicious share,
// and each page re-checks the references at the moment it deletes.

import { SWEEP_PAGE, SWEEP_TRIPWIRE_MIN, SWEEP_TRIPWIRE_RATIO } from './config';
import { keyedApps, type Env } from './env';
import { refsComplete } from './refs';

const PLACED = 'EXISTS (SELECT 1 FROM refs r WHERE r.image_id = images.id)';

export function sweepTripped(old: number, unused: number): boolean {
  return unused > SWEEP_TRIPWIRE_MIN && unused / old > SWEEP_TRIPWIRE_RATIO;
}

// Deletes the images older than `cutoff` that no document places. Returns how many went.
export async function sweepUnusedImages(env: Env, cutoff: number): Promise<number> {
  const bucket = env.MEDIA;
  if (!bucket) return 0;
  if (!(await refsComplete(env, keyedApps(env)))) {
    console.log('[media] sweep paused: not every app has reported its documents yet');
    return 0;
  }
  const counts = await env.MEDIA_DB.prepare(
    `SELECT COUNT(*) AS old, COALESCE(SUM(NOT ${PLACED}), 0) AS unused
       FROM images WHERE created_at < ?`,
  )
    .bind(cutoff)
    .first<{ old: number; unused: number }>();
  const old = counts?.old ?? 0;
  const unused = counts?.unused ?? 0;
  if (unused === 0) return 0;

  if (sweepTripped(old, unused)) {
    console.error(
      `[media] sweep tripwire: ${unused} of ${old} old images unplaced; deleting at most ${SWEEP_PAGE}, oldest first`,
    );
    const page = await env.MEDIA_DB.prepare(
      `SELECT id FROM images WHERE created_at < ?1 AND NOT ${PLACED}
        ORDER BY created_at, id LIMIT ?2`,
    )
      .bind(cutoff, SWEEP_PAGE)
      .all<{ id: string }>();
    return reap(
      env,
      bucket,
      page.results.map((r) => r.id),
    );
  }

  let deleted = 0;
  let after = '';
  for (;;) {
    const page = await env.MEDIA_DB.prepare(
      `SELECT id FROM images WHERE created_at < ?1 AND id > ?2 AND NOT ${PLACED}
        ORDER BY id LIMIT ?3`,
    )
      .bind(cutoff, after, SWEEP_PAGE)
      .all<{ id: string }>();
    const ids = page.results.map((r) => r.id);
    if (ids.length === 0) break;
    after = ids[ids.length - 1]!;
    deleted += await reap(env, bucket, ids);
    if (ids.length < SWEEP_PAGE) break;
  }
  return deleted;
}

// The rows of these ids still unplaced at this instant, then their bytes. Rows first: if the R2 delete
// fails the bytes stay with no row (storage kept, never a broken picture).
async function reap(env: Env, bucket: R2Bucket, ids: string[]): Promise<number> {
  const gone = await env.MEDIA_DB.prepare(
    `DELETE FROM images WHERE id IN (SELECT value FROM json_each(?)) AND NOT ${PLACED}
      RETURNING id`,
  )
    .bind(JSON.stringify(ids))
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
