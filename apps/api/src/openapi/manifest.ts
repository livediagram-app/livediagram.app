// The route manifest: the single declarative description of the `/api/*` REST
// surface (spec/37). Each entry names one endpoint's method, path template,
// auth mode, summary, request/response body, and meaningful status codes. The
// worker dispatch (index.ts → routes/*.ts) is segment-based and imperative, so
// THIS array is the declaration of the surface, and `manifest.test.ts` pins it
// to the real handlers: a new resource segment added to the dispatch without a
// manifest entry (or a manifest entry for a segment that no longer dispatches)
// turns CI red.
//
// `requestSchema` / `responseSchema` are either a component name (a key of the
// generated COMPONENT_SCHEMAS, itself derived from @livediagram/api-schema) or
// an inline JSON Schema for the small envelopes that wrap a payload. Path
// parameters are derived from the `{param}` placeholders in `path` by
// document.ts, so they aren't repeated here.

import type { BodySchema } from './types';

/** How a caller authenticates (spec/04):
 *  - `public`: no identity required.
 *  - `guest-or-clerk`: the guest `X-Owner-Id` header OR a Bearer credential
 *    (a Clerk session JWT or an API token).
 *  - `clerk`: a Bearer credential only (Clerk JWT or API token); guests are
 *    rejected. */
export type AuthMode = 'public' | 'guest-or-clerk' | 'clerk';

interface QueryParam {
  name: string;
  required: boolean;
  description: string;
}

export interface RouteSpec {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Path template under the server base, e.g. `/diagrams/{id}/tabs/{tabId}`. */
  path: string;
  /** Top-level resource segment, matching index.ts's dispatch switch. Used by
   *  the drift test to assert manifest/handler parity. */
  segment: string;
  tag: string;
  summary: string;
  auth: AuthMode;
  /** Whether an external API-token holder would realistically call this (vs a
   *  first-party-only / internal endpoint). Surfaced in the doc so integrators
   *  can see the supported surface at a glance. */
  tokenUsable?: boolean;
  query?: QueryParam[];
  requestSchema?: BodySchema;
  responseSchema?: BodySchema;
  /** Meaningful status codes. The first 2xx is the success response; the rest
   *  are documented with the shared Error schema by document.ts. */
  statuses: number[];
}

// Small helpers for the response envelopes the routes wrap payloads in. These
// are the ONLY hand-written shapes; the payloads they reference come from the
// generated component schemas.
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const listOf = (key: string, name: string): BodySchema => ({
  type: 'object',
  properties: { [key]: { type: 'array', items: ref(name) } },
  required: [key],
});
const wrap = (key: string, name: string): BodySchema => ({
  type: 'object',
  properties: { [key]: ref(name) },
  required: [key],
});

