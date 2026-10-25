// Wire-format type definitions for the liveplanner API — the single
// source of truth for what travels between the `api` Cloudflare
// Worker and the `live` Next.js editor.
//
// Both the server (which constructs these payloads from D1 rows) and
// the client (which consumes them in api-client.ts) import from here,
// so the two sides cannot drift. Adding a new field on the server
// without updating the client (or vice versa) used to be a routine
// hazard; defining the shapes once means the typechecker catches it.
//
// Naming convention: bare nouns (`Project`, `Folder`, `ShareLink`).
// The api worker re-exports some under its own aliases (`ProjectDTO` etc.);
// new code should prefer the canonical names here.

import type { ShareLinkExpiry, ShareRole } from '@liveworkspace/api-schema/share-links';
import type { Team, TeamMemberStatus } from '@liveworkspace/api-schema/teams';
import type { ProjectSource } from './project-source';
import type { EditorMode, Tab } from '@liveplanner/project';
import type { CreationTabKind, TemplateFamily } from './placement-defaults';
import type { ItemTypeCatalogue } from '@liveplanner/items';

// ---------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------

// Full project payload returned by `GET /api/projects/:id`. After
// per-tab storage (docs/specs/006-project/per-tab-storage.md), `tabs` is a list of `TabSummary`
// (metadata only) — element content is fetched separately via
// `GET /api/projects/:id/tabs/:tabId`.
export type Project = {
  id: string;
  ownerId: string;
  name: string;
  tabs: TabSummary[];
  // Sharing state. `shareable` is the on/off switch the owner toggles
  // via POST/DELETE /api/projects/:id/share. `shareCode` is the short
  // code that goes into the share URL; null when never shared,
  // rotated when re-shared after a revoke.
  shareable: boolean;
  shareCode: string | null;
  // Folder placement. null means the project sits at the root of its
  // space. See docs/specs/013-workspace/folders.md.
  folderId: string | null;
  // Team library placement (docs/specs/013-workspace/team-shared-projects.md). null = the owner's personal
  // tree; non-null = this team's shared library (where folderId then
  // refers to one of THAT team's folders, or null for the team's
  // root). Joined members of the team get edit access.
  teamId: string | null;
  // Provenance (docs/specs/013-workspace/folders.md). null = made by a person; non-null = generated
  // (see ProjectSource). Set on create, never rewritten by meta updates.
  source: ProjectSource | null;
  // The project's type catalogue (docs/specs/026-plan/item-types.md): its own item types, or null
  // (or absent, from an older client or record) for the built-in ones. Written only by
  // PUT /projects/:id/item-types.
  itemTypes?: ItemTypeCatalogue | null;
  // The catalogue's revision (ItemTypesRequest `expectedRev`): 0 until its first write.
  itemTypesRev?: number;
  savedAt: number;
  createdAt: number;
  // Owner's display name + avatar colour, joined server-side from the
  // participants table so visitors can render "Owner: <name>" without
  // waiting for the owner to come online in the realtime room. Null
  // when the owner has no participant row yet (e.g. signed-in
  // owners who never set a name on a project); the UI falls back to
  // hiding the badge in that case.
  ownerName: string | null;
  ownerColor: string | null;
} & RecordedIntent;

// The creation intent recorded on a project when it was created, written once by the create and
// never re-derived (docs/specs/013-workspace/default-folders.md "Recorded intent"). A null `opensIn`
// is unknown (made before intents were recorded, or by a create without one), and the other two are then unknown
// too; with a known `opensIn`, `tabKind` names the first tab's kind (board, sheet, dashboard, form, or empty) and a
// null `templateFamily` means made from no family.
export type RecordedIntent = {
  opensIn: EditorMode | null;
  tabKind: CreationTabKind | null;
  templateFamily: TemplateFamily | null;
};

// Lightweight list projection — drops `tabs` so listing 100 projects
// doesn't ship 100 tab arrays.
export type ProjectSummary = {
  id: string;
  ownerId: string;
  name: string;
  shareable: boolean;
  shareCode: string | null;
  folderId: string | null;
  // Team library placement (docs/specs/013-workspace/team-shared-projects.md) — see Project.teamId.
  teamId: string | null;
  // Provenance (docs/specs/013-workspace/folders.md) — see Project.source.
  source: ProjectSource | null;
  savedAt: number;
  createdAt: number;
  // Nothing drawn: the first tab has no elements, or there is no tab
  // (docs/specs/006-project/project-snapshots.md). Its row shows the empty sketch and asks for no thumbnail.
  empty: boolean;
  // What the Details view shows (docs/specs/013-workspace/explorer-details-view.md), summed over the
  // project's tabs; null when it has no tab or one of its tabs is not counted yet.
  stats: ProjectStats | null;
} & RecordedIntent;

