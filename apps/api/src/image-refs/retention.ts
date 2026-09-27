// The daily image job (docs/specs/009-elements/images.md, "Retention"):
// advance the reference-index backfill, then sweep unused images. In that
// order, so the run that completes the backfill can already sweep; the sweep
// gates itself on completion, so it runs even when the backfill fails.

import { deleteOldUnusedImages } from '../db/images';
import type { Env } from '../types';
import { runImageRefsBackfill } from './backfill';

// Only images older than this AND referenced by no diagram are reaped: the
// floor keeps a fresh upload that isn't on the canvas yet out of reach.
export const UNUSED_IMAGE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function runImageRetention(env: Env, now: number): Promise<void> {
  try {
    await runImageRefsBackfill(env, now);
  } catch (err) {
    console.error('image-refs backfill failed', err);
  }
  const cutoff = now - UNUSED_IMAGE_RETENTION_MS;
  try {
    const count = await deleteOldUnusedImages(env, cutoff);
    console.log(`image sweep: deleted ${count} images older than ${cutoff}`);
  } catch (err) {
    console.error('image sweep failed', err);
  }
}
