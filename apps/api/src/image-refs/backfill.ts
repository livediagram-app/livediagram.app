// The one-off indexing of tabs saved before migration 0050
// (docs/specs/009-elements/images.md, "Reference index", Backfill). Tabs
// saved since index themselves in their own batch; this reaches the rest.
//
// Driven by the daily cron. Each run pages through `tabs` by rowid with the
// SQL extractor, so no tab body leaves D1, and stops at a time budget,
// resuming from its cursor next day. Until it completes, the retention sweep
// deletes nothing.

import {
  completeImageRefsBackfill,
  imageRefAddStatements,
  imageRefIndexPageStatement,
  imageRefsBackfillAdvanceStatement,
  maxTabRowId,
  nextCorruptTabMentioningImages,
  readImageRefsBackfill,
  restartImageRefsBackfill,
} from '../db/image-refs';
import type { Env } from '../types';
import { imageRefIdsFromText } from './extract';

// Tabs per page. A page parses at most this many bodies inside D1, each at
// most MAX_TAB_BYTES, well inside a statement's time limit for real tabs.
export const IMAGE_REFS_BACKFILL_PAGE_ROWS = 100;

// How long after the migration to wait, so no worker from before the index
// (which saves without maintaining it) is still running when pages are read.
export const IMAGE_REFS_BACKFILL_SETTLE_MS = 60 * 60 * 1000;

// Wall-clock budget per run; the cron allows far more, and the rest waits a day.
export const IMAGE_REFS_BACKFILL_BUDGET_MS = 60 * 1000;

export type ImageRefsBackfillResult = { state: 'settling' | 'running' | 'complete' };

export async function runImageRefsBackfill(
  env: Env,
  now: number,
  clock: () => number = Date.now,
): Promise<ImageRefsBackfillResult> {
  const row = await readImageRefsBackfill(env);
  if (!row) {
    console.warn('image-refs backfill: state row missing; restarting');
    await restartImageRefsBackfill(env, now);
    return { state: 'settling' };
  }
  if (row.completed_at !== null) return { state: 'complete' };
  if (now - row.created_at < IMAGE_REFS_BACKFILL_SETTLE_MS) {
    console.log('image-refs backfill: settling');
    return { state: 'settling' };
  }

  const start = clock();
  const first = row.cursor;
  let cursor = row.cursor;
  while (clock() - start < IMAGE_REFS_BACKFILL_BUDGET_MS) {
    // Re-read each page, so tabs created during the backfill are reached too.
    const max = await maxTabRowId(env);
    if (cursor >= max) {
      await completeImageRefsBackfill(env, now);
      console.log(`image-refs backfill: complete at cursor ${cursor}`);
      return { state: 'complete' };
    }
    const to = Math.min(cursor + IMAGE_REFS_BACKFILL_PAGE_ROWS, max);
    await indexCorruptTabs(env, cursor, to);
    // The page and its cursor land together, so a failed run redoes the page.
    await env.DB.batch([
      imageRefIndexPageStatement(env, cursor, to),
      imageRefsBackfillAdvanceStatement(env, to),
    ]);
    cursor = to;
  }
  console.log(`image-refs backfill: indexed tabs ${first}..${cursor}`);
  return { state: 'running' };
}

// A body that isn't valid JSON gets nothing from the SQL extractor, so its
// text is scanned instead: every id after an "imageId" key counts.
async function indexCorruptTabs(env: Env, fromRowId: number, toRowId: number): Promise<void> {
  let after = fromRowId;
  for (;;) {
    const bad = await nextCorruptTabMentioningImages(env, after, toRowId);
    if (!bad) return;
    const ids = imageRefIdsFromText(bad.data);
    const stmts = imageRefAddStatements(env, bad.id, ids);
    if (stmts.length > 0) await env.DB.batch(stmts);
    console.warn(`image-refs backfill: corrupt tab ${bad.id} scanned as text (${ids.length} ids)`);
    after = bad.rid;
  }
}