// A project's tab stats (docs/specs/013-workspace/explorer-details-view.md "Where the numbers come
// from"): the mode of the tab written last, and elements, comments and stored bytes over every tab.
export type ProjectStats = {
  mode: EditorMode;
  elements: number;
  comments: number;
  bytes: number;
};

// A project's shared tabs: how many of its tabs are also linked into another
// project, and how many other projects hold them. What the delete and Take
// Offline confirmations say stays behind
// (docs/specs/006-project/tab-project-many-to-many.md, "Shared-tab notice").
export type SharedTabsSummary = {
  tabs: number;
  projects: number;
};

// One row of the "Shared with you" list (shared_with):
// a project a non-owner has previously opened via a share link. The api
// worker (`listSharedWith` in db/shared.ts) builds this by joining
// shared_with → projects → participants; the live editor's Explorer
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
  // the openable `/project/<id>?s=<code>` URL — without it the link
  // lands on the owner-only path and 404s. The worker filters out rows
  // whose share was revoked (no code left), so this is never null here.
  shareCode: string;
  // The scope the visitor was granted (docs/specs/013-workspace/tab-scoped-share-links.md); null = All tabs.
  // `shareCode` always carries this same scope, never a broader one.
  tabId: string | null;
  // Owner's display name + avatar colour, joined from participants.
  // Nullable: signed-in owners may have no participant row yet, so
  // the UI shows an "Unknown owner" placeholder.
  ownerName: string | null;
  ownerColor: string | null;
  // Nothing drawn on the tab this visitor sees (the scoped tab, else the first); see ProjectSummary.empty.
  empty: boolean;
};

// ---------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------

// One row of `Project.tabs`. Stored in D1 with id + project_id + name
// + order_index as columns and the rest of the payload as a JSON
// `data` column. The summary projection is what list / project
// responses ship; the full payload (below) is fetched per-tab on
// demand so the editor only ever holds the tabs the user opens.
export type TabSummary = {
  id: string;
  projectId: string;
  name: string;
  orderIndex: number;
  updatedAt: number;
  // Per-project folder name (docs/specs/006-project/tab-folders.md), read from the plan_tabs
  // link row. Optional / omitted = the tab is loose (no folder). The
  // TabBar groups contiguous same-folder tabs under one chip.
  folder?: string;
  // Set for a tab outside a tab-scoped visitor's scope (docs/specs/013-workspace/tab-scoped-share-links.md):
  // its name is blanked, its folder dropped, and its content never served.
  outOfScope?: true;
};

// Full tab payload returned by `GET /api/projects/:id/tabs/:tabId`:
// the editor's `Tab` (elements + comments + theme + canvas) plus the
// row's audit metadata. `folder` here is the per-project membership
// from the plan_tabs link (docs/specs/006-project/tab-folders.md), distinct from anything in the
// tab body — it is never stored in the `tabs.data` blob.
//
// `rev` (docs/specs/024-agents/agent-changesets.md "The tab revision") advances with every write
// of the tab: an editor save, a changeset, a revert, a rename. The read also carries it as a weak ETag.
export type TabRecord = Tab & {
  rev: number;
  projectId: string;
  orderIndex: number;
  updatedAt: number;
};

// ---------------------------------------------------------------------
// Teams (docs/specs/013-workspace/teams.md)
// ---------------------------------------------------------------------

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

// What a decline token names (docs/specs/013-workspace/teams.md "Declining from the email"): the invite's team
// name and where the invite stands, read and returned by the open `/api/teams/invite-decline/:token` doors.
export type TeamInviteDecline = {
  teamName: string;
  status: TeamMemberStatus;
};

// ---------------------------------------------------------------------
// Share links (docs/specs/014-identity/auth-and-guest-access.md, docs/specs/015-api/api.md)
// ---------------------------------------------------------------------

export type ShareLink = {
  code: string;
  projectId: string;
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
};

// ---------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------

