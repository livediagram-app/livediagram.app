// HTTP response helpers shared across the worker's route handlers: @liveworkspace/api-kit's, bound to this api's
// CORS headers, so the envelope, the status codes and the CORS set have one canonical home. Only the answers that
// are this product's own are written here.

import {
  BUILD_ID_HEADER,
  CHANGESET_SEEN_HEADER,
  CLIENT_HEADER,
  PROJECT_CONVERSION_HEADER,
  PROJECT_FORMAT_HEADER,
  PROJECT_TRASHED_ERROR,
} from '@liveplanner/api-schema';
import { corsHeaders, createResponses } from '@liveworkspace/api-kit/responses';

// The headers this product's editor sends beyond every product's (`BASE_ALLOWED_HEADERS`), and the ones a page on
// another origin may read: the server release signal (docs/specs/016-platform/new-version-prompt.md,
// stale-builds.md) and the tab revision as an ETag (docs/specs/024-agents/agent-changesets.md).
export const CORS_HEADERS = corsHeaders({
  allowHeaders: [
    // Take Offline and Sync Plan declare themselves with the conversion header.
    PROJECT_CONVERSION_HEADER,
    CHANGESET_SEEN_HEADER,
    CLIENT_HEADER,
  ],
  exposeHeaders: [PROJECT_FORMAT_HEADER, BUILD_ID_HEADER, 'ETag'],
});

export const {
  json,
  textPlain,
  svgImage,
  noContent,
  notFound,
  badRequest,
  forbidden,
  methodNotAllowed,
  payloadTooLarge,
  rateLimited,
  signInRequired,
  conflict,
  missingAuth,
} = createResponses(CORS_HEADERS);

// No media service on this deploy (no MEDIA_KEY): Image fields can't upload or show a picture here
// (docs/specs/026-plan/item-types.md "Image fields"), so the editor says so rather than failing on a generic 500.
export function imagesUnavailable(): Response {
  return json({ error: 'images_unavailable' }, { status: 503 });
}

// A plan in the Trash (docs/specs/013-workspace/trash.md), answered only to a
// caller who could have opened it: the deleted state, not a not-found.
export function projectTrashed(): Response {
  return json({ error: PROJECT_TRASHED_ERROR }, { status: 410 });
}
