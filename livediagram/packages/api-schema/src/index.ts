// Wire-format type definitions for the livediagram API — the single
// source of truth for what travels between the `api` Cloudflare
// Worker and the `live` Next.js editor.
//
// Both the server (which constructs these payloads from D1 rows) and
// the client (which consumes them in api-client.ts) import from here,
// so the two sides cannot drift. Adding a new field on the server
// without updating the client (or vice versa) used to be a routine
// hazard; defining the shapes once means the typechecker catches it.
//
// Naming convention: bare nouns (`LiveDoc`, `Folder`, `ShareLink`).
// The api worker re-exports some under its own aliases (`DocumentDTO` etc.);
// new code should prefer the canonical names here.

import type { ShareLinkExpiry, ShareRole } from '@liveworkspace/api-schema/share-links';
import type { DocumentSource } from '@liveworkspace/api-schema/document-source';
import type { EditorMode, Tab } from '@livediagram/document';
import type { CreationTabKind, TemplateFamily } from './placement-defaults';

export type { AvatarClothing, AvatarConfig, AvatarGender, AvatarHair, AvatarSize } from './avatar';

// ---------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------

// Full document payload returned by `GET /api/documents/:id`. After
// per-tab storage (docs/specs/006-document/per-tab-storage.md), `tabs` is a list of `TabSummary`
// (metadata only) — element content is fetched separately via
// `GET /api/documents/:id/tabs/:tabId`.
export type LiveDoc = {
  id: string;
  ownerId: string;
  name: string;
  tabs: TabSummary[];
  // Sharing state. `shareable` is the on/off switch the owner toggles
  // via POST/DELETE /api/documents/:id/share. `shareCode` is the short
  // code that goes into the share URL; null when never shared,
  // rotated when re-shared after a revoke.
  shareable: boolean;
  shareCode: string | null;
  // The document's Community post (docs/specs/025-community/community.md): 'listed', 'hidden', or
  // null / absent when it has none. Owner-only: every other reader gets null.
  communityState?: 'listed' | 'hidden' | null;
  // Folder placement. null means the document sits at the root of its
  // space. See docs/specs/013-workspace/folders.md.
  folderId: string | null;
  // Team library placement (docs/specs/013-workspace/team-shared-documents.md). null = the owner's personal
  // tree; non-null = this team's shared library (where folderId then
  // refers to one of THAT team's folders, or null for the team's
  // root). Joined members of the team get edit access.
  teamId: string | null;
  // Provenance (docs/specs/013-workspace/folders.md). null = made by a person; non-null = generated
  // (see DocumentSource). Set on create, never rewritten by meta updates.
  source: DocumentSource | null;
  // Slide deck (docs/specs/012-collaboration/presentation-mode.md), serialised `StoredPresentation` JSON, or null when
  // the document has no deck (every document until somebody builds one).
  // Deliberately absent from DocumentSummary: the Explorer lists documents and
  // has no use for their decks, and a deck is the one metadata field that can
  // grow with the document.
  presentation: string | null;
  savedAt: number;
  createdAt: number;
  // Owner's display name + avatar colour, joined server-side from the
  // participants table so visitors can render "Owner: <name>" without
  // waiting for the owner to come online in the realtime room. Null
  // when the owner has no participant row yet (e.g. signed-in
  // owners who never set a name on a document); the UI falls back to
  // hiding the badge in that case.
  ownerName: string | null;
  ownerColor: string | null;
} & RecordedIntent;

// The creation intent recorded on a document when it was created, written once by the create and
// never re-derived (docs/specs/013-workspace/default-folders.md "Recorded intent"). A null `opensIn`
// is unknown (made before intents were recorded, or by a create without one), never Diagram, and
// the other two are then unknown too; with a known `opensIn`, `tabKind` is known and a null
// `templateFamily` means made from no family.
export type RecordedIntent = {
  opensIn: EditorMode | null;
  tabKind: CreationTabKind | null;
  templateFamily: TemplateFamily | null;
};

