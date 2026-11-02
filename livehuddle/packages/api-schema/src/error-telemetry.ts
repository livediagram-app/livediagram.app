// Error telemetry tokens (docs/specs/017-telemetry/telemetry.md 'Error' category): how every error source
// says WHERE it failed inside the one `type` token it has. Shared so the
// editor, the help centre, the api worker and the MCP worker all build the
// same shape: dot-separated PascalCase parts, `<What>.<Where>[.<Which>]`,
// e.g. `Http403.SaveTab`, `Internal.Put.Documents.Tabs`,
// `Uncaught.Document.TypeError`, `Render.Canvas.TypeError`.
//
// Every part a caller passes must already be a preset (a request intent
// authored in code, a route word from a closed list, a page from
// pageViewPath). These helpers only normalise the spelling; they do not make
// arbitrary text safe, which is why nothing here accepts a message, a stack,
// or a raw URL.

import { createApiRouteLabel } from '@liveworkspace/telemetry/error-tokens';

// The tokens every app builds the same way (`@liveworkspace/telemetry/error-tokens`).
export {
  errorNameToken,
  errorPageToken,
  errorTypeToken,
  pascalToken,
} from '@liveworkspace/telemetry/error-tokens';

// The api's top-level resources: the segment after `/api` that the worker
// dispatches on (apps/api/src/index.ts, whose test keeps the two in step).
export const API_ROUTE_RESOURCES: ReadonlySet<string> = new Set([
  'capabilities',
  'templates',
  'icons',
  'schema',
  'openapi.json',
  'unfurl',
  'ai',
  'events',
  'share',
  'community',
  'images',
  'documents',
  'folders',
  'shape-libraries',
  'teams',
  'tokens',
  'oauth',
  'account',
  'trash',
  'preferences',
  'participants',
  // The one-time doors of the move from the old livehuddle.app.
  'legacy-guest',
  'migration',
]);

// The fixed words that appear BELOW a resource in the api's routes
// (`/documents/<id>/tabs/<tabId>/comments`). Only these survive into a route
// label; every other segment is an id, a share code, or a slug and is
// skipped. Closed on purpose so a label can never carry an identifier.
const API_ROUTE_WORDS: ReadonlySet<string> = new Set([
  'tabs',
  'share',
  'members',
  'comments',
  'room-ticket',
  'invite-link',
  'events',
  'link',
  'extend',
  'accept',
  'tab',
  'join',
  'ws',
  'thumbnail',
  'share-password',
  'notify-action',
  'library',
  'folder',
  'dismiss',
  'copy',
  'access-check',
  'usage',
  'unread',
  'summary',
  'refresh',
  'invites',
  'restore',
  // The liveworkspace index's doors into a canvas (/api/internal/items/**).
  'items',
]);

// Which endpoint a request hit, as a label with no identifiers in it (`PUT /api/<collection>/<id>/tabs/<tabId>` ->
// `Put.<Collection>.Tabs`), from this api's resources and route words; an unknown resource reads `Unknown`.
export const apiRouteLabel = createApiRouteLabel(API_ROUTE_RESOURCES, API_ROUTE_WORDS);