// Canonical SHA-256 hex digest and PKCE challenge, shared by the workers and the CLI (see ./sha256.ts).
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

// Shared display-casing for preset values (template ids, theme names,
// telemetry action / type enums). One definition so the live editor and
// the telemetry dashboard can't drift (see @liveworkspace/api-schema/title-case).
export { headlineCase, titleCase } from '@liveworkspace/api-schema/title-case';
export { objectOrEmpty } from '@liveworkspace/api-kit/request-body';
// The project format number an editor compares (docs/specs/016-platform/new-version-prompt.md).
export { PROJECT_FORMAT, PROJECT_FORMAT_HEADER, parseProjectFormat } from './project-format';
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
  // For the CLI (docs/specs/015-api/blueprints/cli.md "Capabilities"), each optional so an older worker parses:
  // where the api answers, whether sign-in exists, the OAuth server, the stored project format, and the
  // oldest CLI accepted for writes.
  apiBase?: string;
  authEnabled?: boolean;
  oauthIssuer?: string;
  projectFormat?: number;
  cli?: { minVersion: string };
  // True only when the deployment has the EMAIL binding (docs/specs/014-identity/transactional-email.md). The
  // editor app hides the email-notification toggles (docs/specs/014-identity/profile-and-email-notifications.md) when false,
  // since they'd be inert without an email backend. Optional so an older
  // client / a fail-closed default still parses.
  emailEnabled?: boolean;
};

export * from '@liveworkspace/api-schema/access-levels';
export * from './cta-sources';
export * from './page-views';
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
// A project's own dates on create (docs/specs/015-api/api.md "Project dates"): the worker's
// check, and the editor's before it sends an imported board's dates.
export * from './project-dates';
// A tab's size cap, D1's row cap less headroom (docs/specs/015-api/api.md "Tab size"): the worker
// enforces it, the editor checks it before sending.
export * from '@liveworkspace/api-schema/tab-size';

// Placement on create: the shape and its named refusals (docs/specs/013-workspace/folders.md).
export {
  PLACEMENT_REJECTIONS,
  isPlacementRejection,
  type ProjectPlacement,
  type PlacementRejection,
} from './placement';

// Default folders: the keys in force and the creation intent a create carries
// (docs/specs/013-workspace/default-folders.md).
export * from './placement-defaults';
// Explorer Home: opens, Jump back in and What happened (docs/specs/013-workspace/explorer-home.md).
export * from './home';
export * from './drag-preview';
// Within reach: N most used plus N recent (docs/specs/004-interface-design/within-reach.md).
export * from '@liveworkspace/api-schema/within-reach';
// Making a project is a use, a bulk import is not (docs/specs/013-workspace/explorer-home.md).
export * from '@liveworkspace/api-schema/creation-use';
// Project views and ref refusals (docs/specs/024-agents/project-views.md).
export * from './project-views';
export * from '@liveworkspace/api-schema/ref-errors';
// Returning visitor (docs/specs/019-marketing/returning-visitor.md).
export * from './recent-diagrams';

export * from '@liveworkspace/api-kit/api-token';
export * from './project-source';
export * from '@liveworkspace/api-schema/catalogues';
export * from './comment-threads';
export * from '@liveworkspace/api-schema/agent-presence';
export * from '@liveworkspace/api-schema/http-errors';
export * from './oauth-clients';
// Workbench embeds (docs/specs/013-workspace/workbench-embeds.md).
export * from './workbench';
export * from './workbench-messages';
export * from './mcp-origin';
// Forms (docs/specs/030-forms/forms.md).
export * from './forms';

// The readable signed-in hint cookie the api sets and the apps read (see ./signed-in-hint.ts).
export { SIGNED_IN_HINT_COOKIE, signedInHintOf } from './signed-in-hint';

// The wire shapes every product shares, liveworkspace's (@liveworkspace/api-schema): folders, API tokens, teams,
// share-link levels and lifetimes and participants. A project's invite carries less (TeamInvite, above).
export * from '@liveworkspace/api-schema/folders';
export * from '@liveworkspace/api-schema/api-tokens';
export {
  isOpenTeamMember,
  type Team,
  type TeamListItem,
  type TeamMember,
  type TeamMemberStatus,
  type TeamRole,
} from '@liveworkspace/api-schema/teams';
export * from '@liveworkspace/api-schema/share-links';
export * from '@liveworkspace/api-schema/participants';
