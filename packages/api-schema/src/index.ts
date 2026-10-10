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

import type { AccessLevel } from './access-levels';
import type { DocumentSource } from './document-source';
import type { DriveMode } from './drive';
import type { BackgroundPattern, EditorMode, ShapeKind, Tab } from '@livediagram/document';
import type { CreationTabKind, TemplateFamily } from './placement-defaults';
import type { ItemTypeCatalogue } from '@livediagram/items';

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
  // The document's type catalogue (docs/specs/026-plan/item-types.md): its own item types, or null
  // (or absent, from an older client or record) for the built-in ones. Written only by
  // PUT /documents/:id/item-types.
  itemTypes?: ItemTypeCatalogue | null;
  savedAt: number;
  createdAt: number;
  // Owner's display name + avatar colour, joined server-side from the
  // participants table so visitors can render "Owner: <name>" without
  // waiting for the owner to come online in the realtime room. Null
  // when the owner has no participant row yet (e.g. Clerk-authed
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
} & RecordedIntent;

// A document's shared tabs: how many of its tabs are also linked into another
// document, and how many other documents hold them. What the delete and Take
// Offline confirmations say stays behind
// (docs/specs/006-document/tab-document-many-to-many.md, "Shared-tab notice").
export type SharedTabsSummary = {
  tabs: number;
  documents: number;
};

