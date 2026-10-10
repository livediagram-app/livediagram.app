// The daily unused-image sweep (docs/specs/009-elements/images.md, "Retention"),
// reading only the image reference index (db/image-refs.ts).

import type { Env } from '../types';
import { isImageRefIndexComplete } from './image-refs';

// Page size of the daily sweep: R2 delete() takes at most 1000 keys.
export const IMAGE_SWEEP_PAGE = 1000;

// The tripwire (docs/specs/009-elements/images.md "Retention"): a run that
// would reap more than this share of the old images, and more than this many,
// is slowed to IMAGE_SWEEP_TRIPPED_MAX deletions, oldest first, and logged as
// an error. A gap in the reference index looks exactly like that.
export const IMAGE_SWEEP_TRIPWIRE_RATIO = 0.5;
export const IMAGE_SWEEP_TRIPWIRE_MIN = 20;

// The most a tripped run deletes. Never zero: a tripwire that deleted nothing
// latched for good once unused images legitimately outnumbered used ones (a
// large Trash purge, a burst of abandoned guest uploads), since the sweep was
// the only thing that could bring the share back down. One page (one R2 call)
// a day bounds what an index gap could cost before the daily error is seen,
// and still drains any real backlog. Safe range: 1 to IMAGE_SWEEP_PAGE.
export const IMAGE_SWEEP_TRIPPED_MAX = IMAGE_SWEEP_PAGE;

export function sweepTripped(old: number, unused: number): boolean {
  return unused > IMAGE_SWEEP_TRIPWIRE_MIN && unused / old > IMAGE_SWEEP_TRIPWIRE_RATIO;
}

// Store-wide, whoever owns the tab. Joining `tabs` is what keeps a dangling
// reference (its tab deleted by a path that didn't prune) from counting.
const LIVE_REFERENCE = `EXISTS (SELECT 1 FROM image_refs r JOIN tabs t ON t.id = r.tab_id
                         WHERE r.image_id = images.id)`;

// Daily retention sweep (docs/specs/009-elements/images.md "Retention"). Deletes images that are
// BOTH older than `cutoff` AND referenced by no tab, reading only the index.
// Returns the number of images deleted.
//
// Keeps bytes whenever in doubt: a no-op without R2, paused until the index
// backfill completes, and slowed by the tripwire to one capped page, oldest
// first. Each page is deleted from D1 by a statement that re-checks the
// reference at that instant, then from R2, so an image placed after it was
// counted survives.
export async function deleteOldUnusedImages(env: Env, cutoff: number): Promise<number> {
  if (!env.IMAGES) return 0;
  const bucket = env.IMAGES;
  if (!(await isImageRefIndexComplete(env))) {
    console.log('image sweep: paused, reference index backfill incomplete');
    return 0;
  }

  const { old, unused } = (await env.DB.prepare(
    `SELECT COUNT(*) AS old, COALESCE(SUM(NOT ${LIVE_REFERENCE}), 0) AS unused
       FROM images WHERE created_at < ?`,
  )
    .bind(cutoff)
    .first<{ old: number; unused: number }>())!;
  if (unused === 0) return 0;
  if (sweepTripped(old, unused)) {
    console.error(
      `image-sweep-tripwire: ${unused} of ${old} old images unreferenced; deleting at most ${IMAGE_SWEEP_TRIPPED_MAX}, oldest first`,
    );
    const page = await env.DB.prepare(
      `SELECT id FROM images
        WHERE created_at < ?1 AND NOT ${LIVE_REFERENCE}
        ORDER BY created_at, id LIMIT ?2`,
    )
      .bind(cutoff, IMAGE_SWEEP_TRIPPED_MAX)
      .all<{ id: string }>();
    return reapPage(
      env,
      bucket,
      page.results.map((r) => r.id),
    );
  }

  let deleted = 0;
  let after = '';
  for (;;) {
    const page = await env.DB.prepare(
      `SELECT id FROM images
        WHERE created_at < ?1 AND id > ?2 AND NOT ${LIVE_REFERENCE}
        ORDER BY id LIMIT ?3`,
    )
      .bind(cutoff, after, IMAGE_SWEEP_PAGE)
      .all<{ id: string }>();
    const ids = page.results.map((r) => r.id);
    if (ids.length === 0) break;
    after = ids[ids.length - 1]!;
    deleted += await reapPage(env, bucket, ids);
    if (ids.length < IMAGE_SWEEP_PAGE) break;
  }
  return deleted;
}

// Delete one page of candidate ids: the rows still unreferenced at this instant,
// their dangling references, then their bytes. Returns how many rows went.
async function reapPage(env: Env, bucket: R2Bucket, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const gone = await env.DB.prepare(
    `DELETE FROM images
      WHERE id IN (SELECT value FROM json_each(?)) AND NOT ${LIVE_REFERENCE}
      RETURNING id`,
  )
    .bind(JSON.stringify(ids))
    .all<{ id: string }>();
  const goneIds = gone.results.map((r) => r.id);
  if (goneIds.length === 0) return 0;
  // Their references can only be dangling ones now; drop them with the image.
  await env.DB.prepare('DELETE FROM image_refs WHERE image_id IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(goneIds))
    .run();
  try {
    await bucket.delete(goneIds);
  } catch (err) {
    // The rows are gone, the bytes stay: storage kept, never a broken picture.
    console.error('image sweep: R2 delete failed', goneIds, err);
  }
  return goneIds.length;
}