export const ROUTE_MANIFEST: RouteSpec[] = [
  // ---- Meta ----
  {
    method: 'GET',
    path: '/openapi.json',
    segment: 'openapi.json',
    tag: 'Meta',
    summary: 'This OpenAPI 3.1 description of the API. Public and unauthenticated.',
    auth: 'public',
    responseSchema: { type: 'object' },
    statuses: [200],
  },
  {
    method: 'GET',
    path: '/capabilities',
    segment: 'capabilities',
    tag: 'Meta',
    summary: 'Which optional server features are configured (e.g. AI).',
    auth: 'public',
    responseSchema: 'CapabilitiesResponse',
    statuses: [200],
  },

  // ---- Diagrams ----
  {
    method: 'GET',
    path: '/diagrams',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary: "List the caller's diagrams (metadata only, no tab contents).",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: listOf('diagrams', 'DiagramSummary'),
    statuses: [200, 401],
  },
  {
    method: 'POST',
    path: '/diagrams',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary: 'Create a diagram, optionally seeding it with tabs.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        tabs: { type: 'array', items: ref('Tab') },
        folderId: { type: ['string', 'null'] },
        teamId: { type: ['string', 'null'] },
      },
      required: ['id', 'name'],
    },
    responseSchema: wrap('diagram', 'Diagram'),
    statuses: [201, 400, 401, 403, 413],
  },
  {
    method: 'GET',
    path: '/diagrams/{id}',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary: 'Get a diagram (metadata + tab summaries; tab contents fetched separately).',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: wrap('diagram', 'Diagram'),
    statuses: [200, 401, 404],
  },
  {
    method: 'PUT',
    path: '/diagrams/{id}',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary: 'Update a diagram name and/or tab order.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        tabIds: { type: 'array', items: { type: 'string' } },
      },
    },
    responseSchema: wrap('diagram', 'Diagram'),
    statuses: [200, 400, 401, 403, 404],
  },
  {
    method: 'DELETE',
    path: '/diagrams/{id}',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary: 'Delete a diagram.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404],
  },
  {
    method: 'POST',
    path: '/diagrams/{id}/copy',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary: "Duplicate a diagram into the caller's files.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: { type: 'object', properties: { name: { type: 'string' } } },
    responseSchema: wrap('diagram', 'Diagram'),
    statuses: [201, 401, 403, 404],
  },
  {
    method: 'PUT',
    path: '/diagrams/{id}/folder',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary: 'Move a diagram into a personal or team folder.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: {
        folderId: { type: ['string', 'null'] },
        teamId: { type: ['string', 'null'] },
      },
    },
    statuses: [204, 400, 401, 403, 404],
  },
  {
    method: 'GET',
    path: '/diagrams/{id}/tabs/{tabId}',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary: 'Get the full contents (elements) of one tab.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: wrap('tab', 'Tab'),
    statuses: [200, 401, 403, 404],
  },
  {
    method: 'PUT',
    path: '/diagrams/{id}/tabs/{tabId}',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary: 'Create or replace one tab and its elements.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: 'Tab',
    responseSchema: wrap('tab', 'Tab'),
    statuses: [200, 400, 401, 403, 404, 409, 413],
  },
  {
    method: 'DELETE',
    path: '/diagrams/{id}/tabs/{tabId}',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary: 'Delete one tab from a diagram.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404],
  },
  {
    method: 'POST',
    path: '/diagrams/{id}/tabs/{tabId}/comments',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary: 'Add a comment to an element on a tab.',
    auth: 'guest-or-clerk',
    requestSchema: {
      type: 'object',
      properties: { elementId: { type: 'string' }, text: { type: 'string' } },
      required: ['elementId', 'text'],
    },
    statuses: [201, 400, 401, 403, 404],
  },
  {
    method: 'DELETE',
    path: '/diagrams/{id}/tabs/{tabId}/comments/{commentId}',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary: 'Delete a comment.',
    auth: 'guest-or-clerk',
    statuses: [204, 401, 403, 404],
  },
  {
    method: 'POST',
    path: '/diagrams/{id}/tabs/{tabId}/link',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary: 'Add (link) an existing tab into this diagram.',
    auth: 'guest-or-clerk',
    responseSchema: wrap('tab', 'TabSummary'),
    statuses: [200, 401, 403, 404],
  },
  {
    method: 'GET',
    path: '/diagrams/{id}/share',
    segment: 'diagrams',
    tag: 'Sharing',
    summary: "List a diagram's share links and password state.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: listOf('links', 'ShareLink'),
    statuses: [200, 401, 403, 404],
  },
  {
    method: 'POST',
    path: '/diagrams/{id}/share',
    segment: 'diagrams',
    tag: 'Sharing',
    summary: 'Create a share link (edit or view role, optional expiry).',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: { role: ref('ShareRole'), expiry: ref('ShareLinkExpiry') },
      required: ['role'],
    },
    responseSchema: wrap('link', 'ShareLink'),
    statuses: [201, 400, 401, 403, 404],
  },
  {
    method: 'DELETE',
    path: '/diagrams/{id}/share',
    segment: 'diagrams',
    tag: 'Sharing',
    summary: 'Revoke all share links for a diagram.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [200, 401, 403, 404],
  },
  {
    method: 'PUT',
    path: '/diagrams/{id}/share-password',
    segment: 'diagrams',
    tag: 'Sharing',
    summary: "Set or clear a diagram's share password.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: { password: { type: ['string', 'null'] } },
      required: ['password'],
    },
    statuses: [200, 400, 401, 403, 404],
  },
  {
    method: 'DELETE',
    path: '/diagrams/{id}/share/{code}',
    segment: 'diagrams',
    tag: 'Sharing',
    summary: 'Revoke one share link by its code.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404],
  },
  {
    method: 'POST',
    path: '/diagrams/{id}/share/{code}/extend',
    segment: 'diagrams',
    tag: 'Sharing',
    summary: 'Re-arm an expiring share link.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: wrap('link', 'ShareLink'),
    statuses: [200, 400, 401, 403, 404],
  },
  {
    method: 'GET',
    path: '/diagrams/{id}/ws',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary:
      'WebSocket upgrade to the realtime room. The op protocol is documented in spec/11, not here.',
    auth: 'guest-or-clerk',
    query: [
      { name: 's', required: false, description: 'Share code, for non-owner collaborators.' },
      { name: 'o', required: false, description: 'Owner id (guest path).' },
      { name: 'p', required: false, description: 'Share password, when the diagram is gated.' },
    ],
    statuses: [101, 403, 404],
  },
  {
    method: 'GET',
    path: '/diagrams/{id}/log',
    segment: 'diagrams',
    tag: 'Activity',
    summary: "List a diagram's change-log entries.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: listOf('entries', 'ChangeLogEntry'),
    statuses: [200, 401, 403, 404],
  },
  {
    method: 'POST',
    path: '/diagrams/{id}/log',
    segment: 'diagrams',
    tag: 'Activity',
    summary: 'Append a change-log entry.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: 'ChangeLogEntry',
    responseSchema: wrap('entry', 'ChangeLogEntry'),
    statuses: [201, 400, 401, 403, 404],
  },
  {
    method: 'DELETE',
    path: '/diagrams/{id}/log/{entryId}',
    segment: 'diagrams',
    tag: 'Activity',
    summary: 'Delete one change-log entry.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404],
  },
  {
    method: 'DELETE',
    path: '/diagrams/{id}/log/tab/{tabId}',
    segment: 'diagrams',
    tag: 'Activity',
    summary: "Clear a tab's change-log entries.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404],
  },

  // ---- Folders ----
  {
    method: 'GET',
    path: '/folders',
    segment: 'folders',
    tag: 'Folders',
    summary: "List the caller's personal folder tree.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: listOf('folders', 'Folder'),
    statuses: [200, 401],
  },
  {
    method: 'POST',
    path: '/folders',
    segment: 'folders',
    tag: 'Folders',
    summary: 'Create a folder (personal or team).',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        parentId: { type: ['string', 'null'] },
        teamId: { type: ['string', 'null'] },
      },
      required: ['id', 'name'],
    },
    responseSchema: wrap('folder', 'Folder'),
    statuses: [201, 400, 401, 403, 404],
  },
  {
    method: 'PUT',
    path: '/folders/{id}',
    segment: 'folders',
    tag: 'Folders',
    summary: 'Rename or reparent a folder.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: { name: { type: 'string' }, parentId: { type: ['string', 'null'] } },
    },
    responseSchema: wrap('folder', 'Folder'),
    statuses: [200, 400, 401, 403, 404, 409],
  },
  {
    method: 'DELETE',
    path: '/folders/{id}',
    segment: 'folders',
    tag: 'Folders',
    summary: 'Delete a folder.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404],
  },

  // ---- Images ----
  {
    method: 'GET',
    path: '/images',
    segment: 'images',
    tag: 'Images',
    summary: "List the caller's uploaded images.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: listOf('images', 'ImageSummary'),
    statuses: [200, 401, 503],
  },
  {
    method: 'POST',
    path: '/images',
    segment: 'images',
    tag: 'Images',
    summary: 'Upload an image (raw bytes; SHA-256 + dimensions in X-Image-* headers).',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: { type: 'string', format: 'binary' },
    responseSchema: {
      type: 'object',
      properties: { image: ref('ImageSummary'), deduped: { type: 'boolean' } },
      required: ['image', 'deduped'],
    },
    statuses: [200, 400, 401, 403, 413, 415, 503],
  },
  {
    method: 'GET',
    path: '/images/usage',
    segment: 'images',
    tag: 'Images',
    summary: 'Map each image to the diagrams that reference it.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: { type: 'object' },
    statuses: [200, 401, 503],
  },
  {
    method: 'GET',
    path: '/images/{id}',
    segment: 'images',
    tag: 'Images',
    summary: 'Download an image (owner, or a share-code reader).',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    query: [{ name: 'd', required: false, description: 'Diagram id, for share-code readers.' }],
    responseSchema: { type: 'string', format: 'binary' },
    statuses: [200, 404, 503],
  },
  {
    method: 'DELETE',
    path: '/images/{id}',
    segment: 'images',
    tag: 'Images',
    summary: 'Delete an image from the gallery.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [200, 401, 403, 503],
  },

  // ---- Custom themes ----
  {
    method: 'GET',
    path: '/custom-themes',
    segment: 'custom-themes',
    tag: 'Themes',
    summary: "List the caller's saved custom themes.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: listOf('themes', 'CustomTheme'),
    statuses: [200, 401],
  },
  {
    method: 'POST',
    path: '/custom-themes',
    segment: 'custom-themes',
    tag: 'Themes',
    summary: 'Create a custom theme.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        definition: ref('CustomThemeDefinition'),
      },
      required: ['id', 'name', 'definition'],
    },
    responseSchema: wrap('theme', 'CustomTheme'),
    statuses: [201, 400, 401, 413],
  },
  {
    method: 'PUT',
    path: '/custom-themes/{id}',
    segment: 'custom-themes',
    tag: 'Themes',
    summary: "Update a custom theme's name or definition.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: { name: { type: 'string' }, definition: ref('CustomThemeDefinition') },
    },
    responseSchema: wrap('theme', 'CustomTheme'),
    statuses: [200, 400, 401, 403, 404, 413],
  },
  {
    method: 'DELETE',
    path: '/custom-themes/{id}',
    segment: 'custom-themes',
    tag: 'Themes',
    summary: 'Delete a custom theme.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404],
  },

  // ---- API tokens ----
  {
    method: 'GET',
    path: '/tokens',
    segment: 'tokens',
    tag: 'API tokens',
    summary: "List the caller's API tokens (metadata only; the secret is never returned).",
    auth: 'clerk',
    responseSchema: listOf('tokens', 'ApiToken'),
    statuses: [200, 401],
  },
  {
    method: 'POST',
    path: '/tokens',
    segment: 'tokens',
    tag: 'API tokens',
    summary: 'Mint an API token. The secret is returned once, here only.',
    auth: 'clerk',
    requestSchema: { type: 'object', properties: { name: { type: 'string' } } },
    responseSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'The secret, shown once.' },
        id: { type: 'string' },
        name: { type: ['string', 'null'] },
        expiresAt: { type: 'number' },
      },
      required: ['token', 'id', 'expiresAt'],
    },
    statuses: [201, 400, 401, 409],
  },
  {
    method: 'DELETE',
    path: '/tokens/{id}',
    segment: 'tokens',
    tag: 'API tokens',
    summary: 'Revoke an API token.',
    auth: 'clerk',
    statuses: [204, 401, 404],
  },

  // ---- Shared with you ----
  {
    method: 'GET',
    path: '/shared',
    segment: 'shared',
    tag: 'Sharing',
    summary: 'List diagrams shared with the caller.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: listOf('shared', 'SharedWithItem'),
    statuses: [200, 401],
  },
  {
    method: 'DELETE',
    path: '/shared/{diagramId}',
    segment: 'shared',
    tag: 'Sharing',
    summary: 'Remove a diagram from the caller\'s "shared with you" list.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [200, 401],
  },
  {
    method: 'GET',
    path: '/share/{code}',
    segment: 'share',
    tag: 'Sharing',
    summary: 'Resolve a share code to a diagram and the granted role.',
    auth: 'public',
    query: [{ name: 'password', required: false, description: 'Required when the link is gated.' }],
    responseSchema: {
      type: 'object',
      properties: { diagram: ref('Diagram'), role: ref('ShareRole') },
      required: ['diagram', 'role'],
    },
    statuses: [200, 401, 403, 404],
  },

  // ---- Participants ----
  {
    method: 'GET',
    path: '/participants/{id}',
    segment: 'participants',
    tag: 'Participants',
    summary: "Get a participant's display name and colour.",
    auth: 'public',
    responseSchema: wrap('participant', 'ParticipantRecord'),
    statuses: [200, 404],
  },
  {
    method: 'PUT',
    path: '/participants/{id}',
    segment: 'participants',
    tag: 'Participants',
    summary: 'Update your own participant display name and colour.',
    auth: 'guest-or-clerk',
    requestSchema: {
      type: 'object',
      properties: { name: { type: 'string' }, color: { type: 'string' } },
      required: ['name', 'color'],
    },
    responseSchema: wrap('participant', 'ParticipantRecord'),
    statuses: [200, 400, 401, 403, 404],
  },

  // ---- Preferences ----
  {
    method: 'GET',
    path: '/preferences',
    segment: 'preferences',
    tag: 'Account',
    summary: "Get the caller's editor preferences (opaque blob).",
    auth: 'guest-or-clerk',
    responseSchema: { type: 'object', properties: { prefs: { type: 'object' } } },
    statuses: [200, 401],
  },
  {
    method: 'PUT',
    path: '/preferences',
    segment: 'preferences',
    tag: 'Account',
    summary: 'Replace the editor preferences blob.',
    auth: 'guest-or-clerk',
    requestSchema: {
      type: 'object',
      properties: { prefs: { type: 'object' } },
      required: ['prefs'],
    },
    statuses: [204, 400, 401],
  },

  // ---- Account ----
  {
    method: 'DELETE',
    path: '/account',
    segment: 'account',
    tag: 'Account',
    summary: 'Delete the signed-in account and all of its data (diagrams, tokens, ...).',
    auth: 'clerk',
    responseSchema: { type: 'object', properties: { deleted: { type: 'number' } } },
    statuses: [204, 401],
  },
  {
    method: 'POST',
    path: '/migrate',
    segment: 'migrate',
    tag: 'Account',
    summary: 'Migrate a guest owner id onto the signed-in account (used at sign-up).',
    auth: 'guest-or-clerk',
    statuses: [200, 400, 401, 403],
  },
  {
    method: 'POST',
    path: '/guest-id',
    segment: 'guest-id',
    tag: 'Account',
    summary: 'Mint a signed guest owner id (first-party app).',
    auth: 'public',
    responseSchema: {
      type: 'object',
      properties: { ownerId: { type: 'string' }, ownerSig: { type: ['string', 'null'] } },
      required: ['ownerId'],
    },
    statuses: [200],
  },

  // ---- Teams ----
  {
    method: 'GET',
    path: '/teams',
    segment: 'teams',
    tag: 'Teams',
    summary: "List the caller's teams.",
    auth: 'clerk',
    responseSchema: listOf('teams', 'TeamListItem'),
    statuses: [200, 401],
  },
  {
    method: 'POST',
    path: '/teams',
    segment: 'teams',
    tag: 'Teams',
    summary: 'Create a team.',
    auth: 'clerk',
    requestSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        organisation: { type: ['string', 'null'] },
      },
      required: ['id', 'name'],
    },
    responseSchema: wrap('team', 'Team'),
    statuses: [201, 400, 401],
  },
  {
    method: 'GET',
    path: '/teams/invites',
    segment: 'teams',
    tag: 'Teams',
    summary: "List the caller's pending team invites.",
    auth: 'clerk',
    responseSchema: listOf('invites', 'TeamInvite'),
    statuses: [200, 401],
  },
  {
    method: 'GET',
    path: '/teams/invite-link/{token}',
    segment: 'teams',
    tag: 'Teams',
    summary: 'Resolve a team invite link to its team info.',
    auth: 'public',
    responseSchema: 'TeamInviteLinkInfo',
    statuses: [200, 404],
  },
  {
    method: 'POST',
    path: '/teams/invite-link/{token}/join',
    segment: 'teams',
    tag: 'Teams',
    summary: 'Join a team via its invite link.',
    auth: 'clerk',
    statuses: [200, 404],
  },
  {
    method: 'GET',
    path: '/teams/{id}',
    segment: 'teams',
    tag: 'Teams',
    summary: 'Get a team with its members and (for admins) its invite link.',
    auth: 'clerk',
    responseSchema: { type: 'object' },
    statuses: [200, 401, 404],
  },
  {
    method: 'PUT',
    path: '/teams/{id}',
    segment: 'teams',
    tag: 'Teams',
    summary: "Update a team's name or organisation (admin).",
    auth: 'clerk',
    requestSchema: {
      type: 'object',
      properties: { name: { type: 'string' }, organisation: { type: ['string', 'null'] } },
    },
    responseSchema: wrap('team', 'Team'),
    statuses: [200, 400, 401, 403, 404],
  },
  {
    method: 'DELETE',
    path: '/teams/{id}',
    segment: 'teams',
    tag: 'Teams',
    summary: 'Delete a team (admin).',
    auth: 'clerk',
    statuses: [204, 401, 403, 404],
  },
  {
    method: 'POST',
    path: '/teams/{id}/invite-link',
    segment: 'teams',
    tag: 'Teams',
    summary: 'Create or rotate a team invite link (admin).',
    auth: 'clerk',
    responseSchema: wrap('inviteLink', 'TeamInviteLink'),
    statuses: [201, 401, 403, 404],
  },
  {
    method: 'DELETE',
    path: '/teams/{id}/invite-link',
    segment: 'teams',
    tag: 'Teams',
    summary: 'Disable a team invite link (admin).',
    auth: 'clerk',
    statuses: [204, 401, 403, 404],
  },
  {
    method: 'POST',
    path: '/teams/{id}/members',
    segment: 'teams',
    tag: 'Teams',
    summary: 'Invite a member by email (admin).',
    auth: 'clerk',
    requestSchema: {
      type: 'object',
      properties: { email: { type: 'string' } },
      required: ['email'],
    },
    responseSchema: wrap('member', 'TeamMember'),
    statuses: [201, 400, 401, 403, 404, 409],
  },
  {
    method: 'POST',
    path: '/teams/{id}/notify-action',
    segment: 'teams',
    tag: 'Teams',
    summary:
      'Email a joined teammate that an action on a diagram element was assigned to them (spec/68). Best-effort; the assignee may have opted out.',
    auth: 'clerk',
    requestSchema: {
      type: 'object',
      properties: {
        assigneeUserId: { type: 'string' },
        diagramId: { type: 'string' },
        actionName: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['assigneeUserId', 'diagramId', 'actionName'],
    },
    statuses: [202, 400, 401, 403, 404],
  },
  {
    method: 'POST',
    path: '/teams/{id}/members/{memberId}/accept',
    segment: 'teams',
    tag: 'Teams',
    summary: 'Accept your own team invite.',
    auth: 'clerk',
    responseSchema: wrap('member', 'TeamMember'),
    statuses: [200, 401, 403, 404],
  },
  {
    method: 'PUT',
    path: '/teams/{id}/members/{memberId}',
    segment: 'teams',
    tag: 'Teams',
    summary: "Change a member's role (admin).",
    auth: 'clerk',
    requestSchema: { type: 'object', properties: { role: ref('TeamRole') }, required: ['role'] },
    responseSchema: wrap('member', 'TeamMember'),
    statuses: [200, 400, 401, 403, 404, 409],
  },
  {
    method: 'DELETE',
    path: '/teams/{id}/members/{memberId}',
    segment: 'teams',
    tag: 'Teams',
    summary: 'Remove a member, or decline/leave (admin or self).',
    auth: 'clerk',
    statuses: [204, 401, 403, 404, 409],
  },
  {
    method: 'GET',
    path: '/teams/{id}/library',
    segment: 'teams',
    tag: 'Teams',
    summary: "Get a team's shared folder tree and diagrams (joined member).",
    auth: 'clerk',
    responseSchema: {
      type: 'object',
      properties: {
        folders: { type: 'array', items: ref('Folder') },
        diagrams: { type: 'array', items: ref('DiagramSummary') },
      },
    },
    statuses: [200, 401, 403, 404],
  },

  // ---- OAuth (MCP) ----
  {
    method: 'POST',
    path: '/oauth/exchange',
    segment: 'oauth',
    tag: 'API tokens',
    summary: 'Exchange an MCP OAuth authorization for an API token.',
    auth: 'clerk',
    requestSchema: { type: 'object', properties: { clientName: { type: 'string' } } },
    statuses: [201, 400, 403, 404, 409],
  },

  // ---- AI ----
  {
    method: 'POST',
    path: '/ai',
    segment: 'ai',
    tag: 'AI',
    summary: 'Generate or review a diagram with the optional AI assistant (streamed).',
    auth: 'guest-or-clerk',
    requestSchema: 'AiRequest',
    statuses: [200, 401, 403, 500, 502, 503],
  },

  // ---- Link unfurl ----
  {
    method: 'GET',
    path: '/unfurl',
    segment: 'unfurl',
    tag: 'Meta',
    summary: 'Server-side link unfurl for link cards (SSRF-safe, rate-limited).',
    auth: 'public',
    query: [{ name: 'url', required: true, description: 'The URL to unfurl.' }],
    responseSchema: 'UnfurlResult',
    statuses: [200, 400, 429],
  },

  // ---- Telemetry ----
  {
    method: 'POST',
    path: '/events',
    segment: 'events',
    tag: 'Telemetry',
    summary: 'Ingest a batch of anonymous first-party telemetry events.',
    auth: 'public',
    requestSchema: {
      type: 'object',
      properties: { events: { type: 'array', items: ref('TelemetryEvent') } },
    },
    statuses: [204],
  },
  {
    method: 'GET',
    path: '/telemetry/summary',
    segment: 'telemetry',
    tag: 'Telemetry',
    summary: 'Public usage summary that powers the /telemetry dashboard.',
    auth: 'public',
    responseSchema: 'TelemetrySummary',
    statuses: [200],
  },
];