// Lightweight list projection — drops `tabs` so listing 100 documents
// doesn't ship 100 tab arrays.
export type DocumentSummary = {
  id: string;
  ownerId: string;
  name: string;
  shareable: boolean;
  shareCode: string | null;
  // Listed in the public Community (docs/specs/025-community/community.md "In the Explorer"). Only the listed
  // state: a listed post is public anyway, while a hidden post's state stays owner-only (LiveDoc.communityState).
  communityListed: boolean;
  folderId: string | null;
  // Team library placement (docs/specs/013-workspace/team-shared-documents.md) — see LiveDoc.teamId.
  teamId: string | null;
  // Provenance (docs/specs/013-workspace/folders.md) — see LiveDoc.source.
  source: DocumentSource | null;
  savedAt: number;
  createdAt: number;
  // Nothing drawn: the first tab has no elements, or there is no tab
  // (docs/specs/006-document/document-snapshots.md). Its row shows the empty sketch and asks for no thumbnail.
  empty: boolean;
  // What the Details view shows (docs/specs/013-workspace/explorer-details-view.md), summed over the
  // document's tabs; null when it has no tab or one of its tabs is not counted yet.
  stats: DocumentStats | null;
} & RecordedIntent;

// A document's tab stats (docs/specs/013-workspace/explorer-details-view.md "Where the numbers come
// from"): the mode of the tab written last, and elements, comments and stored bytes over every tab.
export type DocumentStats = {
  mode: EditorMode;
  elements: number;
  comments: number;
  bytes: number;
};

// A document's shared tabs: how many of its tabs are also linked into another
// document, and how many other documents hold them. What the delete and Take
// Offline confirmations say stays behind
// (docs/specs/006-document/tab-document-many-to-many.md, "Shared-tab notice").
export type SharedTabsSummary = {
  tabs: number;
  documents: number;
};

// ---------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------

// One row of `LiveDoc.tabs`. Stored in D1 with id + document_id + name
// + order_index as columns and the rest of the payload as a JSON
// `data` column. The summary projection is what list / document
// responses ship; the full payload (below) is fetched per-tab on
// demand so the editor only ever holds the tabs the user opens.
export type TabSummary = {
  id: string;
  documentId: string;
  name: string;
  orderIndex: number;
  updatedAt: number;
  // Per-document folder name (docs/specs/006-document/tab-folders.md), read from the document_tabs
  // link row. Optional / omitted = the tab is loose (no folder). The
  // TabBar groups contiguous same-folder tabs under one chip.
  folder?: string;
  // Set for a tab outside a tab-scoped visitor's scope (docs/specs/013-workspace/tab-scoped-share-links.md):
  // its name is blanked, its folder dropped, and its content never served.
  outOfScope?: true;
};

// Full tab payload returned by `GET /api/documents/:id/tabs/:tabId`:
// the editor's `Tab` (elements + comments + theme + canvas) plus the
// row's audit metadata. `folder` here is the per-document membership
// from the document_tabs link (docs/specs/006-document/tab-folders.md), distinct from anything in the
// tab body — it is never stored in the `tabs.data` blob.
//
// `rev` (docs/specs/024-agents/agent-changesets.md "The tab revision") advances with every write
// of the tab: an editor save, a changeset, a revert, a rename. The read also carries it as a weak ETag.
export type TabRecord = Tab & {
  rev: number;
  documentId: string;
  orderIndex: number;
  updatedAt: number;
};

// ---------------------------------------------------------------------
// Share links (docs/specs/014-identity/auth-and-guest-access.md, docs/specs/015-api/api.md)
// ---------------------------------------------------------------------

// What a share link is for (docs/specs/025-community/community.md): an ordinary link the owner manages in the Share
// dialog, or the community link a Community post owns (never listed, never expires, no room, no comments).
export type SharePurpose = 'share' | 'community';

export type ShareLink = {
  code: string;
  documentId: string;
  role: ShareRole;
  createdAt: number;
  // Expiry (docs/specs/013-workspace/share-link-expiry.md). `expiry` is the duration chosen at creation —
  // kept so Extend re-applies the same lifetime. `expiresAt` is the
  // enforcement deadline (ms epoch); null = never expires. A link
  // with `expiresAt` in the past is "inactive": it stops resolving /
  // authorising but stays listed for the owner to delete or extend.
  expiry: ShareLinkExpiry;
  expiresAt: number | null;
  // Tab scope (docs/specs/013-workspace/tab-scoped-share-links.md): the one tab this link opens, or null
  // for All tabs.
  tabId: string | null;
  // 'community' only on a Community post's own link; the owner's list never carries one.
  purpose: SharePurpose;
};