// One row of the "Shared with you" list (shared_with, migration 0010):
// a document a non-owner has previously opened via a share link. The api
// worker (`listSharedWith` in db/shared.ts) builds this by joining
// shared_with → documents → participants; the live editor's Explorer
// renders it. Canonical home here so the worker's emit and the client's
// read can't drift apart (consistency review #7) — both import this one
// type instead of redeclaring the shape on each side.
export type SharedWithItem = {
  id: string;
  name: string;
  savedAt: number;
  // The role the visitor was granted on the share link they used.
  role: ShareRole;
  // Still-live share code for that same role, so the client can rebuild
  // the openable `/document/<id>?s=<code>` URL — without it the link
  // lands on the owner-only path and 404s. The worker filters out rows
  // whose share was revoked (no code left), so this is never null here.
  shareCode: string;
  // The scope the visitor was granted (docs/specs/013-workspace/tab-scoped-share-links.md); null = All tabs.
  // `shareCode` always carries this same scope, never a broader one.
  tabId: string | null;
  // Owner's display name + avatar colour, joined from participants.
  // Nullable: Clerk-authed owners may have no participant row yet, so
  // the UI shows an "Unknown owner" placeholder.
  ownerName: string | null;
  ownerColor: string | null;
  // Nothing drawn on the tab this visitor sees (the scoped tab, else the first); see DocumentSummary.empty.
  empty: boolean;
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
// Folders (docs/specs/013-workspace/folders.md)
// ---------------------------------------------------------------------

// A folder row. `parentId === null` means the folder lives at the
// tree root. `teamId` (docs/specs/013-workspace/team-shared-documents.md): null = a personal folder gated on
// `ownerId`; non-null = a folder in that team's shared library,
// gated on joined membership (ownerId then records the creator for
// audit only).
export type Folder = {
  id: string;
  ownerId: string;
  parentId: string | null;
  teamId: string | null;
  name: string;
  createdAt: number;
  updatedAt: number;
};

// ---------------------------------------------------------------------
// Custom themes (docs/specs/011-theme/custom-themes.md)
// ---------------------------------------------------------------------

// The themable payload of a custom theme — the same fields a built-in
// `ThemeDefinition` carries MINUS its `id` / `label` (which live on the
// row) and the `extra` "show more" flag (custom themes are never
// gated). Stored as a JSON string in the `custom_themes.definition`
// column; this is the parsed shape the api emits and the live editor
// materialises into a full ThemeDefinition. Kept structurally in step
// with `apps/live/lib/themes.ts` ThemeDefinition by the editor's
// `materialiseCustomTheme` helper.
export type CustomThemeDefinition = {
  backgroundColor: string;
  backgroundPattern: BackgroundPattern;
  patternColor: string;
  // Pattern opacity 0..1 (the canvas pattern-opacity slider). Optional;
  // absent / undefined means fully opaque.
  backgroundOpacity?: number;
  elementFill: string | null;
  elementStroke: string | null;
  elementText: string | null;
  palette?: { fill: string; stroke: string; text: string }[];
  rootColor?: { fill: string; stroke: string; text: string };
  shapeColors?: Partial<Record<ShapeKind, { fill?: string; stroke?: string; text?: string }>>;
};

// A saved custom theme. `id` is `custom:<uuid>` so it can never collide
// with a built-in ThemeId and is a cheap "is this custom?" check. It is
// stored on `Tab.theme` like any other theme id. Owner-scoped (docs/specs/014-identity/auth-and-guest-access.md
// hybrid identity), guests included.
export type CustomTheme = {
  id: string;
  ownerId: string;
  name: string;
  definition: CustomThemeDefinition;
  createdAt: number;
  updatedAt: number;
};

// ---------------------------------------------------------------------
// API tokens (docs/specs/015-api/public-api-and-tokens.md)
// ---------------------------------------------------------------------

// An external API credential, owner-scoped to a Clerk account. The wire
// shape NEVER carries the secret or its hash — only the public id +
// metadata shown in the management list. The plaintext is returned once,
// at creation, on a separate response field (see the /api/tokens route).
export type ApiToken = {
  id: string;
  name: string | null;
  createdAt: number;
  // Null until the token is first used to authenticate a request.
  lastUsedAt: number | null;
  // Fixed at createdAt + 6 months (docs/specs/015-api/public-api-and-tokens.md).
  expiresAt: number;
  // Read-only token (docs/specs/015-api/mcp-server.md §4.11): may only make GET/HEAD requests; the api
  // rejects its writes. Minted read-only via the MCP consent screen.
  readOnly: boolean;
};

// ---------------------------------------------------------------------
// Teams (docs/specs/013-workspace/teams.md)
// ---------------------------------------------------------------------

export type TeamRole = 'admin' | 'member';

// A team row. No owner column: ownership is expressed through the
// Admin role on the member link rows, so a team survives its creator
// leaving. `organisation` is free text (docs/specs/013-workspace/teams.md), not a foreign key.
export type Team = {
  id: string;
  name: string;
  organisation: string | null;
  createdAt: number;
  updatedAt: number;
};

// `GET /api/teams` list projection: the team plus the caller's own
// role (drives which management controls the UI shows) and a member
// count for the sidebar badge, both joined server-side so the list
// doesn't need N member fetches.
export type TeamListItem = Team & {
  myRole: TeamRole;
  memberCount: number;
};

// The accept/decline handshake state (docs/specs/013-workspace/teams.md). An 'invited' row
// grants no membership: it waits in the invitee's Invites section
// until they accept ('joined') or decline (row deleted).
export type TeamMemberStatus = 'invited' | 'joined';

// One member link row. `userId` is the Clerk user id, null while the
// invite hasn't connected yet (docs/specs/013-workspace/teams.md's lazy claim fills it in —
// connecting identifies the person, it does NOT accept for them).
// `email` is the lowercased invite address; null only on a creator
// row minted when the deployment's JWT carries no email claim. One of
// the two is always set.
export type TeamMember = {
  id: string;
  teamId: string;
  userId: string | null;
  email: string | null;
  role: TeamRole;
  status: TeamMemberStatus;
  // The member's display name (docs/specs/013-workspace/teams.md), resolved from their
  // participant profile once they've joined and used the app. Null on
  // a pending invite or a member with no profile yet; the client then
  // falls back to the invite email's local part.
  name: string | null;
  // The joined member's published profile picture (docs/specs/014-identity/profile-picture.md §5), or
  // null (pending invite, no picture, or the switch off).
  pictureUrl: string | null;
  createdAt: number;
  updatedAt: number;
};

// One row of `GET /api/teams/invites`: the caller's own pending
// member row plus enough of the team to decide (name, organisation,
// how many people have actually joined).
export type TeamInvite = {
  memberId: string;
  team: Team;
  memberCount: number;
  invitedAt: number;
};

// The team's shareable invite link (docs/specs/013-workspace/teams.md): an admin turns it on, it
// expires after a week, and anyone signed in who opens it can join.
// Null in the team detail when off / expired. Admin-only.
export type TeamInviteLink = {
  token: string;
  expiresAt: number;
};

// What a join token resolves to (the /join landing reads this to show
// "Join <team>?"), plus whether the caller is already a member.
export type TeamInviteLinkInfo = {
  team: Team;
  memberCount: number;
  alreadyMember: boolean;
};

// Result of joining via an invite link.
export type TeamInviteLinkJoin = {
  teamId: string;
  alreadyMember: boolean;
};

// ---------------------------------------------------------------------
// Share links (docs/specs/014-identity/auth-and-guest-access.md, docs/specs/015-api/api.md)
// ---------------------------------------------------------------------

// A share link's access level (docs/specs/013-workspace/share-roles.md): Viewer, Participant or Editor.
export type ShareRole = AccessLevel;

// What a share link is for (docs/specs/025-community/community.md): an ordinary link the owner manages in the Share
// dialog, or the community link a Community post owns (never listed, never expires, no room, no comments).
export type SharePurpose = 'share' | 'community';

// Lifetime chosen at link creation (docs/specs/013-workspace/share-link-expiry.md). 'never' is the default
// and the pre-expiry behaviour: the link works until revoked.
export type ShareLinkExpiry = 'never' | 'week' | 'month' | 'sixMonths';

// The fixed lifetimes in ms, shared by the api worker (computing
// `expiresAt` at create/extend time) and the live editor (rendering
// "6d left" countdowns) so the two sides can't disagree on what a
// "month" is. Calendar-ish approximations on purpose: share-link
// expiry is a security bound, not a billing period.
export const SHARE_LINK_EXPIRY_MS: Record<Exclude<ShareLinkExpiry, 'never'>, number> = {
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  sixMonths: 183 * 24 * 60 * 60 * 1000,
};

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
// Participants
// ---------------------------------------------------------------------

// A persisted participant row, returned by `POST /api/participants`
// when the editor registers identity. The live app wraps this in its
// own `Participant` type that adds presence status (`online` / `away`
// / `stale`) on top — that status is purely client-derived from idle
// time and never crosses the wire.
export type ParticipantRecord = {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  // The published profile picture (docs/specs/014-identity/profile-picture.md §6): set only by the
  // participant's own verified Clerk session, null when they have none or turned it off, and
  // returned only to signed-in callers (null for everyone else).
  pictureUrl: string | null;
};

// Realtime presence identity, broadcast to every connected peer: the room and the participant route clamp to
// these, and the editor clamps what it reads to them too.
export const MAX_PARTICIPANT_NAME_LEN = 120;
export const MAX_COLOR_LEN = 64;

// What the realtime room broadcasts as presence. Identical shape to
// `ParticipantRecord` minus `createdAt` — presence is concerned with
// "who is connected right now", not when they first registered.
export type ParticipantPresence = {
  id: string;
  name: string;
  color: string;
  // Server-resolved role inside this document. Set by the api worker
  // at WebSocket upgrade time before the request reaches the Durable
  // Object — derived from owner-id match (always 'edit') or the
  // share-code the visitor used to join. Optional so existing
  // hello frames keep parsing while clients catch up; missing value
  // is treated as "unknown role" by the UI (no badge surfaced). An access level
  // (docs/specs/013-workspace/share-roles.md); readers parse it with parseStoredLevel.
  role?: AccessLevel;
  // Id of the tab this participant is currently focused on. The room
  // remembers it from their `tab-focus` ops and echoes it in the
  // presence list so a LATE joiner learns where everyone already is —
  // tab-focus ops only fire on a switch, so without this a joiner would
  // default existing peers to the first tab until they happened to move.
  // Undefined until the participant's first tab-focus op lands.
  tabId?: string;
  // The tab in their other pane while they work side by side (docs/specs/007-editor/split-view.md
  // "Presence"), remembered from the same tab-focus ops so a late joiner sees it too. Undefined with
  // no split.
  besideTabId?: string;
  // The id this participant WRITES INTO THE DOCUMENT for anything recorded
  // per person — today the `responses` on a done check / estimate card /
  // temperature check (docs/specs/012-collaboration/participant-responses.md).
  //
  // It exists because `id` above cannot do that job. `id` is minted fresh by
  // the room for every socket (docs/specs/015-api/public-api-and-tokens.md §6), so it is unforgeable but also
  // unrecognisable: it changes on reconnect and matches nothing that was ever
  // saved. Joining a saved answer back to the person in the roster needs an
  // id that is STABLE across connections, and the owner id can't be it —
  // publishing that is exactly what §6 forbids.
  //
  // So this is a separate, per-browser random the client mints and keeps
  // (`livediagram:v2:collab-key`), relayed VERBATIM: unlike `id` and `role`
  // it is claimed, not verified. That is deliberate and costs nothing — it is
  // not a credential and grants nothing, and any edit-role peer could already
  // write any participant id straight into the document. Optional, so an
  // older client's hello still parses (the roster falls back to `id`, which
  // simply matches nothing — the behaviour before this field existed).
  key?: string;
  // The participant's published profile picture (docs/specs/014-identity/profile-picture.md §6). The
  // room keeps it only from a verified account session and sends it only to account sessions;
  // anonymous recipients get the roster without it.
  picture?: string;
};

// ---------------------------------------------------------------------
// Images (docs/specs/009-elements/images.md)
// ---------------------------------------------------------------------

// One row returned by `GET /api/images` (the gallery list) + the
// inner shape of the `POST /api/images` response (`{ image, deduped }`).
// The bytes themselves are fetched separately via
// `GET /api/images/<id>?d=<documentId>` (owner or share-code gated).
export type ImageSummary = {
  id: string;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
  originalName?: string;
  createdAt: number;
};

// Canonical hash function for the X-Image-Sha256 wire-format header.
// Lives here so the client and server can't drift on the dedup key
// (see ./sha256.ts for the rationale).
export { pkceChallenge, sha256Hex } from './sha256';

// Worker-safe base64 / base64url encoders for raw bytes, shared by both
// workers and the editor (see ./bytes.ts).
export { base64ToBytes, bytesToBase64, bytesToBase64Url, randomBase64Url } from './bytes';

// Image magic-number sniffing and the server-side image embedder both
// workers render tabs with (see ./image-sniff.ts, ./embed-images.ts).
export { sniffImageType } from './image-sniff';
export {
  embedTabImages,
  tabImageIds,
  type EmbedImageLimits,
  type EmbedImageSource,
} from './embed-images';

// Shared display-casing for preset values (template ids, theme names,
// telemetry action / type enums). One definition so the live editor and
// the telemetry dashboard can't drift (see ./title-case.ts).
export { titleCase } from './title-case';
// The document format number an editor compares (docs/specs/016-platform/new-version-prompt.md).
export { DOCUMENT_FORMAT, DOCUMENT_FORMAT_HEADER, parseDocumentFormat } from './document-format';
// The live build id a running editor compares (docs/specs/016-platform/stale-builds.md).
export { BUILD_ID_HEADER, parseBuildId } from './build-id';

// Bearer-token and loopback-host reading, shared by the api and mcp workers
// so the two can't disagree on what a request presented (see ./request-auth.ts).
export { bearerTokenOf, isClerkIdShape, isLoopbackHostname } from './request-auth';

export type AiMode = 'clean' | 'ask';

export type AiConversationTurn = { role: 'user' | 'assistant'; content: string };

// Request body for POST /api/ai.
export type AiRequest = {
  mode: AiMode;
  // Free-text instruction from the user (max 1 000 chars, enforced server-side).
  prompt: string;
  // All elements on the active tab (full context). Server uses focusIds
  // to tell the model which subset to act on; the rest is read-only context.
  elements: unknown[];
  // Name of the active tab, included in the system prompt for context.
  tabName: string;
  // IDs of the currently selected elements. When non-empty the model is
  // asked to focus its changes on these elements while treating the rest
  // as context only. Empty / absent = act on all elements.
  focusIds?: string[];
  // Last N conversation turns for multi-turn context. Kept short (≤ 6
  // turns) so the token cost stays bounded.
  history?: AiConversationTurn[];
};

// Response body for GET /api/capabilities.
export type CapabilitiesResponse = {
  aiEnabled: boolean;
  // For the CLI (docs/specs/015-api/blueprints/cli.md "Capabilities"), each optional so an older worker parses:
  // where the api answers, whether sign-in exists, the OAuth server, the stored document format, and the
  // oldest CLI accepted for writes.
  apiBase?: string;
  authEnabled?: boolean;
  oauthIssuer?: string;
  documentFormat?: number;
  cli?: { minVersion: string };
  // True only when the deployment has Resend configured (docs/specs/014-identity/transactional-email.md). The
  // live app hides the email-notification toggles (docs/specs/014-identity/profile-and-email-notifications.md) when false,
  // since they'd be inert without an email backend. Optional so an older
  // client / a fail-closed default still parses.
  emailEnabled?: boolean;
  // Google Drive mirror (docs/specs/022-drive-mirror/drive-mirror.md): how the deployment
  // gets Google access tokens. Optional so an older worker parses as 'off'.
  driveMode?: DriveMode;
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
export type UnfurlResult = {
  url: string;
  title?: string;
  siteName?: string;
  description?: string;
  image?: string;
  favicon?: string;
};

export * from './access-levels';
export * from './image-limits';
export * from './cta-sources';
export * from './page-views';
export * from './read-notes';
export * from './poll';
export * from './room-messages';
export * from './changesets';
export * from './items';
export * from './sheets';
export * from './telemetry-schema';
export * from './timing-telemetry';
export * from './server-emitted-events';
export * from './error-telemetry';
export * from './timeline';
export * from './activity';
export * from './responses';
export * from './trash';
export { upgradeLegacyPreferences } from './legacy-preferences';
export * from './drive';
export * from './profile-picture';
// A document's own dates on create (docs/specs/015-api/api.md "Document dates"): the worker's
// check, and the editor's before it sends an imported board's dates.
export * from './document-dates';
// A tab's size cap, D1's row cap less headroom (docs/specs/015-api/api.md "Tab size"): the worker
// enforces it, the editor checks it before sending.
export * from './tab-size';
export * from './shape-libraries';

// Placement on create: the shape and its named refusals (docs/specs/013-workspace/folders.md).
export {
  PLACEMENT_REJECTIONS,
  isPlacementRejection,
  type DocumentPlacement,
  type PlacementRejection,
} from './placement';

// Default folders: the keys in force and the creation intent a create carries
// (docs/specs/013-workspace/default-folders.md).
export * from './placement-defaults';
// Explorer Home: opens, Jump back in and What happened (docs/specs/013-workspace/explorer-home.md).
export * from './home';
export * from './drag-preview';
export * from './article-caret';
// Within reach: N most used plus N recent (docs/specs/004-interface-design/within-reach.md).
export * from './within-reach';
// Making a document is a use, a bulk import is not (docs/specs/013-workspace/explorer-home.md).
export * from './creation-use';
// Document views and ref refusals (docs/specs/024-agents/document-views.md).
export * from './document-views';
// The diagram lint's report (docs/specs/024-agents/diagram-lint.md).
export * from './lint';
export * from './ref-errors';
// Returning visitor (docs/specs/019-marketing/returning-visitor.md).
export * from './recent-diagrams';

// GET /api/tokens/current (docs/specs/015-api/blueprints/cli.md "Token self-service"): the token a request
// presented, for `livediagram auth status`. `role` is `full` or `read-only`.
export type CurrentTokenResponse = {
  accountId: string;
  accountName: string | null;
  tokenId: string;
  tokenName: string | null;
  role: 'full' | 'read-only';
  expiresAt: number | null;
};
export * from './api-token-format';
export * from './document-source';
export * from './catalogues';
export * from './comment-threads';
export * from './agent-presence';
export * from './community';
export * from './community-authors';
export * from './community-paths';
export * from './community-query';
export * from './document-paths';
export * from './http-errors';
export * from './oauth-clients';
// Workbench embeds (docs/specs/013-workspace/workbench-embeds.md).
export * from './workbench';
export * from './workbench-messages';
