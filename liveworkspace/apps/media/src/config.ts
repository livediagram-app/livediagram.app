// The Worker's settings. They live apart from src/index.ts because a Worker's entry module may only
// export handlers: the runtime refuses to start on any other export there.

import { MEDIA_API_PATH, PREVIEWS_API_PATH } from '@liveworkspace/media';

// The paths of liveworkspace.app this Worker owns: the media API, and previews (liveworkspace/docs/previews.md).
export const API_PATH = MEDIA_API_PATH;
export const PREVIEWS_PATH = PREVIEWS_API_PATH;

// The largest JSON body a route takes: a reference sync of MEDIA_REFS_SYNC_MAX documents.
export const MAX_JSON_BYTES = 2 * 1024 * 1024;

// The unused-image sweep (liveworkspace/docs/media.md "Retention"). An image is deleted only once it is
// this old and no document in any app places it. Generous on purpose: this is storage hygiene, so an
// image picked but not placed yet is never reaped from under someone.
export const UNUSED_IMAGE_AGE_MS = 30 * 24 * 60 * 60 * 1000;
// R2's delete takes at most 1000 keys.
export const SWEEP_PAGE = 1000;
// The tripwire: a run that would reap more than this share of the old images, and more than this many,
// is slowed to one page, oldest first, and logged as an error. A gap in the references looks exactly
// like that.
export const SWEEP_TRIPWIRE_RATIO = 0.5;
export const SWEEP_TRIPWIRE_MIN = 20;