// ---------------------------------------------------------------------
// Images (docs/specs/009-elements/images.md)
// ---------------------------------------------------------------------

// Canonical hash function for the X-Image-Sha256 wire-format header.
// Lives here so the client and server can't drift on the dedup key
// (see @liveworkspace/api-schema/sha256 for the rationale).
export { sha256Hex } from '@liveworkspace/api-schema/sha256';
export { pkceChallenge } from '@liveworkspace/api-kit/oauth';

// Worker-safe base64 / base64url encoders for raw bytes, shared by both
// workers and the editor (see @liveworkspace/api-kit/bytes).
export {
  base64ToBytes,
  bytesToBase64,
  bytesToBase64Url,
  randomBase64Url,
} from '@liveworkspace/api-kit/bytes';

// Image magic-number sniffing and the server-side image embedder both
// workers render tabs with, and the header size it budgets pixels by (see @liveworkspace/api-schema/image-sniff, ./embed-images.ts,
// @liveworkspace/api-schema/image-size).
export { sniffImageType } from '@liveworkspace/api-schema/image-sniff';
export { imagePixelSize } from '@liveworkspace/api-schema/image-size';
export { embedTabImages, tabImageIds, type EmbedImageSource } from './embed-images';

// Shared display-casing for preset values (template ids, theme names,
// telemetry action / type enums). One definition so the live editor and
// the telemetry dashboard can't drift (see @liveworkspace/api-schema/title-case).
export { headlineCase, titleCase } from '@liveworkspace/api-schema/title-case';
export { objectOrEmpty } from '@liveworkspace/api-kit/request-body';
// The document format number an editor compares (docs/specs/016-platform/new-version-prompt.md).
export { DOCUMENT_FORMAT, DOCUMENT_FORMAT_HEADER, parseDocumentFormat } from './document-format';
// The live build id a running editor compares (docs/specs/016-platform/stale-builds.md).
export { BUILD_ID_HEADER, parseBuildId } from './build-id';

// Bearer-token and loopback-host reading, shared by the api and mcp workers
// so the two can't disagree on what a request presented (see @liveworkspace/api-kit/request-auth).
export {
  bearerTokenOf,
  isAccountIdShape,
  isLoopbackHostname,
  oauthRedirectUrl,
} from '@liveworkspace/api-kit/request-auth';

// Response body for GET /api/capabilities.
export type CapabilitiesResponse = {
  // Whether the sticky-note photo reader has a model (docs/specs/021-event-storming/note-reader.md).
  aiEnabled: boolean;
  // For the CLI (docs/specs/015-api/blueprints/cli.md "Capabilities"), each optional so an older worker parses:
  // where the api answers, whether sign-in exists, the OAuth server, the stored document format, and the
  // oldest CLI accepted for writes.
  apiBase?: string;
  authEnabled?: boolean;
  oauthIssuer?: string;
  documentFormat?: number;
  cli?: { minVersion: string };
  // True only when the deployment has the Email Service `EMAIL` binding (docs/specs/014-identity/transactional-email.md). The
  // editor app hides the email-notification toggles (docs/specs/014-identity/profile-and-email-notifications.md) when false,
  // since they'd be inert without an email backend. Optional so an older
  // client / a fail-closed default still parses.
  emailEnabled?: boolean;
  // The Community's off switch (docs/specs/025-community/community.md "Turning the Community off"). Only an explicit
  // false hides it, so an older worker that omits it leaves the Community showing.
  communityEnabled?: boolean;
};

// Per-day buckets for the trend charts on the dashboard. `days` is
// 30 UTC-midnight timestamps oldest -> newest; `totals[i]` is total
// events on `days[i]`; `byCategory[category][i]` is the per-category
// count on the same day. Pre-aggregated server-side so the dashboard
// can render the sparkline + stacked-area without any client work.
//
// A link card's unfurl (GET /api/unfurl), every product's (@liveworkspace/api-kit/unfurl).
export type { UnfurlResult } from '@liveworkspace/api-kit/unfurl';

