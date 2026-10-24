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

import {
  LINT_VIEW_NAME,
  TAB_VIEW_NAMES,
  TEAM_RECENT_INCLUDE,
  TEAM_RECENT_LIMIT,
} from '@livediagram/api-schema';
import { NAME_MAX_LENGTH } from '@livediagram/document';
import { FIND_QUERY_MAX_LENGTH, VIEW_BUDGET_MAX } from '@livediagram/document-views';
import type { BodySchema } from './types';

/** How a caller authenticates (docs/specs/014-identity/auth-and-guest-access.md):
 *  - `public`: no identity required.
 *  - `guest-or-clerk`: a Bearer credential: an account access token, a guest token or an API token.
 *  - `clerk`: an account access token or an API token; guests are rejected. */
export type AuthMode = 'public' | 'guest-or-clerk' | 'clerk';

interface QueryParam {
  name: string;
  required: boolean;
  description: string;
}

export interface RouteSpec {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Path template under the server base, e.g. `/documents/{id}/tabs/{tabId}`. */
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
  /** An old address still served for clients that predate a rename; documented so they are not
   *  surprised, marked so nobody new calls it. */
  deprecated?: boolean;
  query?: QueryParam[];
  requestSchema?: BodySchema;
  responseSchema?: BodySchema;
  /** Media type of the success body. Defaults to `application/json`; the SVG
   *  snapshot endpoints answer `image/svg+xml`. */
  responseMediaType?: string;
  /** A plain-text form of the success body beside the JSON one (a document view). */
  textResponse?: { description: string };
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
// A document name field: the worker shortens it to the name cap rather than
// rejecting it (docs/specs/006-document/name-length.md).
const nameField = {
  type: 'string',
  description:
    `At most ${NAME_MAX_LENGTH} characters; a longer name is stored shortened at a word boundary ` +
    'with an ellipsis, and whitespace runs collapse to one space.',
};
// The document views' query (docs/specs/024-agents/document-views.md): `view` turns the plain read into a
// view, text by default.
const VIEW_COMMON_QUERY = [
  { name: 'view', required: false, description: 'A view instead of the plain read.' },
  {
    name: 'json',
    required: false,
    description: '`1` answers the view as JSON (`OutlineView`, `GraphView`, …) instead of text.',
  },
  {
    name: 'budget',
    required: false,
    description: `Fit the view to this many tokens (characters ÷ 3), 1 to ${VIEW_BUDGET_MAX}; what it leaves out is named on its last line.`,
  },
  {
    name: 'door',
    required: false,
    description: '`cli` (default) or `mcp`: the syntax of the command the last line names.',
  },
];
const TAB_VIEW_QUERY = [
  {
    ...VIEW_COMMON_QUERY[0]!,
    description: `A view instead of the plain read: ${[...TAB_VIEW_NAMES, LINT_VIEW_NAME].join(', ')}. \`lint\` (the diagram lint) takes only \`json\`.`,
  },
  ...VIEW_COMMON_QUERY.slice(1),
  {
    name: 'only',
    required: false,
    description:
      'outline, layout: one element (a ref, unique prefix or id) and what nests under it.',
  },
  {
    name: 'coarse',
    required: false,
    description: 'layout: `1` for rows per container instead of geometry.',
  },
  {
    name: 'style',
    required: false,
    description: 'outline: `1` adds the non-default style attributes.',
  },
  {
    name: 'ref',
    required: false,
    description: 'show (required): the element, by ref, unique prefix or id.',
  },
  {
    name: 'q',
    required: false,
    description: `find (required): the text to look for, 1 to ${FIND_QUERY_MAX_LENGTH} characters.`,
  },
  { name: 'all', required: false, description: 'comments: `1` adds resolved threads.' },
];
const DOCUMENT_VIEW_QUERY = [
  {
    ...VIEW_COMMON_QUERY[0]!,
    description:
      '`overview`: one line per tab, its counts and revision, instead of the plain read.',
  },
  ...VIEW_COMMON_QUERY.slice(1),
];

const wrap = (key: string, name: string): BodySchema => ({
  type: 'object',
  properties: { [key]: ref(name) },
  required: [key],
});

// The gallery's search parameters, shared by the public list and My Shares (docs/specs/025-community/community.md
// "Gallery"): every filter can also be a word in `q` (`#tag`, `category:`, `sort:`, `is:mine`).
const COMMUNITY_QUERY = [
  {
    name: 'q',
    required: false,
    description:
      'Search words: plain terms (title, description, tags), `#tag`, `category:<id>`, `sort:loved|copied`.',
  },
  { name: 'category', required: false, description: 'One category id.' },
  { name: 'tag', required: false, description: 'One tag.' },
  { name: 'sort', required: false, description: '`new` (default), `loved` or `copied`.' },
  { name: 'offset', required: false, description: 'From `nextOffset`.' },
] as const;

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

