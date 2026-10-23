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
// generated COMPONENT_SCHEMAS, itself derived from @livedesign/api-schema) or
// an inline JSON Schema for the small envelopes that wrap a payload. Path
// parameters are derived from the `{param}` placeholders in `path` by
// design.ts, so they aren't repeated here.

import {
  LINT_VIEW_NAME,
  TAB_VIEW_NAMES,
  TEAM_RECENT_INCLUDE,
  TEAM_RECENT_LIMIT,
} from '@livedesign/api-schema';
import { NAME_MAX_LENGTH } from '@livedesign/design';
import { FIND_QUERY_MAX_LENGTH, VIEW_BUDGET_MAX } from '@livedesign/design-views';
import type { BodySchema } from './types';

/** How a caller authenticates (docs/specs/014-identity/auth-and-guest-access.md):
 *  - `public`: no identity required.
 *  - `guest-or-clerk`: the guest `X-Owner-Id` header OR a Bearer credential
 *    (an account access token or an API token).
 *  - `clerk`: a Bearer credential only (account access token or API token); guests are
 *    rejected. */
export type AuthMode = 'public' | 'guest-or-clerk' | 'clerk';

interface QueryParam {
  name: string;
  required: boolean;
  description: string;
}

export interface RouteSpec {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Path template under the server base, e.g. `/designs/{id}/tabs/{tabId}`. */
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
  /** A plain-text form of the success body beside the JSON one (a design view). */
  textResponse?: { description: string };
  /** Meaningful status codes. The first 2xx is the success response; the rest
   *  are documented with the shared Error schema by design.ts. */
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
// A design name field: the worker shortens it to the name cap rather than
// rejecting it (docs/specs/006-design/name-length.md).
const nameField = {
  type: 'string',
  description:
    `At most ${NAME_MAX_LENGTH} characters; a longer name is stored shortened at a word boundary ` +
    'with an ellipsis, and whitespace runs collapse to one space.',
};
// The design views' query (docs/specs/024-agents/design-views.md): `view` turns the plain read into a
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
    description: `A view instead of the plain read: ${[...TAB_VIEW_NAMES, LINT_VIEW_NAME].join(', ')}. \`lint\` (the page lint) takes only \`json\`.`,
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
const DESIGN_VIEW_QUERY = [
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
    summary: 'Which optional server features are configured (e.g. email).',
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

  // ---- Designs ----
  {
    method: 'GET',
    path: '/designs',
    segment: 'designs',
    tag: 'Designs',
    summary: "List the caller's designs (metadata only, no tab contents).",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    query: [
      {
        name: 'include',
        required: false,
        description: `${TEAM_RECENT_INCLUDE} adds \`teamRecent\`: the ${TEAM_RECENT_LIMIT} newest non-empty designs of the teams the caller has joined, newest first, each with its \`teamName\`.`,
      },
    ],
    responseSchema: {
      type: 'object',
      properties: {
        designs: { type: 'array', items: ref('DesignSummary') },
        teamRecent: {
          type: 'array',
          items: {
            allOf: [
              ref('DesignSummary'),
              {
                type: 'object',
                properties: { teamName: { type: 'string' } },
                required: ['teamName'],
              },
            ],
          },
        },
      },
      required: ['designs'],
    },
    statuses: [200, 401],
  },
  {
    method: 'POST',
    path: '/designs',
    segment: 'designs',
    tag: 'Designs',
    summary:
      'Create a design, optionally seeding it with tabs and filing it in a team and/or folder. ' +
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
            'The tabs to seed. A tab may give a `template` in place of `elements`, compiled ' +
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
                  template: { type: 'string' },
                },
                required: ['id'],
              },
            ],
          },
        },
        source: {
          anyOf: [ref('DesignSource'), { type: 'null' }],
          description: 'The agent front door that made it; `mcp` counts as Made by AI.',
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
            'What the new design is made as, recorded on it (opensIn, tabKind). ' +
            "With no choice of place, the design lands in the caller's default folder for its " +
            'mode, else the root of My Work. Malformed: intent_invalid (400).',
          properties: {
            mode: ref('EditorMode'),
            tabKind: { anyOf: [ref('CreationTabKind'), { type: 'null' }] },
          },
          required: ['mode'],
        },
        // The design's own dates, ms since the epoch (docs/specs/015-api/api.md "Design dates").
        createdAt: { type: 'integer' },
        savedAt: { type: 'integer' },
        // Making a design is a use (docs/specs/015-api/api.md "Marking a design used").
        markUsed: {
          type: 'boolean',
          description:
            'Whether making the design counts as a use of it for the caller, so it joins their ' +
            'Jump back in at once. Default true; send false when making many designs in one go ' +
            '(the editor does for an import of more than one), so they wait until opened. Not a ' +
            'boolean: 400 invalid markUsed.',
        },
      },
      required: ['id', 'name'],
    },
    responseSchema: wrap('design', 'Design'),
    statuses: [201, 400, 401, 403, 404, 410, 413, 422],
  },
  {
    method: 'GET',
    path: '/designs/{id}',
    segment: 'designs',
    tag: 'Designs',
    summary:
      'Get a design (metadata + tab summaries; tab contents fetched separately), or with `view=overview` one line per tab.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    query: DESIGN_VIEW_QUERY,
    responseSchema: wrap('design', 'Design'),
    textResponse: { description: 'With `view=overview`: the design and one line per tab.' },
    statuses: [200, 400, 401, 404, 410],
  },
  {
    method: 'PUT',
    path: '/designs/{id}',
    segment: 'designs',
    tag: 'Designs',
    summary: 'Update a design name and/or tab order.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: {
        name: nameField,
        tabIds: { type: 'array', items: { type: 'string' } },
      },
    },
    responseSchema: wrap('design', 'Design'),
    statuses: [200, 400, 401, 403, 404, 410],
  },
  {
    method: 'DELETE',
    path: '/designs/{id}',
    segment: 'designs',
    tag: 'Designs',
    summary:
      'Move a design to the Trash, restorable for 30 days. With permanent=true, delete it for good. 410 when it is already in the Trash (without permanent).',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    query: [
      {
        name: 'permanent',
        required: false,
        description:
          '"true" deletes the design for good instead of moving it to the Trash; also purges one already in the Trash.',
      },
    ],
    statuses: [204, 401, 403, 404, 410],
  },
  {
    method: 'GET',
    path: '/designs/{id}/shared-tabs',
    segment: 'designs',
    tag: 'Designs',
    summary: 'Count the tabs a delete would leave in other designs.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: wrap('sharedTabs', 'SharedTabsSummary'),
    statuses: [200, 400, 401, 403, 404, 410],
  },
  {
    method: 'POST',
    path: '/designs/{id}/copy',
    segment: 'designs',
    tag: 'Designs',
    summary: "Duplicate a design into the caller's files.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: { type: 'object', properties: { name: nameField } },
    responseSchema: wrap('design', 'Design'),
    statuses: [201, 401, 403, 404, 410],
  },
  {
    method: 'PUT',
    path: '/designs/{id}/folder',
    segment: 'designs',
    tag: 'Designs',
    summary: 'Move a design into a personal or team folder.',
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
    path: '/designs/{id}/tabs/{tabId}',
    segment: 'designs',
    tag: 'Designs',
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
    path: '/designs/{id}/tabs/{tabId}',
    segment: 'designs',
    tag: 'Designs',
    summary: `The editor's whole-tab save: create or replace one tab and its elements, merged with every changeset the editor had not seen (\`X-Changeset-Seen\`). An API token is refused with 405 \`use_changesets\`: scripts and agents write tabs with changesets. A new or changed tab name is stored shortened to ${NAME_MAX_LENGTH} characters.`,
    auth: 'guest-or-clerk',
    requestSchema: 'Tab',
    responseSchema: wrap('tab', 'TabRecord'),
    statuses: [200, 400, 401, 403, 404, 405, 409, 410, 413],
  },
  {
    method: 'POST',
    path: '/designs/{id}/tabs/{tabId}/changesets',
    segment: 'designs',
    tag: 'Changesets',
    summary:
      'Change one tab with a changeset: ordered edit operations or one replace, applied atomically, shown live to everyone with the tab open, credited to you and revertable. Pass the base you read (rev and element fingerprints) to refuse a write over a change made since. A whole-tab replace on a tab id the design lacks creates that tab.',
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
    path: '/designs/{id}/changesets',
    segment: 'designs',
    tag: 'Changesets',
    summary: "A design's changesets, newest first.",
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
    path: '/designs/{id}/changesets/{changesetId}',
    segment: 'designs',
    tag: 'Changesets',
    summary: 'One changeset, with the result lines it answered.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: 'ChangesetDetail',
    statuses: [200, 401, 404, 410],
  },
  {
    method: 'POST',
    path: '/designs/{id}/changesets/{changesetId}/revert',
    segment: 'designs',
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
    path: '/designs/{id}/tabs/{tabId}/name',
    segment: 'designs',
    tag: 'Designs',
    summary: `Rename one tab. Advances the tab's revision and reaches everyone with the design open. Stored shortened to ${NAME_MAX_LENGTH} characters.`,
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: { type: 'object', properties: { name: nameField }, required: ['name'] },
    responseSchema: wrap('tab', 'TabSummary'),
    statuses: [200, 400, 401, 403, 404, 410],
  },
  {
    method: 'POST',
    path: '/designs/{id}/tabs/{tabId}/pages',
    segment: 'designs',
    tag: 'Designs',
    summary:
      'Change the pages of a tab (add, set, lay out, move, duplicate, delete; up to 50, as one edit). Switches the tab into Pages and reaches everyone with the design open. Answers each page with its rectangle on the canvas.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: ref('PagesRequest'),
    responseSchema: 'PagesAnswer',
    statuses: [200, 400, 401, 403, 404, 409, 410, 413],
  },
  {
    method: 'DELETE',
    path: '/designs/{id}/tabs/{tabId}',
    segment: 'designs',
    tag: 'Designs',
    summary: 'Delete one tab from a design.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404, 410],
  },
  {
    method: 'POST',
    path: '/designs/{id}/tabs/{tabId}/comments',
    segment: 'designs',
    tag: 'Designs',
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
    path: '/designs/{id}/tabs/{tabId}/comments/{commentId}',
    segment: 'designs',
    tag: 'Designs',
    summary: 'Delete a comment you wrote.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404, 409, 410, 413],
  },
  {
    method: 'POST',
    path: '/designs/{id}/tabs/{tabId}/comments/{commentId}/reply',
    segment: 'designs',
    tag: 'Designs',
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
    path: '/designs/{id}/tabs/{tabId}/comments/{commentId}/resolve',
    segment: 'designs',
    tag: 'Designs',
    summary:
      'Resolve the thread that holds a comment; resolving a resolved thread changes nothing.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404, 405, 409, 410, 413],
  },
  {
    method: 'POST',
    path: '/designs/{id}/tabs/{tabId}/comments/{commentId}/reopen',
    segment: 'designs',
    tag: 'Designs',
    summary: 'Reopen the thread that holds a comment; reopening an open thread changes nothing.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404, 405, 409, 410, 413],
  },
  {
    method: 'GET',
    path: '/designs/{id}/tabs/{tabId}/render.svg',
    segment: 'designs',
    tag: 'Designs',
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
    path: '/designs/{id}/tabs/{tabId}/presence',
    segment: 'designs',
    tag: 'Designs',
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
    path: '/designs/{id}/tabs/{tabId}/presence',
    segment: 'designs',
    tag: 'Designs',
    summary: "Clear an agent's presence on a tab; 204 whether or not it was there.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404, 410, 503],
  },
  {
    method: 'GET',
    path: '/designs/{id}/comments',
    segment: 'designs',
    tag: 'Designs',
    summary:
      "The comment threads across the design, in tab and outline order, with each element's ref and label. status=open (default), resolved or all.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    query: [{ name: 'status', required: false, description: 'open (default), resolved or all.' }],
    responseSchema: listOf('threads', 'DesignCommentThread'),
    statuses: [200, 400, 401, 403, 404, 405, 410],
  },
  // ---- Photo blobs (docs/specs/031-photo/photo-store.md "The routes") ----
  {
    method: 'POST',
    path: '/designs/{id}/tabs/{tabId}/photo-blobs-held',
    segment: 'designs',
    tag: 'Designs',
    summary:
      'Which of the given photo blob ids (`{ ids }`, at most 500) this tab already holds a ref to. Edit access; not for tokens.',
    auth: 'guest-or-clerk',
    requestSchema: {
      type: 'object',
      properties: { ids: { type: 'array', items: { type: 'string' }, maxItems: 500 } },
      required: ['ids'],
    },
    responseSchema: {
      type: 'object',
      properties: { has: { type: 'array', items: { type: 'string' } } },
    },
    statuses: [200, 400, 403, 404, 503],
  },
  {
    method: 'POST',
    path: '/designs/{id}/tabs/{tabId}/photo-blobs',
    segment: 'designs',
    tag: 'Designs',
    summary:
      "Store a batch of photo blobs (a photo page's tiles, sources and previews) for this tab: a 4-byte length, a JSON index `[{ id, type, size }]`, then the bytes. Each id is checked against its bytes; PNG, JPEG or WebP only. 403 photo_full past the tab's cap. Edit access; not for tokens.",
    auth: 'guest-or-clerk',
    requestSchema: { type: 'string', format: 'binary' },
    responseSchema: {
      type: 'object',
      properties: { stored: { type: 'array', items: { type: 'string' } } },
    },
    statuses: [200, 400, 403, 404, 413, 415, 503],
  },
  {
    method: 'POST',
    path: '/designs/{id}/tabs/{tabId}/photo-blobs-adopt',
    segment: 'designs',
    tag: 'Designs',
    summary:
      'Give this tab refs to the photo blobs another tab holds (`{ fromDesign, fromTab, ids }`), where the caller may read that tab now. For duplicated tabs and layers pasted between tabs. Edit access; not for tokens.',
    auth: 'guest-or-clerk',
    requestSchema: {
      type: 'object',
      properties: {
        fromDesign: { type: 'string' },
        fromTab: { type: 'string' },
        ids: { type: 'array', items: { type: 'string' }, maxItems: 2000 },
      },
      required: ['fromDesign', 'fromTab', 'ids'],
    },
    responseSchema: {
      type: 'object',
      properties: { adopted: { type: 'array', items: { type: 'string' } } },
    },
    statuses: [200, 400, 403, 404, 503],
  },
  {
    method: 'GET',
    path: '/designs/{id}/tabs/{tabId}/photo-blobs/{blobId}',
    segment: 'designs',
    tag: 'Designs',
    summary:
      "A photo blob's bytes, through a tab the caller may read that holds a ref to it. Named by content, so cached for good.",
    auth: 'guest-or-clerk',
    responseSchema: { type: 'string', format: 'binary' },
    statuses: [200, 404, 503],
  },
  {
    method: 'POST',
    path: '/designs/{id}/tabs/{tabId}/link',
    segment: 'designs',
    tag: 'Designs',
    summary: 'Add (link) an existing tab into this design.',
    auth: 'guest-or-clerk',
    responseSchema: wrap('tab', 'TabSummary'),
    statuses: [200, 401, 403, 404, 410],
  },
  {
    method: 'GET',
    path: '/designs/{id}/share',
    segment: 'designs',
    tag: 'Sharing',
    summary: "List a design's share links and password state.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: listOf('links', 'ShareLink'),
    statuses: [200, 401, 403, 404, 410],
  },
  {
    method: 'POST',
    path: '/designs/{id}/share',
    segment: 'designs',
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
    path: '/designs/{id}/share',
    segment: 'designs',
    tag: 'Sharing',
    summary: 'Revoke all share links for a design.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [200, 401, 403, 404, 410],
  },
  {
    method: 'PUT',
    path: '/designs/{id}/share-password',
    segment: 'designs',
    tag: 'Sharing',
    summary: "Set or clear a design's share password.",
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
    path: '/designs/{id}/share/{code}',
    segment: 'designs',
    tag: 'Sharing',
    summary: 'Revoke one share link by its code.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404, 410],
  },
  {
    method: 'PUT',
    path: '/designs/{id}/share/{code}',
    segment: 'designs',
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
    path: '/designs/{id}/share/{code}/extend',
    segment: 'designs',
    tag: 'Sharing',
    summary: 'Re-arm an expiring share link.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: wrap('link', 'ShareLink'),
    statuses: [200, 400, 401, 403, 404, 410],
  },
  {
    method: 'GET',
    path: '/designs/{id}/thumbnail',
    segment: 'designs',
    tag: 'Designs',
    summary:
      "The design's cached SVG snapshot (a tab-scoped share visitor gets their tab). Read-gated like GET /designs/{id}; 404 when there is no snapshot.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    query: [{ name: 'v', required: false, description: 'Cache-buster (the savedAt stamp).' }],
    responseSchema: { type: 'string' },
    responseMediaType: 'image/svg+xml',
    statuses: [200, 404],
  },
  {
    method: 'POST',
    path: '/designs/{id}/room-ticket',
    segment: 'designs',
    tag: 'Designs',
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
    path: '/designs/{id}/ws',
    segment: 'designs',
    tag: 'Designs',
    summary:
      'WebSocket upgrade to the realtime room. The op protocol is documented in docs/specs/015-api/api.md, not here.',
    auth: 'guest-or-clerk',
    query: [
      { name: 's', required: false, description: 'Share code, for non-owner collaborators.' },
      { name: 'o', required: false, description: 'Owner id (guest path).' },
      { name: 'p', required: false, description: 'Share password, when the design is gated.' },
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
    statuses: [201, 400, 401, 403, 404, 409],
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
    summary: 'Map each image to the designs that reference it.',
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
    query: [{ name: 'd', required: false, description: 'Design id, for share-code readers.' }],
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

  // ---- Shared with you ----
  {
    method: 'GET',
    path: '/shared',
    segment: 'shared',
    tag: 'Sharing',
    summary: 'List designs shared with the caller.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: listOf('shared', 'SharedWithItem'),
    statuses: [200, 401],
  },
  {
    method: 'DELETE',
    path: '/shared/{designId}',
    segment: 'shared',
    tag: 'Sharing',
    summary: 'Remove a design from the caller\'s "shared with you" list.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [200, 401],
  },
  {
    method: 'GET',
    path: '/share/{code}',
    segment: 'share',
    tag: 'Sharing',
    summary: 'Resolve a share code to a design and the granted role.',
    auth: 'public',
    query: [{ name: 'password', required: false, description: 'Required when the link is gated.' }],
    responseSchema: {
      type: 'object',
      properties: {
        design: ref('Design'),
        role: ref('ShareRole'),
        tabId: { type: ['string', 'null'] },
      },
      required: ['design', 'role', 'tabId'],
    },
    statuses: [200, 401, 403, 404, 410],
  },
  {
    method: 'GET',
    path: '/share/{code}/image.svg',
    segment: 'share',
    tag: 'Sharing',
    summary:
      'Live image: the shared design as SVG, embeddable by a bare <img>. Public by share code; a password-protected share has no image.',
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
      "A link preview's text: the shared design's name. 404 wherever the live image is (a dead code, a share password).",
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
    summary: 'The design ids the caller has starred, newest first.',
    auth: 'guest-or-clerk',
    responseSchema: {
      type: 'object',
      properties: { ids: { type: 'array', items: { type: 'string' } } },
    },
    statuses: [200, 401],
  },
  {
    method: 'PUT',
    path: '/favourites/{designId}',
    segment: 'favourites',
    tag: 'Account',
    summary: 'Star a design for the caller. Idempotent; 404 when there is no such design.',
    auth: 'guest-or-clerk',
    statuses: [204, 401, 404],
  },
  {
    method: 'DELETE',
    path: '/favourites/{designId}',
    segment: 'favourites',
    tag: 'Account',
    summary: 'Un-star a design for the caller.',
    auth: 'guest-or-clerk',
    statuses: [204, 401],
  },

  // ---- Tags (docs/specs/013-workspace/tags.md) ----
  {
    method: 'GET',
    path: '/tags',
    segment: 'tags',
    tag: 'Account',
    summary: "The caller's tags, alphabetical, and which live designs each is on.",
    auth: 'guest-or-clerk',
    responseSchema: {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              colour: { type: 'string' },
              createdAt: { type: 'integer' },
            },
          },
        },
        links: {
          type: 'array',
          items: {
            type: 'object',
            properties: { tagId: { type: 'string' }, designId: { type: 'string' } },
          },
        },
      },
    },
    statuses: [200, 401],
  },
  {
    method: 'POST',
    path: '/tags',
    segment: 'tags',
    tag: 'Account',
    summary:
      'Make a tag: a client-minted id, a name (1 to 32 characters, one per person ignoring case) and a colour ' +
      '(a standard colour name or #rrggbb). 409 tag_name_taken or tag_limit (100).',
    auth: 'guest-or-clerk',
    requestSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, name: { type: 'string' }, colour: { type: 'string' } },
      required: ['id', 'name', 'colour'],
    },
    statuses: [201, 400, 401, 409],
  },
  {
    method: 'PUT',
    path: '/tags/{tagId}',
    segment: 'tags',
    tag: 'Account',
    summary: "Rename and / or recolour one of the caller's tags.",
    auth: 'guest-or-clerk',
    requestSchema: {
      type: 'object',
      properties: { name: { type: 'string' }, colour: { type: 'string' } },
    },
    statuses: [200, 400, 401, 404, 409],
  },
  {
    method: 'DELETE',
    path: '/tags/{tagId}',
    segment: 'tags',
    tag: 'Account',
    summary: "Delete one of the caller's tags; it comes off every design.",
    auth: 'guest-or-clerk',
    statuses: [204, 401, 404],
  },
  {
    method: 'PUT',
    path: '/tags/{tagId}/designs/{designId}',
    segment: 'tags',
    tag: 'Account',
    summary:
      "Put a tag on a design. Idempotent; 404 when the tag is not the caller's or there is no such design.",
    auth: 'guest-or-clerk',
    statuses: [204, 401, 404],
  },
  {
    method: 'DELETE',
    path: '/tags/{tagId}/designs/{designId}',
    segment: 'tags',
    tag: 'Account',
    summary: 'Take a tag off a design.',
    auth: 'guest-or-clerk',
    statuses: [204, 401, 404],
  },

  // ---- Default folders (docs/specs/013-workspace/default-folders.md) ----
  {
    method: 'GET',
    path: '/placement-defaults',
    segment: 'placement-defaults',
    tag: 'Folders',
    summary: "The caller's default folders, one per key (mode:pages), dangling ones included.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: {
      type: 'object',
      properties: {
        defaults: {
          type: 'array',
          items: {
            type: 'object',
            properties: { key: { type: 'string' }, folderId: { type: 'string' } },
            required: ['key', 'folderId'],
          },
        },
      },
    },
    statuses: [200, 401],
  },
  {
    method: 'PUT',
    path: '/placement-defaults/{key}',
    segment: 'placement-defaults',
    tag: 'Folders',
    summary:
      "Set the caller's default folder for a key: their own personal folder or a folder of a team " +
      'they have joined. Refusals: default_key_invalid, default_folder_invalid (400), ' +
      'folder_not_found (404).',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: { folderId: { type: 'string', minLength: 1 } },
      required: ['folderId'],
    },
    statuses: [204, 400, 401, 404, 429],
  },
  {
    method: 'DELETE',
    path: '/placement-defaults/{key}',
    segment: 'placement-defaults',
    tag: 'Folders',
    summary: "Clear the caller's default folder for a key. Idempotent; default_key_invalid (400).",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 400, 401, 429],
  },

  // ---- Trash (docs/specs/013-workspace/trash.md) ----
  {
    method: 'GET',
    path: '/trash',
    segment: 'trash',
    tag: 'Trash',
    summary:
      'The designs the caller may restore: their personal Trash and every joined team Trash, newest first.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: listOf('trash', 'TrashedDesign'),
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
      'Restore a design from the Trash to its folder, or the root of its space when that folder is gone.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: wrap('design', 'Design'),
    statuses: [200, 400, 401, 404],
  },
  {
    method: 'DELETE',
    path: '/trash/{id}',
    segment: 'trash',
    tag: 'Trash',
    summary: 'Delete a design in the Trash for good.',
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

  // ---- Activity (docs/specs/013-workspace/inbox.md) ----
  {
    method: 'GET',
    path: '/activity',
    segment: 'activity',
    tag: 'Account',
    summary:
      'What is outstanding for the caller across every design they can open: open actions assigned to them or by them, and unresolved comment threads they are in. Capped at 100 per kind, newest first.',
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

  // ---- Explorer Home (docs/specs/013-workspace/explorer-home.md) ----
  {
    method: 'GET',
    path: '/home',
    segment: 'home',
    tag: 'Account',
    summary:
      "The Explorer's Home in one read: Jump back in (the caller's Within reach set: the 4 designs they used on the most days over the last 90, then the 4 they used most recently, none twice; most used first) and What happened (other people's actions on designs the caller can open over the last 14 days, one group per design per day in `tz`). Query: `tz` (IANA, default UTC). 400 `tz_invalid`.",
    auth: 'guest-or-clerk',
    responseSchema: { $ref: '#/components/schemas/HomeResponse' },
    statuses: [200, 400, 401, 429],
  },

  // ---- Account ----
  {
    method: 'DELETE',
    path: '/account',
    segment: 'account',
    tag: 'Account',
    summary: 'Delete the signed-in account and all of its data (designs, tokens, ...).',
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
    tokenUsable: true,
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
    method: 'GET',
    path: '/teams/invite-decline/{token}',
    segment: 'teams',
    tag: 'Teams',
    summary: "Read the invite an email's decline token names: its team name and status.",
    auth: 'public',
    responseSchema: 'TeamInviteDecline',
    statuses: [200, 404, 429],
  },
  {
    method: 'POST',
    path: '/teams/invite-decline/{token}',
    segment: 'teams',
    tag: 'Teams',
    summary: "Decline the invite an email's decline token names. No sign-in; idempotent.",
    auth: 'public',
    responseSchema: 'TeamInviteDecline',
    statuses: [200, 404, 409, 429],
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
    tokenUsable: true,
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
      'Whether a joined teammate can open a design the caller can access (docs/specs/012-collaboration/assigned-actions.md): owner, team-library member, or prior share-link visitor.',
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
      'Email a joined teammate that an action on a design element was assigned to them (docs/specs/012-collaboration/assigned-actions.md). Best-effort; the assignee may have opted out.',
    auth: 'clerk',
    requestSchema: {
      type: 'object',
      properties: {
        assigneeUserId: { type: 'string' },
        designId: { type: 'string' },
        actionName: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['assigneeUserId', 'designId', 'actionName'],
    },
    statuses: [202, 400, 401, 403, 404],
  },
  {
    method: 'POST',
    path: '/teams/{id}/notify-mention',
    segment: 'teams',
    tag: 'Teams',
    summary:
      "Email the teammates a comment just @-mentioned (docs/specs/012-collaboration/comment-mentions.md). The design must be in this team's library; each mention must be a member of the team. Best-effort; a recipient may have opted out.",
    auth: 'clerk',
    requestSchema: {
      type: 'object',
      properties: {
        designId: { type: 'string' },
        commentText: { type: 'string' },
        mentions: {
          type: 'array',
          items: {
            type: 'object',
            properties: { userId: { type: 'string' }, memberId: { type: 'string' } },
          },
        },
      },
      required: ['designId', 'commentText', 'mentions'],
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
    summary: "Get a team's shared folder tree and designs (joined member).",
    auth: 'clerk',
    tokenUsable: true,
    responseSchema: {
      type: 'object',
      properties: {
        folders: { type: 'array', items: ref('Folder') },
        designs: { type: 'array', items: ref('DesignSummary') },
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
    summary:
      'Pass a batch of anonymous first-party telemetry events on to the liveworkspace telemetry service, for clients that cannot post there themselves (the CLI).',
    auth: 'public',
    requestSchema: {
      type: 'object',
      properties: {
        events: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              action: { type: 'string' },
              type: { type: ['string', 'null'] },
            },
            required: ['category', 'action'],
          },
        },
      },
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
      "Mint a single-use, one-minute ticket that opens a design, or the person's whole workspace (scope workspace, on Home or a folder), in a paired developer tool. An origin the token is not paired with for that scope answers 428 with the pairing URL.",
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
      "Redeem a ticket for a workbench session: the person's editor on that one design, or in their workspace. The ticket is the credential.",
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