export * from '@liveworkspace/api-schema/access-levels';
export * from './participant-colours';
export * from '@liveworkspace/api-schema/image-limits';
export * from './cta-sources';
export * from './page-views';
export * from './read-notes';
export * from './poll';
export * from './room-messages';
export * from './changesets';
export * from './telemetry-schema';
export * from './timing-telemetry';
export * from './server-emitted-events';
export * from './error-telemetry';
export * from './timeline';
export * from './activity';
export * from './responses';
export * from './trash';
export { upgradeLegacyPreferences } from './legacy-preferences';
// A document's own dates on create (docs/specs/015-api/api.md "Document dates"): the worker's
// check, and the editor's before it sends an imported board's dates.
export * from '@liveworkspace/api-schema/document-dates';
// A tab's size cap, D1's row cap less headroom (docs/specs/015-api/api.md "Tab size"): the worker
// enforces it, the editor checks it before sending.
export * from '@liveworkspace/api-schema/tab-size';
export * from './shape-libraries';

// Placement on create: the shape and its named refusals (docs/specs/013-workspace/folders.md).
export {
  PLACEMENT_REJECTIONS,
  isPlacementRejection,
  type DocumentPlacement,
  type PlacementRejection,
} from '@liveworkspace/api-schema/placement';

// Default folders: their entries and the creation intent a create carries
// (docs/specs/013-workspace/default-folders.md).
export * from './placement-defaults';
// The Explorer filter lens's Mode values (docs/specs/013-workspace/explorer-filters.md).
export * from './lens-modes';
// Explorer Home: the open marker and the use window (docs/specs/013-workspace/explorer-home.md).
export * from './home';
export * from './drag-preview';
export * from './avatar-say';
// Within reach: N most used plus N recent (docs/specs/004-interface-design/within-reach.md).
export * from '@liveworkspace/api-schema/within-reach';
// Making a document is a use, a bulk import is not (docs/specs/013-workspace/explorer-home.md).
export * from '@liveworkspace/api-schema/creation-use';
// Document views and ref refusals (docs/specs/024-agents/document-views.md).
export * from './document-views';
// The diagram lint's report (docs/specs/024-agents/diagram-lint.md).
export * from './lint';
export * from '@liveworkspace/api-schema/ref-errors';
// The retired returning-visitor note's storage names, and the snapshot SVG helpers
// (docs/specs/019-marketing/returning-visitor.md, docs/specs/006-document/document-snapshots.md).
export * from './recent-diagrams';

export * from '@liveworkspace/api-kit/api-token';
export * from '@liveworkspace/api-schema/document-source';
export * from '@liveworkspace/api-schema/catalogues';
export * from '@liveworkspace/api-schema/comment-threads';
export * from '@liveworkspace/api-schema/agent-presence';
// The Community's shared contract is liveworkspace's (liveworkspace/docs/community.md); re-exported so the
// editor, the Community pages and the api read it from here as before.
export * from '@liveworkspace/community';
export * from './community-paths';
export * from './document-paths';
export * from '@liveworkspace/api-schema/http-errors';
export * from './oauth-clients';
// Workbench embeds (docs/specs/013-workspace/workbench-embeds.md).
export * from './workbench';
export * from './workbench-messages';
export * from './mcp-origin';

// The readable signed-in hint cookie the api sets and the apps read (see ./signed-in-hint.ts).
export { SIGNED_IN_HINT_COOKIE, signedInHintOf } from './signed-in-hint';

// The wire shapes every product shares, liveworkspace's (@liveworkspace/api-schema): folders, API tokens, teams,
// share-link levels and lifetimes, participants and the image gallery's row.
export * from '@liveworkspace/api-schema/folders';
export * from '@liveworkspace/api-schema/api-tokens';
export * from '@liveworkspace/api-schema/teams';
export * from '@liveworkspace/api-schema/share-links';
export * from '@liveworkspace/api-schema/participants';
export * from '@liveworkspace/api-schema/image-summary';