  // ---- Catalogues (docs/specs/015-api/blueprints/cli.md "Catalogue routes") ----
  {
    method: 'GET',
    path: '/templates',
    segment: 'templates',
    tag: 'Catalogues',
    summary:
      'The template library: its categories and one entry a template, as list_templates gives them.',
    auth: 'public',
    responseSchema: 'TemplateCatalogueResponse',
    statuses: [200, 405],
  },
  {
    method: 'GET',
    path: '/templates/{kind}',
    segment: 'templates',
    tag: 'Catalogues',
    summary:
      'One template, built and read as an outline view; json=1 for the view as JSON. Unknown: 404 unknown_template with the kinds.',
    auth: 'public',
    query: [{ name: 'json', required: false, description: '1 for the outline as JSON.' }],
    responseMediaType: 'text/plain',
    responseSchema: { type: 'string' },
    statuses: [200, 404, 405],
  },
  {
    method: 'GET',
    path: '/icons',
    segment: 'icons',
    tag: 'Catalogues',
    summary:
      'Icons from the line-art and Technology catalogues for a query, best first, as the palette ranks them.',
    auth: 'public',
    query: [
      { name: 'query', required: true, description: '1 to 60 characters.' },
      { name: 'limit', required: false, description: '1 to 50; 20 by default.' },
    ],
    responseSchema: 'IconSearchResponse',
    statuses: [200, 400, 405],
  },
  {
    method: 'GET',
    path: '/schema',
    segment: 'schema',
    tag: 'Catalogues',
    summary: 'The element kinds edit operations make, one line each.',
    auth: 'public',
    responseMediaType: 'text/plain',
    responseSchema: { type: 'string' },
    statuses: [200, 405],
  },
  {
    method: 'GET',
    path: '/schema/{kind}',
    segment: 'schema',
    tag: 'Catalogues',
    summary:
      'One kind: its first size, the aliases set takes with their values, and its stored fields. Unknown: 404 unknown_kind with the kinds.',
    auth: 'public',
    responseMediaType: 'text/plain',
    responseSchema: { type: 'string' },
    statuses: [200, 404, 405],
  },

