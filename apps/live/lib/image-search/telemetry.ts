// Image search failures as `Error·Warning` tokens
// (docs/specs/009-elements/image-search.md "Telemetry"). Fixed tables, so a
// token is never built from a message, a query or a URL.

import type { OpenverseSearchErrorKind } from './openverse';
import type { PickFailure } from './pick';

const SEARCH_WARNINGS = {
  'rate-limited': 'ImageSearch.RateLimited',
  failed: 'ImageSearch.SearchFailed',
} as const satisfies Record<OpenverseSearchErrorKind, string>;

const PICK_WARNINGS = {
  'download-failed': 'ImageSearch.Pick.DownloadFailed',
  'gallery-full': 'ImageSearch.Pick.GalleryFull',
  'images-unavailable': 'ImageSearch.Pick.ImagesUnavailable',
  'too-large': 'ImageSearch.Pick.TooLarge',
  'offline-budget': 'ImageSearch.Pick.OfflineBudget',
  unsupported: 'ImageSearch.Pick.Unsupported',
  'missing-bytes': 'ImageSearch.Pick.MissingBytes',
  'upload-failed': 'ImageSearch.Pick.UploadFailed',
} as const satisfies Record<PickFailure, string>;

export const IMAGE_SEARCH_THUMBNAIL_FALLBACK = 'ImageSearch.ThumbnailFallback';

export type ImageSearchWarning =
  | (typeof SEARCH_WARNINGS)[OpenverseSearchErrorKind]
  | (typeof PICK_WARNINGS)[PickFailure]
  | typeof IMAGE_SEARCH_THUMBNAIL_FALLBACK;

export const searchWarningType = (kind: OpenverseSearchErrorKind): ImageSearchWarning =>
  SEARCH_WARNINGS[kind];

export const pickWarningType = (failure: PickFailure): ImageSearchWarning => PICK_WARNINGS[failure];

// Every token this module can produce, for the dashboard's emitter declaration.
export const IMAGE_SEARCH_WARNINGS: readonly ImageSearchWarning[] = [
  ...Object.values(SEARCH_WARNINGS),
  ...Object.values(PICK_WARNINGS),
  IMAGE_SEARCH_THUMBNAIL_FALLBACK,
];
