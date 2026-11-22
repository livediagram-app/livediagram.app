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
// generated COMPONENT_SCHEMAS, itself derived from @liveknowledge/api-schema) or
// an inline JSON Schema for the small envelopes that wrap a payload. Path
// parameters are derived from the `{param}` placeholders in `path` by
// document.ts, so they aren't repeated here.

import { LINT_VIEW_NAME, TAB_VIEW_NAMES, VERSION_NAMED_MAX } from '@liveknowledge/api-schema';
import { NAME_MAX_LENGTH } from '@liveknowledge/document';
import { FIND_QUERY_MAX_LENGTH, VIEW_BUDGET_MAX } from '@liveknowledge/document-views';
import type { BodySchema } from '@liveworkspace/api-kit/openapi-types';
import { itemAutomationOperations } from '@liveworkspace/automations/room';
import { TAB_DELTA_OPENAPI } from '@liveworkspace/api-kit/tab-delta-door';

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
  /** Media type of the success body. Defaults to `application/json`; the tab render
   *  answers `image/svg+xml`. */
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
    description: `A view instead of the plain read: ${[...TAB_VIEW_NAMES, LINT_VIEW_NAME].join(', ')}. \`lint\` (the lint) takes only \`json\`.`,
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
// "The gallery"): every filter can also be a word in `q` (`#tag`, `category:`, `sort:`, `is:mine`).
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

  // ---- Documents ----
  {
    method: 'GET',
    path: '/documents',
    segment: 'documents',
    tag: 'Documents',
    summary:
      "List the caller's documents (metadata only, no tab contents); archived=1 lists their Archived instead.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: {
      type: 'object',
      properties: {
        documents: { type: 'array', items: ref('DocumentSummary') },
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
          anyOf: [ref('DocumentSource'), { type: 'null' }],
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
            'What the new document is made as. ' +
            "With no choice of place, the document lands in the caller's default folder, " +
            'else the root of My Work. Malformed: intent_invalid (400).',
          properties: {
            mode: { type: 'string', enum: ['pages'] },
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
            'Most Used and Recent at once. Default true; send false when making many documents in one go ' +
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
        presentation: {
          type: ['string', 'null'],
          description: 'The slide deck, serialised; null clears it. Absent leaves it alone.',
        },
        presentationBase: {
          type: ['string', 'null'],
          description:
            'The deck `presentation` was built on: sent with it, note cards are merged by card id with the stored deck.',
        },
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
    method: 'POST',
    path: '/documents/{id}/archive',
    segment: 'documents',
    tag: 'Documents',
    summary:
      'Move a document the caller owns to their Archived: out of every list, its share links ended, its Recent and Inbox entries removed for everyone.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: wrap('document', 'DocumentSummary'),
    statuses: [200, 401, 403, 404, 409],
  },
  {
    method: 'POST',
    path: '/documents/{id}/unarchive',
    segment: 'documents',
    tag: 'Documents',
    summary:
      'Move an archived document out of Archived: to the top of My Work, or the folder (folderId) or team (teamId) named.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: { folderId: { type: ['string', 'null'] }, teamId: { type: ['string', 'null'] } },
    },
    responseSchema: wrap('document', 'DocumentSummary'),
    statuses: [200, 400, 401, 403, 404],
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
    path: '/documents/{id}/tabs/{tabId}/delta',
    segment: 'documents',
    tag: 'Documents',
    auth: 'guest-or-clerk',
    ...TAB_DELTA_OPENAPI,
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
    method: 'GET',
    path: '/documents/{id}/search',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "Search a knowledgebase: page titles first, then passages of the writing, verified pages preferred, each with its matched words marked. At most 20 results; a query is at most 200 characters. Every role, a share link's visitor included; rate-limited per caller. An agent's results count as reads of their pages, and its search that finds nothing is logged as a question nobody could answer.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    query: [
      { name: 'q', required: true, description: 'The words to look for, at most 200 characters.' },
    ],
    responseSchema: 'KnowledgeSearchResponse',
    statuses: [200, 400, 401, 403, 404, 410, 429],
  },
  {
    method: 'GET',
    path: '/documents/{id}/summary',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      'What Home shows of a knowledgebase: its page count, its Review Period, how many pages are Verified, Review Due and Never Verified under it, the eight pages changed most recently, and the pages the caller owns whose review is due (oldest first, ten at most; none for a caller with no account). Cacheable for a minute.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: 'KnowledgeSummaryResponse',
    statuses: [200, 401, 403, 404, 410],
  },
  {
    method: 'GET',
    path: '/documents/{id}/knowledge-settings',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "The knowledgebase's settings: its Review Period (`reviewEvery`: 30, 90, 180 or 365 days, or `never`; 90 until an Editor chooses). A verified page comes due for review this long after it was last verified.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: 'KnowledgeSettingsResponse',
    statuses: [200, 401, 403, 404, 410],
  },
  {
    method: 'PUT',
    path: '/documents/{id}/knowledge-settings',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "Set the knowledgebase's Review Period. Editor only (in person, or a token granted `write`). Every page's state, due date and the counts follow at once: they are worked out when read, so one row is written however many pages there are. `never` makes no page Review Due and sends no review email.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: 'KnowledgeSettingsRequest',
    responseSchema: 'KnowledgeSettingsResponse',
    statuses: [200, 400, 401, 403, 404, 405, 410],
  },
  {
    method: 'GET',
    path: '/documents/{id}/publishing',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "The knowledgebase's public site (Publish to the Web): whether it may be published, the site as it stands, the address a first publish is offered, and a preview of the pages a publish of `root` would put on the web and those it would leave out (Pending Approval, Rejected, or with no saved writing). Editor in person only: an agent's token is refused with 403 `needs_a_person`.",
    query: [
      {
        name: 'root',
        required: false,
        description:
          "The section to preview: a page's id. Empty for the whole knowledgebase; left out, the site's own.",
      },
    ],
    auth: 'guest-or-clerk',
    tokenUsable: false,
    responseSchema: 'PublishingState',
    statuses: [200, 401, 403, 404, 405, 410],
  },
  {
    method: 'PUT',
    path: '/documents/{id}/publishing',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      'Publish the knowledgebase, or one section of it, at `/kb/<address>`, or change what is published. The site shows saved writing alone: never drafts, comments, margin notes, Page Health or pages Pending Approval or Rejected. A renamed page or site keeps its old address as a permanent redirect. Editor in person, signed in. 409 `address_taken` when another knowledgebase holds the address; 409 `nothing_to_publish` when no page may go public.',
    auth: 'guest-or-clerk',
    tokenUsable: false,
    requestSchema: 'PublishingRequest',
    responseSchema: 'PublishingState',
    statuses: [200, 400, 401, 403, 404, 405, 409, 410],
  },
  {
    method: 'DELETE',
    path: '/documents/{id}/publishing',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      'Unpublish: the site and every address it held come down at once, and every edge copy within a minute. Editor in person, signed in.',
    auth: 'guest-or-clerk',
    tokenUsable: false,
    responseSchema: 'PublishingState',
    statuses: [200, 401, 403, 404, 405, 410],
  },
  {
    method: 'GET',
    path: '/documents/{id}/knowledge-settings/preview',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      'How many pages would be Review Due under a Review Period, beside how many are due now. Changes nothing. Editor only.',
    query: [
      {
        name: 'reviewEvery',
        required: true,
        description: 'The period to count under: 30, 90, 180, 365 or never.',
      },
    ],
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: 'KnowledgeSettingsPreviewResponse',
    statuses: [200, 400, 401, 403, 404, 405, 410],
  },
  {
    method: 'GET',
    path: '/documents/{id}/pages/{tabId}/backlinks',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "Linked From: the pages whose writing links to this page, in the page tree's order. Read from the knowledgebase's link table, never by scanning pages.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: 'KnowledgeBacklinksResponse',
    statuses: [200, 401, 403, 404, 410],
  },
  {
    method: 'GET',
    path: '/documents/{id}/pages/{tabId}/health',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "Page Health: the page's owner, when and by whom it was verified, its review interval, its state now, whether it changed since it was verified, and its reads by people and by agents in the last seven days.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: 'PageHealthResponse',
    statuses: [200, 401, 403, 404, 410],
  },
  {
    method: 'POST',
    path: '/documents/{id}/pages/{tabId}/verify',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "Verify a page: verified now, by you, who become the owner of a page with none. Editor only, and only for a signed-in account. Advances the tab's revision and is told to every open editor.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: 'PageKnowledgeResponse',
    statuses: [200, 401, 403, 404, 405, 409, 410],
  },
  {
    method: 'PUT',
    path: '/documents/{id}/pages/{tabId}/knowledge',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "Change a page's owner or Always in Context; send only the fields to change. Editor only. The owner must be someone who can open the knowledgebase; a page that would pass the 8,000 token context budget is refused with 409 `context_budget`. A page has no review period of its own: `reviewEvery` here is refused with 400 `review_period_is_the_knowledgebases` (set it with `PUT /documents/{id}/knowledge-settings`).",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: 'PageKnowledgePatch',
    responseSchema: 'PageKnowledgeResponse',
    statuses: [200, 400, 401, 403, 404, 405, 409, 410],
  },
  {
    method: 'POST',
    path: '/documents/{id}/pages/{tabId}/approval',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "Approval (docs/specs/030-knowledgebase/approval.md): `request` puts the page Pending Approval, `withdraw` takes the request back (its asker or an Editor), `approve` approves and verifies it, `reject` rejects it with an optional `note` (500 characters). An Editor or a Participant with an account; an agent may request and withdraw, never decide; nobody decides their own request. Told to every open editor; a rejection emails the page's owner.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: 'PageApprovalRequest',
    responseSchema: 'PageKnowledgeResponse',
    statuses: [200, 400, 401, 403, 404, 405, 409, 410],
  },
  {
    method: 'GET',
    path: '/documents/{id}/pages/{tabId}/threads',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "The comment threads at the foot of a page (docs/specs/030-knowledgebase/page-comments.md), oldest first, each with its comments. Every role reads them. A comment's `by` is its author's collab key, never an account id; `ai` marks an agent's.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: 'PageThreadsResponse',
    statuses: [200, 401, 403, 404, 410],
  },
  {
    method: 'POST',
    path: '/documents/{id}/pages/{tabId}/threads',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "One change to a page's comment threads: `start` (201), `reply` (reopens a resolved thread), `resolve`, `reopen`, and `edit` or `delete` of your own comment (deleting a thread's last comment removes it). An Editor, a Participant or an edit link's visitor; an agent's comments are marked Generated by AI. Answers the thread whole, or `removed`; everyone on the page sees it at once.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: 'PageThreadChange',
    responseSchema: 'PageThreadChangeResponse',
    statuses: [200, 201, 400, 401, 403, 404, 405, 409, 410],
  },
  {
    method: 'GET',
    path: '/documents/{id}/pages/{tabId}/reactions',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "The reactions on a page (docs/specs/030-knowledgebase/page-reactions.md), oldest first: each one emoji, its reactor's name and collab key (`by`), never an account id. Every role reads them.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: 'PageReactionsResponse',
    statuses: [200, 401, 403, 404, 410],
  },
  {
    method: 'POST',
    path: '/documents/{id}/pages/{tabId}/reactions',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "Add (`on: true`) or take back (`on: false`) your own reaction on a page: any one emoji, one of each per person. Any signed-in reader, a Viewer included; a guest and an agent's token are refused. A page holds 500 reactions and 20 different emoji, a person 10 on a page, 30 changes a minute. Tells nobody but the people on the page; `changed` is false when it already stood so.",
    auth: 'guest-or-clerk',
    tokenUsable: false,
    requestSchema: 'PageReactionChange',
    responseSchema: 'PageReactionChangeResponse',
    statuses: [200, 400, 401, 403, 404, 405, 409, 410, 429],
  },
  {
    method: 'GET',
    path: '/documents/{id}/ai',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "The knowledgebase's AI settings: the provider (`anthropic` or `openai`), whether the team's own key is set, the chosen model, that provider's models and the providers on offer. Never the key; its last four characters are shown to an Editor only.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: 'KnowledgeAiSettings',
    statuses: [200, 401, 403, 404, 410],
  },
  {
    method: 'PUT',
    path: '/documents/{id}/ai/key',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "Set the team's own key, as `{ provider, key }` (`anthropic` or `openai`; no provider is the one already chosen). Editor only. A knowledgebase holds one provider and one key: another provider replaces the key and resets the model to that provider's default. It is sealed under the server's secret, bound to this knowledgebase, and never returned or logged. 503 `ask_unavailable` on a server with no secret to seal under.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: 'KnowledgeAiSettings',
    statuses: [200, 400, 401, 403, 404, 405, 410, 503],
  },
  {
    method: 'DELETE',
    path: '/documents/{id}/ai/key',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "Remove the knowledgebase's AI key. Editor only. Ask stops; search and everything else work as before.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: 'KnowledgeAiSettings',
    statuses: [200, 401, 403, 404, 405, 410],
  },
  {
    method: 'PUT',
    path: '/documents/{id}/ai/model',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "Choose the model, as `{ model }`: one of the stored provider's ids, as `GET .../ai` lists them. Editor only.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: 'KnowledgeAiSettings',
    statuses: [200, 400, 401, 403, 404, 405, 410],
  },
  {
    method: 'POST',
    path: '/documents/{id}/ask',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "Ask a question answered only from the knowledgebase's own pages, on the team's own key (Claude's or OpenAI's). The answer streams as server-sent events (`AskEvent`): `delta` pieces, then one `done` with the cited sources, what was found but not used and the gaps; or one `error` naming the failure in words. A signed-in Editor, Participant or Viewer may ask (a read-only token too); a visitor through a share link may not. 20 questions a person an hour, 200 a knowledgebase a day, a question at most 1,000 characters.",
    auth: 'clerk',
    tokenUsable: true,
    requestSchema: 'AskRequest',
    statuses: [200, 400, 401, 403, 404, 405, 409, 410, 429, 503],
  },
  {
    method: 'POST',
    path: '/documents/{id}/setup/suggest',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "Describe to Set Up: propose a page structure from a description of what the knowledgebase is for (20 to 1,000 characters), on the team's own key when one is set, else on built-in AI (Workers AI). Answers a name and up to 30 pages, 3 levels deep, each with a title, a one-line summary and up to 6 headings, as plain text, and which AI answered (`provider`: built-in, anthropic or openai); nothing is written. A signed-in Editor in person only (no API token). 5 a person an hour, 20 a knowledgebase a day, and on built-in AI 10 a person a day across every knowledgebase (`built-in-limit`). 502 with the failure's kind in words when the model call fails (`built-in-failed` on built-in AI) or its reply holds no structure (`no-structure`); 503 `built-in-unavailable` with no key and no built-in AI.",
    auth: 'clerk',
    tokenUsable: false,
    requestSchema: 'KnowledgeSetupRequest',
    responseSchema: 'KnowledgeSetupSuggestion',
    statuses: [200, 400, 401, 403, 404, 405, 409, 410, 429, 502, 503],
  },
  {
    method: 'GET',
    path: '/documents/{id}/knowledge',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "The AI Knowledge tab: the agents connected to this knowledgebase in the last 30 days, each with how it connects, the scopes it holds here and when it was last seen (its token's id only for an Editor in person, who may change those scopes), the questions nobody could answer, the pages that disagree, the pages every agent is handed with their size against the budget, and the counts of Verified, Review Due and Never Verified pages.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: 'KnowledgeOverviewResponse',
    statuses: [200, 401, 403, 404, 410],
  },
  {
    method: 'POST',
    path: '/documents/{id}/questions',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "Report a question the knowledgebase does not answer (an agent's `report_gap`), as `{ question }`. Like questions are grouped. For a signed-in account or a token (a read-only one too).",
    auth: 'clerk',
    tokenUsable: true,
    requestSchema: 'ReportGapRequest',
    statuses: [201, 400, 401, 403, 404, 405, 410],
  },
  {
    method: 'DELETE',
    path: '/documents/{id}/questions/{key}',
    segment: 'documents',
    tag: 'Knowledge',
    summary: "Dismiss an unanswered question by its group's key. Editor only.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404, 405, 410],
  },
  {
    method: 'POST',
    path: '/documents/{id}/conflicts/{conflictId}/dismiss',
    segment: 'documents',
    tag: 'Knowledge',
    summary: 'Not a Conflict: dismiss a pair of passages for good. Editor only.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404, 405, 410],
  },
  {
    method: 'POST',
    path: '/documents/{id}/conflicts/{conflictId}/ask-owners',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "Ask Both Owners: email each owner of a conflict's two pages once, naming both pages and passages. An Editor in person (a token is refused). Sent through the account's Knowledgebase Reviews setting, at most once a conflict and within the knowledgebase's 50 review emails a day. Answers what was sent or why nothing was (`already_sent`, `no_owners`, `no_recipients`, `daily_limit`, `unavailable`); 404 `conflict_unknown` for a conflict that is closed or dismissed.",
    auth: 'clerk',
    tokenUsable: false,
    responseSchema: 'KnowledgeEmailResult',
    statuses: [200, 401, 403, 404, 405, 410],
  },
  {
    method: 'POST',
    path: '/documents/{id}/knowledge/remind-owners',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "Remind the Owners: email each page owner one list of their pages that are Review Due or Never Verified. An Editor in person (a token is refused). Sent through the account's Knowledgebase Reviews setting, at most once a week a knowledgebase and within its 50 review emails a day. Answers what was sent or why nothing was (`already_sent` with when it may be sent again, `nothing_due`, `no_owners`, `no_recipients`, `daily_limit`, `unavailable`).",
    auth: 'clerk',
    tokenUsable: false,
    responseSchema: 'KnowledgeEmailResult',
    statuses: [200, 401, 403, 404, 405, 410],
  },
  {
    method: 'GET',
    path: '/documents/{id}/pages',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "The page tree in order, for an agent's `list_pages`: each page's id, title, depth, parent, subpage count, owner, whether it is Always in Context, and its trust (verified state, when it was verified, when its review is due, `stale`, and the pages an open conflict sets it against). One request, read from the tab summaries: no page's writing is loaded. Every role.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: 'KnowledgePagesResponse',
    statuses: [200, 401, 403, 404, 405, 410],
  },
  {
    method: 'POST',
    path: '/documents/{id}/pages',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "Make a new page from Markdown (an agent's `create_page`), as `{ title, markdown?, parent? }`. `[[Title]]` in the Markdown links to the page of that title. An Editor, or an Editor's agent holding the `suggest` scope. The page is never Verified. 409 `page_limit`, `depth_limit` or `unknown_page` when the tree does not take it.",
    auth: 'clerk',
    tokenUsable: true,
    requestSchema: 'CreatePageRequest',
    responseSchema: 'CreatePageResponse',
    statuses: [201, 400, 401, 403, 404, 405, 409, 410, 413],
  },
  {
    method: 'GET',
    path: '/documents/{id}/pages/{tabId}',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "One page as Markdown (an agent's `read_page`), its page links shown by the linked pages' current titles, with its trust, the pages that link to it and its subpages. `heading` answers one section, `maxChars` the first part; `leftOut` counts the characters not sent and `headings` lists the page's sections. Counts as a read of the page. Every role.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    query: [
      {
        name: 'heading',
        required: false,
        description:
          "Only this heading's section, through to the next heading of its level or above.",
      },
      {
        name: 'maxChars',
        required: false,
        description: 'At most this many characters, cut at a paragraph break.',
      },
    ],
    responseSchema: 'KnowledgePageReadResponse',
    statuses: [200, 400, 401, 403, 404, 405, 410],
  },
  {
    method: 'PUT',
    path: '/documents/{id}/pages/{tabId}',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "Replace a page's writing with Markdown, or add Markdown after it (an agent's `write_page`), as `{ markdown, mode? }`. Editor only; an agent needs the `write` scope, and is refused 409 `page_verified` on a verified page and 409 `page_review_due` on one whose review is due, where it suggests the edit instead. Answers as the article write does. In every page route `{tabId}` takes the page's id, or its title when one page alone has it.",
    auth: 'clerk',
    tokenUsable: true,
    requestSchema: 'WritePageRequest',
    responseSchema: 'PagesAnswer',
    statuses: [200, 400, 401, 403, 404, 405, 409, 410, 413],
  },
  {
    method: 'POST',
    path: '/documents/{id}/pages/{tabId}/move',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "Move a page in the tree with its subpages (an agent's `move_page`), as `{ parent, before? }`: under `parent` (null for the top level), in front of its subpage `before` (last when left out). Editor only; an agent needs the `write` scope. 409 `own_subtree`, `depth_limit` or `unknown_page`.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: 'MovePageRequest',
    responseSchema: 'MovePageResponse',
    statuses: [200, 400, 401, 403, 404, 405, 409, 410],
  },
  {
    method: 'POST',
    path: '/documents/{id}/pages/{tabId}/suggestions',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "Suggest an edit to a page (an agent's `suggest_edit`), as `{ reason, after, before? }`: `before` is a passage of the page's Markdown as it reads now, replaced by `after`; left out, `after` is appended. Nothing changes until an Editor accepts it. A Participant or an Editor with an account, or an agent of one holding `suggest`. At most 20,000 characters a suggestion and 50 waiting a knowledgebase (409 `suggestions_full`); 400 `passage_not_found` or `passage_ambiguous` when `before` does not sit in exactly one place.",
    auth: 'clerk',
    tokenUsable: true,
    requestSchema: 'SuggestEditRequest',
    responseSchema: 'SuggestEditResponse',
    statuses: [201, 400, 401, 403, 404, 405, 409, 410],
  },
  {
    method: 'GET',
    path: '/documents/{id}/suggestions',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      'The edits agents have suggested that wait for an Editor, newest first: the page, the agent, its reason, and the change as the passage replaced (`before`) and what replaces it (`after`). Gone after 90 days. Every role.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: 'KnowledgeSuggestionsResponse',
    statuses: [200, 401, 403, 404, 405, 410],
  },
  {
    method: 'POST',
    path: '/documents/{id}/suggestions/{suggestionId}/accept',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "Accept a suggested edit: applied through the article write as one change in the acceptor's name. Editor only. The page's verified state is left as it was. 409 `suggestion_stale` when the passage it replaces has changed since; the suggestion then stays, to be dismissed.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: 'AcceptSuggestionResponse',
    statuses: [200, 401, 403, 404, 405, 409, 410, 413],
  },
  {
    method: 'POST',
    path: '/documents/{id}/suggestions/{suggestionId}/dismiss',
    segment: 'documents',
    tag: 'Knowledge',
    summary: 'Dismiss a suggested edit. Editor only.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404, 405, 410],
  },
  {
    method: 'GET',
    path: '/documents/{id}/context',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      'What an agent is handed before it starts (`get_context`): the Always in Context pages as Markdown in tree order, each taken while it fits the 8,000 token budget, the ones left out, and what the caller may do here (`role`, `scopes`). Each page handed to an agent counts as a read. Every role.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: 'KnowledgeAgentContextResponse',
    statuses: [200, 401, 403, 404, 405, 410],
  },
  {
    method: 'PUT',
    path: '/documents/{id}/agents/{tokenId}/scopes',
    segment: 'documents',
    tag: 'Knowledge',
    summary:
      "Set what one API token may do in this knowledgebase, as `{ scopes }` of `read`, `suggest` and `write`. A token nobody decided about holds `read` and `suggest`; a read-only token and a Viewer's agent hold `read` whatever is granted, and only an Editor's agent holds `write`. An Editor, signed in: never a token.",
    auth: 'clerk',
    tokenUsable: true,
    requestSchema: 'AgentScopesRequest',
    responseSchema: 'AgentScopesResponse',
    statuses: [200, 400, 401, 403, 404, 405, 410],
  },
  {
    method: 'GET',
    path: '/documents/{id}/tabs/{tabId}/versions',
    segment: 'documents',
    tag: 'Versions',
    summary:
      "A tab's earlier versions, newest first: kept after a pause in editing, before an agent's changes, before a restore, and when named. Anyone who can open the tab can list them.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: listOf('versions', 'VersionSummary'),
    statuses: [200, 401, 404, 410],
  },
  {
    method: 'GET',
    path: '/documents/{id}/tabs/{tabId}/versions/{versionId}',
    segment: 'documents',
    tag: 'Versions',
    summary: 'One version, with the tab as it was then.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: 'VersionReadResponse',
    statuses: [200, 401, 404, 410],
  },
  {
    method: 'POST',
    path: '/documents/{id}/tabs/{tabId}/versions',
    segment: 'documents',
    tag: 'Versions',
    summary: `Name This Version: keep the tab as it is now under a name. Named versions are kept until unnamed, up to ${VERSION_NAMED_MAX} a tab.`,
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: { type: 'object', properties: { name: nameField }, required: ['name'] },
    responseSchema: wrap('version', 'VersionSummary'),
    statuses: [201, 400, 401, 403, 404, 409, 410],
  },
  {
    method: 'PUT',
    path: '/documents/{id}/tabs/{tabId}/versions/{versionId}/name',
    segment: 'documents',
    tag: 'Versions',
    summary: 'Name, rename or unname a version (an empty or null name unnames it).',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: { name: { type: ['string', 'null'] } },
      required: ['name'],
    },
    responseSchema: wrap('version', 'VersionSummary'),
    statuses: [200, 400, 401, 403, 404, 409, 410],
  },
  {
    method: 'POST',
    path: '/documents/{id}/tabs/{tabId}/versions/{versionId}/restore',
    segment: 'documents',
    tag: 'Versions',
    summary:
      "Restore a version: its content written over the tab as one changeset by you, seen live by everyone, with the content it replaced kept first as a version (`undoVersionId`). The tab's name, lock and comments stay as they are.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: 'VersionRestoreResponse',
    statuses: [200, 401, 403, 404, 409, 410, 413],
  },
  {
    method: 'POST',
    path: '/documents/{id}/tabs/{tabId}/versions/{versionId}/copy',
    segment: 'documents',
    tag: 'Versions',
    summary:
      "Make a Copy: a new tab after the last, holding the version's content without its comments. The tab it came from is untouched.",
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: { type: 'object', properties: { name: nameField } },
    responseSchema: 'VersionCopyResponse',
    statuses: [201, 401, 403, 404, 409, 410, 413],
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
    method: 'POST',
    path: '/documents/{id}/tabs/{tabId}/pages',
    segment: 'documents',
    tag: 'Documents',
    summary:
      'Change the pages of a tab (add, set, lay out, move, duplicate, delete; up to 50, as one edit) or write an article from Markdown. Switches the tab into Pages and reaches everyone with the document open. Answers each page with its rectangle on the canvas.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: ref('PagesRequest'),
    responseSchema: 'PagesAnswer',
    statuses: [200, 400, 401, 403, 404, 409, 410, 413],
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
    summary:
      'Delete a comment you wrote; an API token deletes only a comment marked ai (403 not_ai_comment).',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    statuses: [204, 401, 403, 404, 409, 410, 413],
  },
  {
    method: 'PUT',
    path: '/documents/{id}/tabs/{tabId}/comments/{commentId}',
    segment: 'documents',
    tag: 'Documents',
    summary:
      'Change the text of a comment you wrote, stamping editedAt; an API token changes only a comment marked ai (403 not_ai_comment).',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    requestSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
    statuses: [200, 400, 401, 403, 404, 409, 410, 413],
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
    method: 'POST',
    path: '/documents/{id}/tabs/{tabId}/comments/{commentId}/react',
    segment: 'documents',
    tag: 'Documents',
    summary:
      'Add or take back your reaction (one of six emoji) on a comment, as a person; agents read reactions only.',
    auth: 'guest-or-clerk',
    requestSchema: {
      type: 'object',
      properties: {
        emoji: {
          type: 'string',
          enum: ['thumbs-up', 'thumbs-down', 'laugh', 'hooray', 'heart', 'eyes'],
        },
        on: { type: 'boolean' },
        // Read by nobody: the reaction is kept under the caller's server-derived collab key. Older editors send it.
        key: { type: 'string' },
      },
      required: ['emoji', 'on'],
    },
    statuses: [204, 400, 401, 403, 404, 405, 409, 410, 413],
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
    path: '/documents/{id}/notify-action',
    segment: 'documents',
    tag: 'Documents',
    summary:
      "Email a teammate that an action on this document was assigned to them (docs/specs/012-collaboration/assigned-actions.md). The caller has joined the team and can open the document; the assignee is one of the team's joined or invited people. Best-effort; the assignee may have turned these emails off. `email: false` sends only the phone notification, which links `tabId` and `elementId` when given.",
    auth: 'clerk',
    requestSchema: {
      type: 'object',
      properties: {
        teamId: { type: 'string' },
        assigneeUserId: { type: 'string' },
        assigneeMemberId: { type: 'string' },
        actionName: { type: 'string' },
        description: { type: 'string' },
        email: { type: 'boolean' },
        tabId: { type: 'string' },
        elementId: { type: 'string' },
      },
      required: ['teamId', 'actionName'],
    },
    statuses: [202, 400, 401, 403, 404],
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
    path: '/documents/{id}/tabs',
    segment: 'documents',
    tag: 'Documents',
    summary:
      "The document's tabs alone, in order: id and name (kind is always null: every tab holds pages), without their content. Read-gated like GET /documents/{id}; a tab's share link sees its own tab alone. What the Share dialog's tab picker reads.",
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
    method: 'POST',
    path: '/documents/{id}/room-ticket',
    segment: 'documents',
    tag: 'Documents',
    summary:
      'Mint a one-time ticket for opening the realtime room: pass it to the WebSocket upgrade as `?t=`. Same access policy as a read, share password included. Exempt from the write rate limit.',
    auth: 'guest-or-clerk',
    query: [
      {
        name: 'cap',
        required: false,
        description:
          '`view` for a view-only ticket: it admits at view whatever your level, and a read-only token may mint it.',
      },
    ],
    responseSchema: {
      type: 'object',
      properties: {
        ticket: { type: 'string' },
        expiresAt: {
          type: 'integer',
          description: 'A view-only ticket: when it lapses, epoch milliseconds.',
        },
        level: {
          type: 'string',
          enum: ['view', 'participate', 'edit'],
          description:
            'A view-only ticket: your own level on the document (always view for a read-only token). The ticket still admits at view.',
        },
      },
      required: ['ticket'],
    },
    statuses: [200, 400, 404, 410],
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
    summary:
      'Map each image to the items, in every app, that reference it, and list the images that could not be checked.',
    auth: 'guest-or-clerk',
    tokenUsable: true,
    responseSchema: {
      type: 'object',
      properties: {
        // Image id to the items placing it; an image placed nowhere is absent.
        usage: {
          type: 'object',
          additionalProperties: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                app: { type: 'string' },
                // In the owner's Trash: still a use.
                trashed: { type: 'boolean' },
              },
              required: ['id', 'name', 'app'],
            },
          },
        },
        // Images whose items could not be checked (past 5,000, or a failed lookup): never unused.
        unchecked: { type: 'array', items: { type: 'string' } },
        // The media service or the index was unreachable: nothing was checked.
        unknown: { type: 'boolean' },
      },
      required: ['usage', 'unchecked'],
    },
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

  // ---- Library (liveworkspace/docs/specs/006-media/libraries.md) ----
  {
    method: 'GET',
    path: '/library',
    segment: 'library',
    tag: 'Library',
    summary: "The caller's Personal and team Library items this app can draw.",
    auth: 'guest-or-clerk',
    tokenUsable: false,
    statuses: [200, 400, 503],
  },
  {
    method: 'POST',
    path: '/library',
    segment: 'library',
    tag: 'Library',
    summary: "Save elements to Personal or one of the caller's teams.",
    auth: 'guest-or-clerk',
    tokenUsable: false,
    statuses: [201, 400, 403, 404, 409, 413, 503],
  },
  {
    method: 'PUT',
    path: '/library/folders',
    segment: 'library',
    tag: 'Library',
    summary: 'Rename a folder (its owner for Personal, a team admin for a team).',
    auth: 'guest-or-clerk',
    tokenUsable: false,
    statuses: [200, 400, 403, 404, 503],
  },
  {
    method: 'POST',
    path: '/library/{id}/place',
    segment: 'library',
    tag: 'Library',
    summary: "An item's elements to place, its team pictures copied to the caller's gallery.",
    auth: 'guest-or-clerk',
    tokenUsable: false,
    statuses: [200, 400, 403, 404, 503],
  },
  {
    method: 'PUT',
    path: '/library/{id}',
    segment: 'library',
    tag: 'Library',
    summary: 'Rename an item.',
    auth: 'guest-or-clerk',
    tokenUsable: false,
    statuses: [200, 400, 403, 404, 503],
  },
  {
    method: 'DELETE',
    path: '/library/{id}',
    segment: 'library',
    tag: 'Library',
    summary: 'Delete an item.',
    auth: 'guest-or-clerk',
    tokenUsable: false,
    statuses: [200, 400, 403, 404, 503],
  },

  // ---- API tokens ----
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

  // Every other Community read, and likes and reports, are the liveworkspace Community service's
  // (liveworkspace/docs/specs/007-community/community.md), which the Community pages call directly.
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

  // ---- Shared with you ----
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
    statuses: [200, 400, 401, 403, 404, 503],
  },

  // ---- Walkthroughs (liveworkspace/docs/specs/006-media/walkthroughs.md) ----
  {
    method: 'GET',
    path: '/walkthroughs',
    segment: 'walkthroughs',
    tag: 'Walkthroughs',
    summary: "The document's walkthroughs, newest first, and whether the caller may record one.",
    auth: 'guest-or-clerk',
    tokenUsable: false,
    query: [{ name: 'd', required: true, description: 'The document the walkthroughs belong to.' }],
    statuses: [200, 400, 404, 503],
  },
  {
    method: 'POST',
    path: '/walkthroughs',
    segment: 'walkthroughs',
    tag: 'Walkthroughs',
    summary:
      "Start a walkthrough: its title and events, and its media's type and size (an Editor).",
    auth: 'guest-or-clerk',
    tokenUsable: false,
    query: [{ name: 'd', required: true, description: 'The document the walkthroughs belong to.' }],
    statuses: [201, 400, 403, 404, 413, 415, 503],
  },
  {
    method: 'GET',
    path: '/walkthroughs/{id}',
    segment: 'walkthroughs',
    tag: 'Walkthroughs',
    summary: 'One walkthrough with its events.',
    auth: 'guest-or-clerk',
    tokenUsable: false,
    query: [{ name: 'd', required: true, description: 'The document the walkthroughs belong to.' }],
    statuses: [200, 400, 404, 503],
  },
  {
    method: 'DELETE',
    path: '/walkthroughs/{id}',
    segment: 'walkthroughs',
    tag: 'Walkthroughs',
    summary: 'Delete a walkthrough (its recorder, or an Editor of the document).',
    auth: 'guest-or-clerk',
    tokenUsable: false,
    query: [{ name: 'd', required: true, description: 'The document the walkthroughs belong to.' }],
    statuses: [200, 400, 403, 404, 503],
  },
  {
    method: 'GET',
    path: '/walkthroughs/{id}/media',
    segment: 'walkthroughs',
    tag: 'Walkthroughs',
    summary: "A walkthrough's recording.",
    auth: 'guest-or-clerk',
    tokenUsable: false,
    query: [{ name: 'd', required: true, description: 'The document the walkthroughs belong to.' }],
    responseSchema: { type: 'string', format: 'binary' },
    responseMediaType: 'video/webm',
    statuses: [200, 400, 404, 503],
  },
  {
    method: 'PUT',
    path: '/walkthroughs/{id}/media',
    segment: 'walkthroughs',
    tag: 'Walkthroughs',
    summary: "A started walkthrough's recording, streamed (the Editor who started it).",
    auth: 'guest-or-clerk',
    tokenUsable: false,
    query: [{ name: 'd', required: true, description: 'The document the walkthroughs belong to.' }],
    requestSchema: { type: 'string', format: 'binary' },
    statuses: [200, 400, 403, 404, 409, 413, 415, 503],
  },

  // ---- Preferences ----
  {
    method: 'GET',
    path: '/preferences',
    segment: 'preferences',
    tag: 'Account',
    summary:
      "Get the caller's settings: those every app shares and liveknowledge' own, as one object. null where this deployment keeps none (the editor keeps them in the browser).",
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
      'Change settings: each key named takes its value whole, a key set to null is deleted, keys not named stay.',
    auth: 'guest-or-clerk',
    requestSchema: {
      type: 'object',
      properties: { prefs: { type: 'object' } },
      required: ['prefs'],
    },
    statuses: [204, 400, 401, 404, 413, 503],
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
    method: 'POST',
    path: '/account/deletion-code',
    segment: 'account',
    tag: 'Account',
    summary:
      'Email the signed-in account the 6-digit code that deleting it needs (10 minutes, 3 tries).',
    auth: 'clerk',
    responseSchema: { type: 'object', properties: { sent: { type: 'boolean' } } },
    statuses: [200, 401, 429, 502, 503],
  },
  {
    method: 'DELETE',
    path: '/account',
    segment: 'account',
    tag: 'Account',
    summary:
      'With the code emailed to it, delete the signed-in account and all of its data (documents, tokens, ...).',
    auth: 'clerk',
    requestSchema: {
      type: 'object',
      properties: { code: { type: 'string' } },
      required: ['code'],
    },
    responseSchema: { type: 'object', properties: { deleted: { type: 'number' } } },
    statuses: [200, 400, 401, 403, 409, 429, 502, 503],
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
  // A document's Automations (docs/specs/013-workspace/automations.md): the platform's operations
  // (@liveworkspace/automations/room openapi.ts) under this api's collection.
  ...itemAutomationOperations({ collection: 'documents', itemWord: 'document' }),
];