  // ---- Documents ----
  {
    method: 'GET',
    path: '/documents',
    segment: 'documents',
    tag: 'Documents',
    summary: "List the caller's documents (metadata only, no tab contents).",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    query: [
      {
        name: 'include',
        required: false,
        description: `${TEAM_RECENT_INCLUDE} adds \`teamRecent\`: the ${TEAM_RECENT_LIMIT} newest non-empty documents of the teams the caller has joined, newest first, each with its \`teamName\`.`,
      },
    ],
    responseSchema: {
      type: 'object',
      properties: {
        documents: { type: 'array', items: ref('DocumentSummary') },
        teamRecent: {
          type: 'array',
          items: {
            allOf: [
              ref('DocumentSummary'),
              {
                type: 'object',
                properties: { teamName: { type: 'string' } },
                required: ['teamName'],
              },
            ],
          },
        },
      },
      required: ['documents'],
    },
    statuses: [200, 401],
  },
  {
    method: 'POST',
    path: '/documents',
    segment: 'documents',
    tag: 'Documents',
    summary:
      'Create a document, optionally seeding it with tabs and filing it in a team and/or folder. ' +
      'An invalid placement refuses the whole create by name (placement_invalid, team_forbidden, ' +
      'folder_not_found, folder_scope_mismatch) or a malformed intent (intent_invalid); nothing is ' +
      'written.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: nameField,
        tabs: {
          type: 'array',
          description:
            'The tabs to seed. A tab may give `graph`, `mermaid` or `template` in place of `elements`, compiled ' +
            'by the edit-operations engine; a tab it refuses refuses the create (422, with `tabId`).',
          items: {
            anyOf: [
              ref('Tab'),
              {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  theme: { type: 'string' },
                  graph: { type: 'object' },
                  mermaid: { type: 'string' },
                  template: { type: 'string' },
                },
                required: ['id'],
              },
            ],
          },
        },
        source: {
          anyOf: [ref('DocumentSource'), { type: 'null' }],
          description: 'The agent front door that made it; `ai` and `mcp` count as Made by AI.',
        },
        // Placement (docs/specs/013-workspace/folders.md "Placement on create").
        teamId: {
          type: ['string', 'null'],
          description:
            "The team library to file into; absent or null = the caller's My Work. " +
            'Requires a signed-in caller (or API token) who has joined the team.',
        },
        folderId: {
          type: ['string', 'null'],
          description:
            "A folder of the chosen space. null, present, is that space's root chosen on " +
            'purpose; absent with no teamId is no choice, where a default folder may answer.',
        },
        // The creation intent (docs/specs/013-workspace/default-folders.md).
        intent: {
          type: ['object', 'null'],
          description:
            'What the new document is made as, recorded on it (opensIn, tabKind, templateFamily). ' +
            "With no choice of place, the document lands in the caller's default folder for it: " +
            'the tab kind default, else the template family default, else the mode default, else ' +
            'the root of My Work. Malformed: intent_invalid (400).',
          properties: {
            mode: ref('EditorMode'),
            tabKind: { anyOf: [ref('CreationTabKind'), { type: 'null' }] },
            templateFamily: { anyOf: [ref('TemplateFamily'), { type: 'null' }] },
          },
          required: ['mode'],
        },
        // The document's own dates, ms since the epoch (docs/specs/015-api/api.md "Document dates").
        createdAt: { type: 'integer' },
        savedAt: { type: 'integer' },
        // Making a document is a use (docs/specs/015-api/api.md "Marking a document used").
        markUsed: {
          type: 'boolean',
          description:
            'Whether making the document counts as a use of it for the caller, so it joins their ' +
            'Jump back in at once. Default true; send false when making many documents in one go ' +
            '(the editor does for an import of more than one), so they wait until opened. Not a ' +
            'boolean: 400 invalid markUsed.',
        },
      },
      required: ['id', 'name'],
    },
    responseSchema: wrap('document', 'Document'),
    statuses: [201, 400, 401, 403, 404, 410, 413, 422],
  },
  {
    method: 'GET',
    path: '/documents/{id}',
    segment: 'documents',
    tag: 'Documents',
    summary:
      'Get a document (metadata + tab summaries; tab contents fetched separately), or with `view=overview` one line per tab.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    query: DOCUMENT_VIEW_QUERY,
    responseSchema: wrap('document', 'Document'),
    textResponse: { description: 'With `view=overview`: the document and one line per tab.' },
    statuses: [200, 400, 401, 404, 410],
  },
  {
    method: 'PUT',
    path: '/documents/{id}',
    segment: 'documents',
    tag: 'Documents',
    summary: 'Update a document name and/or tab order.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: {
        name: nameField,
        tabIds: { type: 'array', items: { type: 'string' } },
      },
    },
    responseSchema: wrap('document', 'Document'),
    statuses: [200, 400, 401, 403, 404, 410],
  },
  {
    method: 'DELETE',
    path: '/documents/{id}',
    segment: 'documents',
    tag: 'Documents',
    summary:
      'Move a document to the Trash, restorable for 30 days. With permanent=true, delete it for good. 410 when it is already in the Trash (without permanent).',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    query: [
      {
        name: 'permanent',
        required: false,
        description:
          '"true" deletes the document for good instead of moving it to the Trash; also purges one already in the Trash.',
      },
    ],
    statuses: [204, 401, 403, 404, 410],
  },
  {
    method: 'GET',
    path: '/documents/{id}/shared-tabs',
    segment: 'documents',
    tag: 'Documents',
    summary: 'Count the tabs a delete would leave in other documents.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: wrap('sharedTabs', 'SharedTabsSummary'),
    statuses: [200, 400, 401, 403, 404, 410],
  },
  {
    method: 'GET',
    path: '/documents/{id}/tabs',
    segment: 'documents',
    tag: 'Documents',
    summary:
      "The canvas's tabs alone, in order: id, name and kind, without their content. Read-gated like GET /documents/{id}; a tab's share link sees its own tab alone. What the Share dialog's tab picker reads.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: {
      type: 'object',
      properties: {
        tabs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              kind: { type: ['string', 'null'] },
            },
            required: ['id', 'name', 'kind'],
          },
        },
      },
      required: ['tabs'],
    },
    statuses: [200, 404],
  },
  {
    method: 'POST',
    path: '/documents/{id}/copy',
    segment: 'documents',
    tag: 'Documents',
    summary: "Duplicate a document into the caller's files.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: { type: 'object', properties: { name: nameField } },
    responseSchema: wrap('document', 'Document'),
    statuses: [201, 401, 403, 404, 410],
  },
  {
    method: 'GET',
    path: '/documents/{id}/tabs/{tabId}',
    segment: 'documents',
    tag: 'Documents',
    summary:
      'Get the full contents (elements) of one tab, with its revision (`rev`, also the weak `ETag`): what a changeset base names.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    query: TAB_VIEW_QUERY,
    responseSchema: wrap('tab', 'TabRecord'),
    textResponse: {
      description:
        'With `view`: the tab as text, its first line the header with `rev`. A ref that names nothing is 404 `target_not_found`, several 400 `target_ambiguous`, each with candidates (`RefErrorBody`).',
    },
    statuses: [200, 400, 401, 403, 404, 410],
  },
  {
    method: 'PUT',
    path: '/documents/{id}/tabs/{tabId}',
    segment: 'documents',
    tag: 'Documents',
    summary: `The editor's whole-tab save: create or replace one tab and its elements, merged with every changeset the editor had not seen (\`X-Changeset-Seen\`). An API token is refused with 405 \`use_changesets\`: scripts and agents write tabs with changesets. A new or changed tab name is stored shortened to ${NAME_MAX_LENGTH} characters.`,
    auth: 'guest-or-clerk',
    requestSchema: 'Tab',
    responseSchema: wrap('tab', 'TabRecord'),
    statuses: [200, 400, 401, 403, 404, 405, 409, 410, 413],
  },
  {
    method: 'POST',
    path: '/documents/{id}/tabs/{tabId}/changesets',
    segment: 'documents',
    tag: 'Changesets',
    summary:
      'Change one tab with a changeset: ordered edit operations or one replace, applied atomically, shown live to everyone with the tab open, credited to you and revertable. Pass the base you read (rev and element fingerprints) to refuse a write over a change made since. A whole-tab replace on a tab id the document lacks creates that tab.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    query: [
      { name: 'dryRun', required: false, description: '1: answer the plan without writing.' },
    ],
    requestSchema: 'ChangesetRequest',
    responseSchema: 'ChangesetResponse',
    statuses: [200, 400, 401, 403, 404, 409, 410, 412, 413, 422],
  },
  {
    method: 'GET',
    path: '/documents/{id}/changesets',
    segment: 'documents',
    tag: 'Changesets',
    summary: "A document's changesets, newest first.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    query: [
      { name: 'tab', required: false, description: 'Only this tab.' },
      { name: 'limit', required: false, description: 'At most this many, 1 to 100 (default 20).' },
    ],
    responseSchema: listOf('changesets', 'ChangesetSummary'),
    statuses: [200, 400, 401, 404, 410],
  },
  {
    method: 'GET',
    path: '/documents/{id}/changesets/{changesetId}',
    segment: 'documents',
    tag: 'Changesets',
    summary: 'One changeset, with the result lines it answered.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: 'ChangesetDetail',
    statuses: [200, 401, 404, 410],
  },
  {
    method: 'POST',
    path: '/documents/{id}/changesets/{changesetId}/revert',
    segment: 'documents',
    tag: 'Changesets',
    summary:
      'Revert a changeset: its inverse, applied as a new changeset by you. Elements changed since are kept as they are and listed. Possible for 30 days after it landed, by anyone with edit access to the tab.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: 'RevertResponse',
    statuses: [200, 401, 403, 404, 409, 410, 413],
  },
  {
    method: 'PUT',
    path: '/documents/{id}/tabs/{tabId}/name',
    segment: 'documents',
    tag: 'Documents',
    summary: `Rename one tab. Advances the tab's revision and reaches everyone with the document open. Stored shortened to ${NAME_MAX_LENGTH} characters.`,
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: { type: 'object', properties: { name: nameField }, required: ['name'] },
    responseSchema: wrap('tab', 'TabSummary'),
    statuses: [200, 400, 401, 403, 404, 410],
  },
  {
    method: 'DELETE',
    path: '/documents/{id}/tabs/{tabId}',
    segment: 'documents',
    tag: 'Documents',
    summary: 'Delete one tab from a document.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404, 410],
  },
  {
    method: 'POST',
    path: '/documents/{id}/tabs/{tabId}/link',
    segment: 'documents',
    tag: 'Documents',
    summary:
      'Add to Document: share a tab another of your documents holds (`from`) with this one. Both keep the tab, and an edit in either reaches the other.',
    auth: 'guest-or-clerk',
    requestSchema: {
      type: 'object',
      properties: { from: { type: 'string' } },
      required: ['from'],
    },
    responseSchema: wrap('tab', 'TabRecord'),
    statuses: [200, 400, 401, 403, 404, 409],
  },
  {
    method: 'POST',
    path: '/documents/{id}/tabs/{tabId}/comments',
    segment: 'documents',
    tag: 'Documents',
    summary:
      'Add a comment to an element on a tab; an API token is recorded on it for the audit trail.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: { elementId: { type: 'string' }, text: { type: 'string' } },
      required: ['elementId', 'text'],
    },
    statuses: [201, 400, 401, 403, 404, 409, 410, 413],
  },
  {
    method: 'DELETE',
    path: '/documents/{id}/tabs/{tabId}/comments/{commentId}',
    segment: 'documents',
    tag: 'Documents',
    summary: 'Delete a comment you wrote.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404, 409, 410, 413],
  },
  {
    method: 'POST',
    path: '/documents/{id}/tabs/{tabId}/comments/{commentId}/reply',
    segment: 'documents',
    tag: 'Documents',
    summary: 'Reply on the thread that holds a comment; it reopens a resolved thread.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
    statuses: [201, 400, 401, 403, 404, 409, 410, 413],
  },
  {
    method: 'POST',
    path: '/documents/{id}/tabs/{tabId}/comments/{commentId}/resolve',
    segment: 'documents',
    tag: 'Documents',
    summary:
      'Resolve the thread that holds a comment; resolving a resolved thread changes nothing.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404, 405, 409, 410, 413],
  },
  {
    method: 'POST',
    path: '/documents/{id}/tabs/{tabId}/comments/{commentId}/reopen',
    segment: 'documents',
    tag: 'Documents',
    summary: 'Reopen the thread that holds a comment; reopening an open thread changes nothing.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404, 405, 409, 410, 413],
  },
  {
    method: 'GET',
    path: '/documents/{id}/tabs/{tabId}/render.svg',
    segment: 'documents',
    tag: 'Documents',
    summary:
      'One tab drawn by the shared renderer (images inlined when the host stores them). Read-gated like the tab; never cached.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: { type: 'string' },
    responseMediaType: 'image/svg+xml',
    statuses: [200, 401, 403, 404, 410],
  },
  {
    method: 'PUT',
    path: '/documents/{id}/tabs/{tabId}/presence',
    segment: 'documents',
    tag: 'Documents',
    summary:
      "An agent's presence on a tab: a status line (up to 80 characters), focus (up to 20 refs) and a ttl (1 to 120 seconds; 30 by default). API tokens only; shown as the token's owner.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        focus: { type: 'array', items: { type: 'string' } },
        ttl: { type: 'integer' },
      },
    },
    responseSchema: wrap('presence', 'AgentPresenceResult'),
    statuses: [200, 400, 401, 403, 404, 409, 410, 503],
  },
  {
    method: 'DELETE',
    path: '/documents/{id}/tabs/{tabId}/presence',
    segment: 'documents',
    tag: 'Documents',
    summary: "Clear an agent's presence on a tab; 204 whether or not it was there.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404, 410, 503],
  },
  {
    method: 'GET',
    path: '/documents/{id}/comments',
    segment: 'documents',
    tag: 'Documents',
    summary:
      "The comment threads across the document, in tab and outline order, with each element's ref and label. status=open (default), resolved or all.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    query: [{ name: 'status', required: false, description: 'open (default), resolved or all.' }],
    responseSchema: listOf('threads', 'DocumentCommentThread'),
    statuses: [200, 400, 401, 403, 404, 405, 410],
  },
  {
    method: 'POST',
    path: '/documents/{id}/tabs/{tabId}/qa',
    segment: 'documents',
    tag: 'Documents',
    summary:
      "Apply one action to a Q&A board element. Readers may add and vote; running the board needs edit access. The voter and author are derived from the caller, never read from the body. A guest's upvote answers 429 vote_limit once its network holds the most guest voters the document takes.",
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
    statuses: [200, 400, 401, 403, 404, 409, 410, 413, 429],
  },
  {
    method: 'POST',
    path: '/documents/{id}/share',
    segment: 'documents',
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
    method: 'GET',
    path: '/documents/{id}/community',
    segment: 'documents',
    tag: 'Community',
    summary: "The document's Community post, in any state, or null (owner only).",
    auth: 'guest-or-clerk',
    responseSchema: {
      type: 'object',
      properties: { post: { anyOf: [ref('CommunityOwnPost'), { type: 'null' }] } },
      required: ['post'],
    },
    statuses: [200, 400, 401, 403, 404, 410, 502],
  },
  {
    method: 'PUT',
    path: '/documents/{id}/community',
    segment: 'documents',
    tag: 'Community',
    summary:
      'Publish the document to Community, or save its listing (signed-in owner; not a team document, not password protected).',
    auth: 'clerk',
    requestSchema: ref('CommunityPostInput'),
    responseSchema: wrap('post', 'CommunityOwnPost'),
    statuses: [200, 201, 400, 401, 403, 404, 409, 410, 502],
  },
  {
    method: 'DELETE',
    path: '/documents/{id}/community',
    segment: 'documents',
    tag: 'Community',
    summary: 'Remove the document from Community (owner only).',
    auth: 'guest-or-clerk',
    statuses: [204, 400, 401, 403, 404, 409, 410, 502],
  },
  {
    method: 'GET',
    path: '/documents/{id}/thumbnail',
    segment: 'documents',
    tag: 'Documents',
    summary:
      "The document's cached SVG snapshot (a tab-scoped share visitor gets their tab). Read-gated like GET /documents/{id}; 404 when there is no snapshot.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    query: [{ name: 'v', required: false, description: 'Cache-buster (the savedAt stamp).' }],
    responseSchema: { type: 'string' },
    responseMediaType: 'image/svg+xml',
    statuses: [200, 404],
  },
  {
    method: 'POST',
    path: '/documents/{id}/room-ticket',
    segment: 'documents',
    tag: 'Documents',
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
    path: '/documents/{id}/ws',
    segment: 'documents',
    tag: 'Documents',
    summary:
      'WebSocket upgrade to the realtime room. The op protocol is documented in docs/specs/015-api/api.md, not here.',
    auth: 'guest-or-clerk',
    query: [
      { name: 's', required: false, description: 'Share code, for non-owner collaborators.' },
      { name: 'o', required: false, description: 'Owner id (guest path).' },
      { name: 'p', required: false, description: 'Share password, when the document is gated.' },
    ],
    statuses: [101, 403, 404],
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
    summary:
      'Make a folder at the top of My Work, or inside another (`parentId`); inside a team’s folder it is the ' +
      'team’s (`teamId`). Made at the liveworkspace index as the caller.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Optional: a client-made UUID.' },
        name: { type: 'string' },
        parentId: { type: ['string', 'null'] },
        teamId: { type: ['string', 'null'] },
      },
      required: ['name'],
    },
    responseSchema: wrap('folder', 'Folder'),
    statuses: [201, 400, 401, 403, 404, 503],
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
    summary: 'Map each image to the documents that reference it.',
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
    query: [{ name: 'd', required: false, description: 'Document id, for share-code readers.' }],
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

  // ---- Shape libraries ----
  {
    method: 'GET',
    path: '/shape-libraries',
    segment: 'shape-libraries',
    tag: 'Shape libraries',
    summary: "List the caller's shape libraries, newest first.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: listOf('libraries', 'ShapeLibrary'),
    statuses: [200, 401],
  },
  {
    method: 'POST',
    path: '/shape-libraries',
    segment: 'shape-libraries',
    tag: 'Shape libraries',
    summary: 'Create a shape library; a name already in use is suffixed.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        source: { type: 'string', enum: ['drawio'] },
        items: { type: 'array', items: ref('ShapeLibraryItem') },
      },
      required: ['id', 'name', 'source', 'items'],
    },
    responseSchema: wrap('library', 'ShapeLibrary'),
    statuses: [201, 400, 401, 409, 413],
  },
  {
    method: 'PUT',
    path: '/shape-libraries/{id}',
    segment: 'shape-libraries',
    tag: 'Shape libraries',
    summary: 'Rename a shape library, or replace its items.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        items: { type: 'array', items: ref('ShapeLibraryItem') },
      },
    },
    responseSchema: wrap('library', 'ShapeLibrary'),
    statuses: [200, 400, 401, 404, 409, 413],
  },
  {
    method: 'DELETE',
    path: '/shape-libraries/{id}',
    segment: 'shape-libraries',
    tag: 'Shape libraries',
    summary: 'Delete a shape library. Placed shapes stay in their documents.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 404],
  },
  {
    method: 'GET',
    path: '/shape-libraries/{id}/previews',
    segment: 'shape-libraries',
    tag: 'Shape libraries',
    summary:
      'Every shape of one library drawn as an SVG, keyed by shape id, for an Explorer that cannot draw them itself.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: {
      type: 'object',
      properties: { previews: { type: 'object', additionalProperties: { type: 'string' } } },
      required: ['previews'],
    },
    statuses: [200, 401, 404],
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
    method: 'GET',
    path: '/tokens/current',
    segment: 'tokens',
    tag: 'API tokens',
    summary:
      "The token this request presented: its account, name, role and expiry (the CLI's auth status).",
    auth: 'clerk',
    tokenUsable: true,
    responseSchema: ref('CurrentTokenResponse'),
    statuses: [200, 401, 403, 404],
  },
  {
    method: 'DELETE',
    path: '/tokens/current',
    segment: 'tokens',
    tag: 'API tokens',
    summary:
      "Revoke the token this request presented; any token may revoke itself (the CLI's auth logout).",
    auth: 'clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404],
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

  // Every other Community read, and likes and reports, are the liveworkspace Community service's
  // (liveworkspace/docs/community.md), which the Community pages call directly.
  {
    method: 'GET',
    path: '/community/mine',
    segment: 'community',
    tag: 'Community',
    summary:
      "My Shares: the signed-in author's own posts (hidden ones included) under the same search words, with their totals.",
    auth: 'clerk',
    query: [...COMMUNITY_QUERY],
    responseSchema: ref('CommunityMineResponse'),
    statuses: [200, 400, 401, 404, 502],
  },
  {
    method: 'GET',
    path: '/share/{code}',
    segment: 'share',
    tag: 'Sharing',
    summary: 'Resolve a share code to a document and the granted role.',
    auth: 'public',
    query: [{ name: 'password', required: false, description: 'Required when the link is gated.' }],
    responseSchema: {
      type: 'object',
      properties: {
        document: ref('Document'),
        role: ref('ShareRole'),
        tabId: { type: ['string', 'null'] },
        community: ref('CommunityShareInfo'),
      },
      required: ['document', 'role', 'tabId'],
    },
    statuses: [200, 401, 403, 404, 410],
  },
  {
    method: 'GET',
    path: '/share/{code}/image.svg',
    segment: 'share',
    tag: 'Sharing',
    summary:
      'Live image: the shared document as SVG, embeddable by a bare <img>. Public by share code; a password-protected share has no image.',
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
  {
    method: 'GET',
    path: '/share/{code}/card',
    segment: 'share',
    tag: 'Sharing',
    summary:
      "A link preview's text: the shared document's name. 404 wherever the live image is (a dead code, a share password, a Community post that is not public).",
    auth: 'public',
    responseSchema: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
    statuses: [200, 404],
  },
  {
    method: 'GET',
    path: '/share/{code}/image.png',
    segment: 'share',
    tag: 'Sharing',
    summary:
      "A link preview's picture: the live image's drawing on a 1200 x 630 PNG card. Redirects to the brand card when there is nothing to draw.",
    auth: 'public',
    responseSchema: { type: 'string' },
    responseMediaType: 'image/png',
    statuses: [200, 302, 404],
  },

  // ---- Participants ----
  {
    method: 'GET',
    path: '/participants/{id}',
    segment: 'participants',
    tag: 'Participants',
    summary:
      "Get a participant's display name and colour. Your own id before you have saved a profile answers { participant: null }.",
    auth: 'public',
    responseSchema: {
      type: 'object',
      properties: { participant: { oneOf: [ref('ParticipantRecord'), { type: 'null' }] } },
      required: ['participant'],
    },
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
    summary:
      "Get the caller's editor preferences, kept with their liveworkspace account (null where this deployment keeps none).",
    auth: 'guest-or-clerk',
    responseSchema: {
      type: 'object',
      properties: { prefs: { oneOf: [{ type: 'object' }, { type: 'null' }] } },
    },
    statuses: [200, 401, 503],
  },
  {
    method: 'PUT',
    path: '/preferences',
    segment: 'preferences',
    tag: 'Account',
    summary:
      'Change editor preferences: each key named takes its value whole, null deletes it, and keys left out stay.',
    auth: 'guest-or-clerk',
    requestSchema: {
      type: 'object',
      properties: { prefs: { type: 'object' } },
      required: ['prefs'],
    },
    statuses: [204, 400, 401, 409, 413],
  },

  // ---- Trash (docs/specs/013-workspace/trash.md) ----
  {
    method: 'GET',
    path: '/trash',
    segment: 'trash',
    tag: 'Trash',
    summary:
      'The documents the caller may restore: their personal Trash and every joined team Trash, newest first.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: listOf('trash', 'TrashedDocument'),
    statuses: [200, 400, 401],
  },
  {
    method: 'DELETE',
    path: '/trash',
    segment: 'trash',
    tag: 'Trash',
    summary:
      'Empty the personal Trash of canvases, or one team Trash with team=<id> (joined members only).',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    query: [{ name: 'team', required: false, description: 'Empty this team Trash instead.' }],
    responseSchema: {
      type: 'object',
      properties: { purged: { type: 'number' } },
      required: ['purged'],
    },
    statuses: [200, 400, 401, 403, 404],
  },
  {
    method: 'POST',
    path: '/trash/{id}/restore',
    segment: 'trash',
    tag: 'Trash',
    summary:
      'Restore a document from the Trash to its folder, or the root of its space when that folder is gone.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: wrap('document', 'Document'),
    statuses: [200, 400, 401, 404],
  },
  {
    method: 'DELETE',
    path: '/trash/{id}',
    segment: 'trash',
    tag: 'Trash',
    summary: 'Delete a document in the Trash for good.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 400, 401, 404],
  },

  // ---- Account ----
  {
    method: 'DELETE',
    path: '/account',
    segment: 'account',
    tag: 'Account',
    summary: 'Delete the signed-in account and all of its data (documents, tokens, ...).',
    auth: 'clerk',
    responseSchema: { type: 'object', properties: { deleted: { type: 'number' } } },
    statuses: [204, 401],
  },

  // ---- Teams ----
  {
    method: 'GET',
    path: '/teams',
    segment: 'teams',
    tag: 'Teams',
    summary: "List the caller's teams.",
    auth: 'clerk',
    tokenUsable: true,
    responseSchema: listOf('teams', 'TeamListItem'),
    statuses: [200, 401],
  },
  {
    method: 'POST',
    path: '/teams',
    segment: 'teams',
    tag: 'Teams',
    summary:
      'Make a team on liveworkspace with you as its admin: the same team in every app, managed on liveworkspace.app.',
    auth: 'clerk',
    requestSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        organisation: { type: ['string', 'null'] },
      },
      required: ['name'],
    },
    responseSchema: wrap('team', 'Team'),
    statuses: [201, 400, 401, 409, 503],
  },
  {
    method: 'GET',
    path: '/teams/invites',
    segment: 'teams',
    tag: 'Teams',
    summary:
      'The team invitations waiting for you on liveworkspace.app, where they are answered. Empty when liveworkspace is out of reach.',
    auth: 'clerk',
    responseSchema: listOf('invites', 'TeamInvite'),
    statuses: [200, 401],
  },
  {
    method: 'GET',
    path: '/teams/{id}/members',
    segment: 'teams',
    tag: 'Teams',
    summary:
      "A team's joined and invited people (joined member), for the assignee picker and @-mentions. Not for API tokens.",
    auth: 'clerk',
    responseSchema: listOf('members', 'TeamMember'),
    statuses: [200, 401, 404],
  },
  {
    method: 'GET',
    path: '/teams/{id}/access-check',
    segment: 'teams',
    tag: 'Teams',
    summary:
      'Whether a joined teammate can open a document the caller can access (docs/specs/012-collaboration/assigned-actions.md): owner, team-library member, or prior share-link visitor.',
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
      'Email a joined teammate that an action on a document element was assigned to them (docs/specs/012-collaboration/assigned-actions.md). Best-effort; the assignee may have opted out.',
    auth: 'clerk',
    requestSchema: {
      type: 'object',
      properties: {
        assigneeUserId: { type: 'string' },
        documentId: { type: 'string' },
        actionName: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['assigneeUserId', 'documentId', 'actionName'],
    },
    statuses: [202, 400, 401, 403, 404],
  },
  {
    method: 'POST',
    path: '/teams/{id}/notify-mention',
    segment: 'teams',
    tag: 'Teams',
    summary:
      "Email the teammates a comment just @-mentioned (docs/specs/012-collaboration/comment-mentions.md). The document must be in this team's library; each mention must be a member of the team. Best-effort; a recipient may have opted out.",
    auth: 'clerk',
    requestSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string' },
        commentText: { type: 'string' },
        mentions: {
          type: 'array',
          items: {
            type: 'object',
            properties: { userId: { type: 'string' }, memberId: { type: 'string' } },
          },
        },
      },
      required: ['documentId', 'commentText', 'mentions'],
    },
    statuses: [202, 400, 401, 403, 404],
  },
  {
    method: 'GET',
    path: '/teams/{id}/library',
    segment: 'teams',
    tag: 'Teams',
    summary: "Get a team's shared folder tree and documents (joined member).",
    auth: 'clerk',
    tokenUsable: true,
    responseSchema: {
      type: 'object',
      properties: {
        folders: { type: 'array', items: ref('Folder') },
        documents: { type: 'array', items: ref('DocumentSummary') },
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

  // ---- Google Drive mirror (docs/specs/022-drive-mirror/drive-mirror.md) ----
  // Every route needs a Clerk SESSION: the guest header and API tokens are both
  // refused, and each answers 503 drive_not_configured when the deployment has
  // no GOOGLE_CLIENT_ID. First-party only; the mirror runs in the user's browser.
  {
    method: 'POST',
    path: '/drive/state',
    segment: 'drive',
    tag: 'Google Drive',
    summary:
      'Mint the signed consent `state` for a redirect URI (broker mode). Signed-in session only.',
    auth: 'clerk',
    requestSchema: {
      type: 'object',
      properties: { redirectUri: { type: 'string' } },
      required: ['redirectUri'],
    },
    responseSchema: {
      type: 'object',
      properties: { state: { type: 'string' } },
      required: ['state'],
    },
    statuses: [200, 400, 401, 503],
  },
  {
    method: 'POST',
    path: '/drive/connect',
    segment: 'drive',
    tag: 'Google Drive',
    summary:
      'Redeem a Google consent code: the refresh token is sealed and stored, never returned. Signed-in session only.',
    auth: 'clerk',
    requestSchema: {
      type: 'object',
      properties: { code: { type: 'string' }, state: { type: 'string' } },
      required: ['code', 'state'],
    },
    responseSchema: wrap('connection', 'DriveConnection'),
    statuses: [200, 400, 401, 502, 503],
  },
  {
    method: 'POST',
    path: '/drive/account-switch',
    segment: 'drive',
    tag: 'Google Drive',
    summary:
      'Confirm a pending switch to another Google account: the mirror state is cleared and the new account takes over. 409 drive_account_switch_expired when none is pending. Signed-in session only.',
    auth: 'clerk',
    responseSchema: wrap('connection', 'DriveConnection'),
    statuses: [200, 401, 409, 503],
  },
  {
    method: 'DELETE',
    path: '/drive/account-switch',
    segment: 'drive',
    tag: 'Google Drive',
    summary:
      'Cancel a pending switch to another Google account: its grant is revoked and the connection stays as it was. Signed-in session only.',
    auth: 'clerk',
    statuses: [204, 401, 503],
  },
  {
    method: 'POST',
    path: '/drive/token',
    segment: 'drive',
    tag: 'Google Drive',
    summary:
      'Mint a one-hour Google access token from the stored refresh token. 409 drive_needs_reconnect when Google revoked the grant; 429 drive_token_rate_limited past 10 a minute.',
    auth: 'clerk',
    responseSchema: 'DriveAccessToken',
    statuses: [200, 401, 404, 409, 429, 502, 503],
  },
  {
    method: 'GET',
    path: '/drive/connection',
    segment: 'drive',
    tag: 'Google Drive',
    summary: "The caller's Drive connection summary, or null.",
    auth: 'clerk',
    responseSchema: {
      type: 'object',
      properties: { connection: { oneOf: [ref('DriveConnection'), { type: 'null' }] } },
      required: ['connection'],
    },
    statuses: [200, 401, 503],
  },
  {
    method: 'PUT',
    path: '/drive/connection',
    segment: 'drive',
    tag: 'Google Drive',
    summary:
      'Record the mirror root folder and changes page token. In browser mode this also creates the connection.',
    auth: 'clerk',
    requestSchema: {
      type: 'object',
      properties: {
        rootFolderId: { type: ['string', 'null'] },
        pageToken: { type: 'string' },
      },
    },
    responseSchema: wrap('connection', 'DriveConnection'),
    statuses: [200, 400, 401, 404, 503],
  },
  {
    method: 'DELETE',
    path: '/drive/connection',
    segment: 'drive',
    tag: 'Google Drive',
    summary:
      'Disconnect: revoke the grant at Google and delete the stored token and mirror rows. Drive files stay.',
    auth: 'clerk',
    statuses: [204, 401, 503],
  },
  {
    method: 'GET',
    path: '/drive/items',
    segment: 'drive',
    tag: 'Google Drive',
    summary: "The caller's mirrored documents and folders with the Drive state last written.",
    auth: 'clerk',
    responseSchema: listOf('items', 'DriveItem'),
    statuses: [200, 401, 503],
  },
  {
    method: 'PUT',
    path: '/drive/items',
    segment: 'drive',
    tag: 'Google Drive',
    summary:
      'Upsert up to 100 mirrored items. 409 drive_item_conflict when a Drive file id is already held.',
    auth: 'clerk',
    requestSchema: listOf('items', 'DriveItem'),
    responseSchema: listOf('items', 'DriveItem'),
    statuses: [200, 400, 401, 404, 409, 503],
  },
  {
    method: 'DELETE',
    path: '/drive/items/{kind}/{ldId}',
    segment: 'drive',
    tag: 'Google Drive',
    summary: 'Forget one mirrored item (`kind` is `document` or `folder`).',
    auth: 'clerk',
    statuses: [204, 400, 401, 503],
  },
  {
    method: 'POST',
    path: '/drive/lease',
    segment: 'drive',
    tag: 'Google Drive',
    summary: 'Take or renew the cross-device write lease for this holder.',
    auth: 'clerk',
    requestSchema: {
      type: 'object',
      properties: { holder: { type: 'string' } },
      required: ['holder'],
    },
    responseSchema: 'DriveLease',
    statuses: [200, 400, 401, 404, 503],
  },
  {
    method: 'DELETE',
    path: '/drive/lease',
    segment: 'drive',
    tag: 'Google Drive',
    summary: 'Release the write lease, if this holder has it.',
    auth: 'clerk',
    query: [{ name: 'holder', required: true, description: 'The device id holding the lease.' }],
    statuses: [204, 400, 401, 503],
  },

  // ---- Telemetry ----
  {
    method: 'POST',
    path: '/events',
    segment: 'events',
    tag: 'Telemetry',
    summary:
      'Pass a batch of anonymous first-party telemetry events on to the liveworkspace telemetry service, for clients that cannot post there themselves (the CLI).',
    auth: 'public',
    requestSchema: {
      type: 'object',
      properties: { events: { type: 'array', items: ref('TelemetryEvent') } },
    },
    statuses: [204],
  },

  // ---- Workbench (docs/specs/013-workspace/workbench-embeds.md) ----
  {
    method: 'POST',
    path: '/workbench/tickets',
    segment: 'workbench',
    tag: 'Workbench',
    summary:
      "Mint a single-use, one-minute ticket that opens a document, or the person's whole workspace (scope workspace, on Home or a folder), in a paired developer tool. An origin the token is not paired with for that scope answers 428 with the pairing URL.",
    auth: 'clerk',
    tokenUsable: true,
    requestSchema: 'WorkbenchTicketRequest',
    responseSchema: {
      anyOf: [ref('WorkbenchTicketResponse'), ref('WorkbenchWorkspaceTicketResponse')],
    },
    statuses: [201, 400, 401, 403, 404, 410, 428, 429],
  },
  {
    method: 'POST',
    path: '/workbench/sessions',
    segment: 'workbench',
    tag: 'Workbench',
    summary:
      "Redeem a ticket for a workbench session: the person's editor on that one document, or in their workspace. The ticket is the credential.",
    auth: 'public',
    requestSchema: 'WorkbenchSessionRequest',
    responseSchema: 'WorkbenchSessionResponse',
    statuses: [201, 400, 401, 404, 410, 429],
  },
  {
    method: 'DELETE',
    path: '/workbench/sessions/current',
    segment: 'workbench',
    tag: 'Workbench',
    summary: 'End the workbench session this request presented.',
    auth: 'public',
    statuses: [204, 401, 403],
  },
  {
    method: 'POST',
    path: '/workbench/pairing-requests',
    segment: 'workbench',
    tag: 'Workbench',
    summary:
      "Ask to pair this token with a workbench origin; the token's owner approves it once in their browser.",
    auth: 'clerk',
    tokenUsable: true,
    requestSchema: 'WorkbenchPairingRequestCreate',
    responseSchema: 'WorkbenchPairingRequestCreated',
    statuses: [200, 400, 401, 403, 429],
  },
  {
    method: 'GET',
    path: '/workbench/pairing-requests/{code}/status',
    segment: 'workbench',
    tag: 'Workbench',
    summary: 'Poll a pairing request, by the token that asked.',
    auth: 'clerk',
    tokenUsable: true,
    responseSchema: 'WorkbenchPairingStatusResponse',
    statuses: [200, 403, 404],
  },
  {
    method: 'GET',
    path: '/workbench/pairing-requests/{code}',
    segment: 'workbench',
    tag: 'Workbench',
    summary: "The pairing page's view of a request, for the token's owner.",
    auth: 'clerk',
    responseSchema: {
      type: 'object',
      properties: { request: ref('WorkbenchPairingRequestView') },
      required: ['request'],
    },
    statuses: [200, 401, 404],
  },
  {
    method: 'POST',
    path: '/workbench/pairing-requests/{code}/approve',
    segment: 'workbench',
    tag: 'Workbench',
    summary: 'Allow the workbench: records the pairing.',
    auth: 'clerk',
    responseSchema: {
      type: 'object',
      properties: { pairing: ref('WorkbenchPairing') },
      required: ['pairing'],
    },
    statuses: [200, 401, 404, 409, 410],
  },
  {
    method: 'POST',
    path: '/workbench/pairing-requests/{code}/decline',
    segment: 'workbench',
    tag: 'Workbench',
    summary: "Don't allow the workbench: records nothing.",
    auth: 'clerk',
    statuses: [204, 401, 404, 409, 410],
  },
  {
    method: 'GET',
    path: '/workbench/pairings',
    segment: 'workbench',
    tag: 'Workbench',
    summary: "The signed-in person's paired workbenches, for Settings > API tokens.",
    auth: 'clerk',
    responseSchema: 'WorkbenchPairingsResponse',
    statuses: [200, 401],
  },
  {
    method: 'DELETE',
    path: '/workbench/pairings/{id}',
    segment: 'workbench',
    tag: 'Workbench',
    summary: 'Unpair a workbench, ending its open sessions.',
    auth: 'clerk',
    statuses: [204, 401, 404],
  },
];
