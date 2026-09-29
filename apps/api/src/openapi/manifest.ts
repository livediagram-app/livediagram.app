// The route manifest: the single declarative description of the `/api/*` REST
// surface (docs/specs/015-api/api-documentation.md). Each entry names one endpoint's method, path template,
// auth mode, summary, request/response body, and meaningful status codes. The
// worker dispatch (index.ts → routes/*.ts) is segment-based and imperative, so
// THIS array is the declaration of the surface, and `route-parity.test.ts` pins
// it to the real handlers by probing the running dispatch: a path the worker
// serves without a manifest entry (or a manifest entry the worker doesn't
// serve) turns CI red.
//
// `requestSchema` / `responseSchema` are either a component name (a key of the
// generated COMPONENT_SCHEMAS, itself derived from @livediagram/api-schema) or
// an inline JSON Schema for the small envelopes that wrap a payload. Path
// parameters are derived from the `{param}` placeholders in `path` by
// document.ts, so they aren't repeated here.

import { NAME_MAX_LENGTH } from '@livediagram/diagram';
import type { BodySchema } from './types';

/** How a caller authenticates (docs/specs/014-identity/auth-and-guest-access.md):
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
  /** Media type of the success body. Defaults to `application/json`; the SVG
   *  snapshot endpoints answer `image/svg+xml`. */
  responseMediaType?: string;
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
// A diagram name field: the worker shortens it to the name cap rather than
// rejecting it (docs/specs/006-diagram/name-length.md).
const nameField = {
  type: 'string',
  description:
    `At most ${NAME_MAX_LENGTH} characters; a longer name is stored shortened at a word boundary ` +
    'with an ellipsis, and whitespace runs collapse to one space.',
};
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
        name: nameField,
        tabs: { type: 'array', items: ref('Tab') },
        folderId: { type: ['string', 'null'] },
        teamId: { type: ['string', 'null'] },
      },
      required: ['id', 'name'],
    },
    responseSchema: wrap('diagram', 'Diagram'),
    statuses: [201, 400, 401, 403, 410, 413],
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
    statuses: [200, 401, 404, 410],
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
        name: nameField,
        tabIds: { type: 'array', items: { type: 'string' } },
      },
    },
    responseSchema: wrap('diagram', 'Diagram'),
    statuses: [200, 400, 401, 403, 404, 410],
  },
  {
    method: 'DELETE',
    path: '/diagrams/{id}',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary:
      'Move a diagram to the Trash, restorable for 30 days. With permanent=true, delete it for good. 410 when it is already in the Trash (without permanent).',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    query: [
      {
        name: 'permanent',
        required: false,
        description:
          '"true" deletes the diagram for good instead of moving it to the Trash; also purges one already in the Trash.',
      },
    ],
    statuses: [204, 401, 403, 404, 410],
  },
  {
    method: 'GET',
    path: '/diagrams/{id}/shared-tabs',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary: 'Count the tabs a delete would leave in other diagrams.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: wrap('sharedTabs', 'SharedTabsSummary'),
    statuses: [200, 400, 401, 403, 404, 410],
  },
  {
    method: 'POST',
    path: '/diagrams/{id}/copy',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary: "Duplicate a diagram into the caller's files.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: { type: 'object', properties: { name: nameField } },
    responseSchema: wrap('diagram', 'Diagram'),
    statuses: [201, 401, 403, 404, 410],
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
    statuses: [204, 400, 401, 403, 404, 410],
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
    statuses: [200, 401, 403, 404, 410],
  },
  {
    method: 'PUT',
    path: '/diagrams/{id}/tabs/{tabId}',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary: `Create or replace one tab and its elements. A new or changed tab name is stored shortened to ${NAME_MAX_LENGTH} characters.`,
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: 'Tab',
    responseSchema: wrap('tab', 'Tab'),
    statuses: [200, 400, 401, 403, 404, 409, 410, 413],
  },
  {
    method: 'DELETE',
    path: '/diagrams/{id}/tabs/{tabId}',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary: 'Delete one tab from a diagram.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404, 410],
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
    statuses: [201, 400, 401, 403, 404, 410],
  },
  {
    method: 'DELETE',
    path: '/diagrams/{id}/tabs/{tabId}/comments/{commentId}',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary: 'Delete a comment.',
    auth: 'guest-or-clerk',
    statuses: [204, 401, 403, 404, 410],
  },
  {
    method: 'POST',
    path: '/diagrams/{id}/tabs/{tabId}/qa',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary:
      'Apply one action to a Q&A board element. Readers may add and vote; running the board needs edit access. The voter and author are derived from the caller, never read from the body.',
    auth: 'guest-or-clerk',
    requestSchema: {
      type: 'object',
      properties: {
        elementId: { type: 'string' },
        action: {
          type: 'object',
          description:
            'One of: add { id, text, anonymous }; vote { noteId, on }; discuss { noteId | null }; done, reopen or remove { noteId }; clear.',
          properties: {
            type: { enum: ['add', 'vote', 'discuss', 'done', 'reopen', 'remove', 'clear'] },
            id: { type: 'string' },
            text: { type: 'string' },
            anonymous: { type: 'boolean' },
            noteId: { type: ['string', 'null'] },
            on: { type: 'boolean' },
          },
          required: ['type'],
        },
      },
      required: ['elementId', 'action'],
    },
    responseSchema: {
      type: 'object',
      properties: {
        notes: { type: 'array', items: ref('QaNote') },
        rev: { type: 'integer' },
        voterId: { type: 'string' },
      },
      required: ['notes', 'rev', 'voterId'],
    },
    statuses: [200, 400, 401, 403, 404, 409, 410, 413],
  },
  {
    method: 'POST',
    path: '/diagrams/{id}/tabs/{tabId}/link',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary: 'Add (link) an existing tab into this diagram.',
    auth: 'guest-or-clerk',
    responseSchema: wrap('tab', 'TabSummary'),
    statuses: [200, 401, 403, 404, 410],
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
    statuses: [200, 401, 403, 404, 410],
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
      properties: {
        role: ref('ShareRole'),
        expiry: ref('ShareLinkExpiry'),
        tabId: { type: ['string', 'null'] },
      },
      required: ['role'],
    },
    responseSchema: wrap('link', 'ShareLink'),
    statuses: [201, 400, 401, 403, 404, 410],
  },
  {
    method: 'DELETE',
    path: '/diagrams/{id}/share',
    segment: 'diagrams',
    tag: 'Sharing',
    summary: 'Revoke all share links for a diagram.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [200, 401, 403, 404, 410],
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
    statuses: [200, 400, 401, 403, 404, 410],
  },
  {
    method: 'DELETE',
    path: '/diagrams/{id}/share/{code}',
    segment: 'diagrams',
    tag: 'Sharing',
    summary: 'Revoke one share link by its code.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404, 410],
  },
  {
    method: 'PUT',
    path: '/diagrams/{id}/share/{code}',
    segment: 'diagrams',
    tag: 'Sharing',
    summary: 'Change which tabs a share link opens: one tab, or null for all.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: { tabId: { type: ['string', 'null'] } },
      required: ['tabId'],
    },
    responseSchema: wrap('link', 'ShareLink'),
    statuses: [200, 400, 401, 403, 404, 410],
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
    statuses: [200, 400, 401, 403, 404, 410],
  },
  {
    method: 'GET',
    path: '/diagrams/{id}/thumbnail',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary:
      "The diagram's cached SVG snapshot (a tab-scoped share visitor gets their tab). Read-gated like GET /diagrams/{id}; 404 when there is no snapshot.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    query: [{ name: 'v', required: false, description: 'Cache-buster (the savedAt stamp).' }],
    responseSchema: { type: 'string' },
    responseMediaType: 'image/svg+xml',
    statuses: [200, 404],
  },
  {
    method: 'POST',
    path: '/diagrams/{id}/room-ticket',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary:
      'Mint a one-time ticket for opening the realtime room: pass it to the WebSocket upgrade as `?t=`. Same access policy as a read, share password included. Exempt from the write rate limit.',
    auth: 'guest-or-clerk',
    responseSchema: {
      type: 'object',
      properties: { ticket: { type: 'string' } },
      required: ['ticket'],
    },
    statuses: [200, 404, 410],
  },
  {
    method: 'GET',
    path: '/diagrams/{id}/ws',
    segment: 'diagrams',
    tag: 'Diagrams',
    summary:
      'WebSocket upgrade to the realtime room. The op protocol is documented in docs/specs/015-api/api.md, not here.',
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
    statuses: [200, 401, 403, 404, 410],
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
    statuses: [201, 400, 401, 403, 404, 409, 410, 413],
  },
  {
    method: 'DELETE',
    path: '/diagrams/{id}/log/{entryId}',
    segment: 'diagrams',
    tag: 'Activity',
    summary: 'Delete one change-log entry.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404, 410],
  },
  {
    method: 'DELETE',
    path: '/diagrams/{id}/log/tab/{tabId}',
    segment: 'diagrams',
    tag: 'Activity',
    summary: "Clear a tab's change-log entries.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404, 410],
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
    statuses: [200, 400, 401, 403, 409, 413, 415, 503],
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
      properties: {
        diagram: ref('Diagram'),
        role: ref('ShareRole'),
        tabId: { type: ['string', 'null'] },
      },
      required: ['diagram', 'role', 'tabId'],
    },
    statuses: [200, 401, 403, 404, 410],
  },
  {
    method: 'GET',
    path: '/share/{code}/image.svg',
    segment: 'share',
    tag: 'Sharing',
    summary:
      'Live image: the shared diagram as SVG, embeddable by a bare <img>. Public by share code; a password-protected share has no image.',
    auth: 'public',
    query: [
      {
        name: 'tab',
        required: false,
        description: "Tab id; defaults to the first tab (or the link's own tab).",
      },
    ],
    responseSchema: { type: 'string' },
    responseMediaType: 'image/svg+xml',
    statuses: [200, 404, 410],
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

  // ---- Favourites (docs/specs/013-workspace/favourites.md) ----
  {
    method: 'GET',
    path: '/favourites',
    segment: 'favourites',
    tag: 'Account',
    summary: 'The diagram ids the caller has starred, newest first.',
    auth: 'guest-or-clerk',
    responseSchema: {
      type: 'object',
      properties: { ids: { type: 'array', items: { type: 'string' } } },
    },
    statuses: [200, 401],
  },
  {
    method: 'PUT',
    path: '/favourites/{diagramId}',
    segment: 'favourites',
    tag: 'Account',
    summary: 'Star a diagram for the caller. Idempotent.',
    auth: 'guest-or-clerk',
    statuses: [204, 401],
  },
  {
    method: 'DELETE',
    path: '/favourites/{diagramId}',
    segment: 'favourites',
    tag: 'Account',
    summary: 'Un-star a diagram for the caller.',
    auth: 'guest-or-clerk',
    statuses: [204, 401],
  },

  // ---- Trash (docs/specs/013-workspace/trash.md) ----
  {
    method: 'GET',
    path: '/trash',
    segment: 'trash',
    tag: 'Trash',
    summary:
      'The diagrams the caller may restore: their personal Trash and every joined team Trash, newest first.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: listOf('trash', 'TrashedDiagram'),
    statuses: [200, 400, 401],
  },
  {
    method: 'DELETE',
    path: '/trash',
    segment: 'trash',
    tag: 'Trash',
    summary: 'Empty the personal Trash, or one team Trash with team=<id> (joined members only).',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    query: [{ name: 'team', required: false, description: 'Empty this team Trash instead.' }],
    responseSchema: {
      type: 'object',
      properties: { purged: { type: 'number' } },
      required: ['purged'],
    },
    statuses: [200, 400, 401, 404],
  },
  {
    method: 'POST',
    path: '/trash/{id}/restore',
    segment: 'trash',
    tag: 'Trash',
    summary:
      'Restore a diagram from the Trash to its folder, or Unsorted when that folder is gone.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: wrap('diagram', 'Diagram'),
    statuses: [200, 400, 401, 404],
  },
  {
    method: 'DELETE',
    path: '/trash/{id}',
    segment: 'trash',
    tag: 'Trash',
    summary: 'Delete a diagram in the Trash for good.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 400, 401, 404],
  },

  // ---- Timeline (docs/specs/013-workspace/timeline.md) ----
  {
    method: 'GET',
    path: '/timeline',
    segment: 'timeline',
    tag: 'Account',
    summary: "The caller's activity feed, newest first. Keyset-paginated via nextCursor.",
    auth: 'guest-or-clerk',
    responseSchema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { $ref: '#/components/schemas/TimelineEvent' } },
        nextCursor: { type: 'string' },
        lastSeenAt: { type: 'number' },
      },
    },
    statuses: [200, 400, 401, 403],
  },
  {
    method: 'GET',
    path: '/timeline/unread',
    segment: 'timeline',
    tag: 'Account',
    summary: "Count of other people's events since the caller last read their feed (capped at 99).",
    auth: 'guest-or-clerk',
    responseSchema: { type: 'object', properties: { count: { type: 'number' } } },
    statuses: [200, 400, 401],
  },
  {
    method: 'POST',
    path: '/timeline/refresh',
    segment: 'timeline',
    tag: 'Account',
    summary: 'Seed the feed on first use and mark it seen. Throttled to once every 5s.',
    auth: 'guest-or-clerk',
    responseSchema: { type: 'object', properties: { lastSeenAt: { type: 'number' } } },
    statuses: [200, 400, 401],
  },
  {
    method: 'DELETE',
    path: '/timeline/events/{id}',
    segment: 'timeline',
    tag: 'Account',
    summary:
      "Remove one event from the caller's own feed. Other readers of the same event keep it. 404 when the feed never held it.",
    auth: 'guest-or-clerk',
    statuses: [204, 401, 404],
  },
  {
    method: 'POST',
    path: '/timeline/events/dismiss',
    segment: 'timeline',
    tag: 'Account',
    summary:
      "Remove several events (a whole stack) from the caller's own feed in one call. Up to 200 ids; unknown ids are ignored.",
    auth: 'guest-or-clerk',
    requestSchema: {
      type: 'object',
      required: ['ids'],
      properties: { ids: { type: 'array', items: { type: 'string' } } },
    },
    responseSchema: { type: 'object', properties: { dismissed: { type: 'number' } } },
    statuses: [200, 400, 401],
  },

  // ---- Activity (docs/specs/013-workspace/activity-page.md) ----
  {
    method: 'GET',
    path: '/activity',
    segment: 'activity',
    tag: 'Account',
    summary:
      'What is outstanding for the caller across every diagram they can open: open actions assigned to them or by them, and unresolved comment threads they are in. Capped at 100 per kind, newest first.',
    auth: 'guest-or-clerk',
    responseSchema: {
      type: 'object',
      properties: {
        actions: { type: 'array', items: { $ref: '#/components/schemas/ActivityAction' } },
        threads: { type: 'array', items: { $ref: '#/components/schemas/ActivityThread' } },
      },
      required: ['actions', 'threads'],
    },
    statuses: [200, 400, 401],
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
    method: 'GET',
    path: '/teams/{id}/access-check',
    segment: 'teams',
    tag: 'Teams',
    summary:
      'Whether a joined teammate can open a diagram the caller can access (docs/specs/012-collaboration/assigned-actions.md): owner, team-library member, or prior share-link visitor.',
    auth: 'clerk',
    responseSchema: {
      type: 'object',
      properties: { canAccess: { type: 'boolean' } },
      required: ['canAccess'],
    },
    statuses: [200, 400, 401, 403, 404],
  },
  {
    method: 'POST',
    path: '/teams/{id}/notify-action',
    segment: 'teams',
    tag: 'Teams',
    summary:
      'Email a joined teammate that an action on a diagram element was assigned to them (docs/specs/012-collaboration/assigned-actions.md). Best-effort; the assignee may have opted out.',
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
    path: '/teams/{id}/notify-mention',
    segment: 'teams',
    tag: 'Teams',
    summary:
      "Email the teammates a comment just @-mentioned (docs/specs/012-collaboration/comment-mentions.md). The diagram must be in this team's library; each mention must be a member of the team. Best-effort; a recipient may have opted out.",
    auth: 'clerk',
    requestSchema: {
      type: 'object',
      properties: {
        diagramId: { type: 'string' },
        commentText: { type: 'string' },
        mentions: {
          type: 'array',
          items: {
            type: 'object',
            properties: { userId: { type: 'string' }, memberId: { type: 'string' } },
          },
        },
      },
      required: ['diagramId', 'commentText', 'mentions'],
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
  {
    method: 'POST',
    path: '/ai/read-notes',
    segment: 'ai',
    tag: 'AI',
    summary: 'Read the handwriting on sticky-note crops cut from a wall photo.',
    auth: 'guest-or-clerk',
    requestSchema: 'ReadNotesRequest',
    responseSchema: 'ReadNotesResponse',
    statuses: [200, 400, 401, 403, 413, 429, 502, 503],
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
    // The route also honours an `X-Internal-Events-Key` header that exempts
    // our own workers from the per-IP rate limiter (docs/specs/017-telemetry/telemetry.md). Deliberately
    // NOT documented here: the public spec describes what a public caller
    // can use, and advertising the bypass header would only invite guessing
    // at the secret. Its absence is a choice, not an oversight.
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
