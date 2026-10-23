// The daily image job (docs/specs/009-elements/images.md, "Retention"): sweep unused images.

import { deleteOldUnusedImages } from '../db/image-retention';
import type { Env } from '../types';

// Only images older than this AND referenced by no document are reaped: the
// floor keeps a fresh upload that isn't on the canvas yet out of reach.
export const UNUSED_IMAGE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function runImageRetention(env: Env, now: number): Promise<void> {
  const cutoff = now - UNUSED_IMAGE_RETENTION_MS;
  try {
    const count = await deleteOldUnusedImages(env, cutoff);
    console.log(`image sweep: deleted ${count} images older than ${cutoff}`);
  } catch (err) {
    console.error('image sweep failed', err);
  }
}
