// HTTP response helpers shared across the worker's route handlers: @liveworkspace/api-kit's, bound to this api's
// CORS headers, so the envelope, the status codes and the CORS set have one canonical home. Only the answers that
// are this product's own are written here.

import {
  BUILD_ID_HEADER,
  CHANGESET_SEEN_HEADER,
  CLIENT_HEADER,
  COMMUNITY_KEY_HEADER,
  DOCUMENT_CONVERSION_HEADER,
  DOCUMENT_FORMAT_HEADER,
  DOCUMENT_OPEN_HEADER,
  DOCUMENT_TRASHED_ERROR,
} from '@livehuddle/api-schema';
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
    // Take Offline and Sync Diagram declare themselves with the conversion header; the first tab read carries
    // the open marker.
    DOCUMENT_CONVERSION_HEADER,
    DOCUMENT_OPEN_HEADER,
    CHANGESET_SEEN_HEADER,
    CLIENT_HEADER,
    COMMUNITY_KEY_HEADER,
  ],
  exposeHeaders: [DOCUMENT_FORMAT_HEADER, BUILD_ID_HEADER, 'ETag'],
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

// 502 when the upstream AI provider fails or returns something unusable
// (docs/specs/021-event-storming/note-reader.md). One token for every failure mode so the client shows a single
// "try again" state; the specific cause goes to the worker log instead.
export function aiError(): Response {
  return json({ error: 'ai_error' }, { status: 502 });
}

export function imagesUnavailable(): Response {
  return json({ error: 'images_unavailable' }, { status: 503 });
}

// A canvas in the Trash, to a caller who could open it (its owner or team; docs/specs/013-workspace/trash.md): the
// index's grant says so. Anyone else gets the 404 a never-existing id gets.
export function documentTrashed(): Response {
  return json({ error: DOCUMENT_TRASHED_ERROR }, { status: 410 });
}
