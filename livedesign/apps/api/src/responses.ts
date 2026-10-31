// HTTP response helpers shared across the worker's route handlers: @liveworkspace/api-kit's, bound to this api's
// CORS headers, so the envelope, the status codes and the CORS set have one canonical home. Only the answers that
// are this product's own are written here.

import {
  BUILD_ID_HEADER,
  CHANGESET_SEEN_HEADER,
  CLIENT_HEADER,
  COMMUNITY_KEY_HEADER,
  DESIGN_CONVERSION_HEADER,
  DESIGN_FORMAT_HEADER,
  DESIGN_TRASHED_ERROR,
} from '@livedesign/api-schema';
import { corsHeaders, createResponses } from '@liveworkspace/api-kit/responses';

// The headers this product's editor sends beyond every product's (`BASE_ALLOWED_HEADERS`), and the ones a page on
// another origin may read: the server release signal (docs/specs/016-platform/new-version-prompt.md,
// stale-builds.md) and the tab revision as an ETag (docs/specs/024-agents/agent-changesets.md).
export const CORS_HEADERS = corsHeaders({
  allowHeaders: [
    // Image upload's own headers (docs/specs/009-elements/images.md).
    'X-Image-Sha256',
    'X-Image-Width',
    'X-Image-Height',
    'X-Image-Original-Name',
    // Take Offline and Sync Design declare themselves with the conversion header.
    DESIGN_CONVERSION_HEADER,
    CHANGESET_SEEN_HEADER,
    CLIENT_HEADER,
    // My Shares passes the page's community key on (docs/specs/025-community/community.md "My Shares").
    COMMUNITY_KEY_HEADER,
  ],
  exposeHeaders: [DESIGN_FORMAT_HEADER, BUILD_ID_HEADER, 'ETag'],
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

export function imagesUnavailable(): Response {
  return json({ error: 'images_unavailable' }, { status: 503 });
}

// A design in the Trash (docs/specs/013-workspace/trash.md), answered only to a
// caller who could have opened it: the deleted state, not a not-found.
export function designTrashed(): Response {
  return json({ error: DESIGN_TRASHED_ERROR }, { status: 410 });
}
