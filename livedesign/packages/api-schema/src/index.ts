// Wire-format type definitions for the livedesign API — the single
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
// The api worker re-exports some under its own aliases (`DesignDTO` etc.);
// new code should prefer the canonical names here.

import type { ShareLinkExpiry, ShareRole } from '@liveworkspace/api-schema/share-links';
import type { DesignSource } from './design-source';
import type { EditorMode, Tab } from '@livedesign/design';
import type { CreationTabKind } from './placement-defaults';

// ---------------------------------------------------------------------
// Designs
// ---------------------------------------------------------------------

// Full design payload returned by `GET /api/designs/:id`. After
// per-tab storage (docs/specs/006-design/per-tab-storage.md), `tabs` is a list of `TabSummary`
// (metadata only) — element content is fetched separately via
// `GET /api/designs/:id/tabs/:tabId`.
export type LiveDoc = {
  id: string;
  ownerId: string;
  name: string;
  tabs: TabSummary[];
  // Sharing state. `shareable` is the on/off switch the owner toggles
  // via POST/DELETE /api/designs/:id/share. `shareCode` is the short
  // code that goes into the share URL; null when never shared,
  // rotated when re-shared after a revoke.
  shareable: boolean;
  shareCode: string | null;
  // Folder placement. null means the design sits at the root of its
  // space. See docs/specs/013-workspace/folders.md.
  folderId: string | null;
  // Team library placement (docs/specs/013-workspace/team-shared-designs.md). null = the owner's personal
  // tree; non-null = this team's shared library (where folderId then
  // refers to one of THAT team's folders, or null for the team's
  // root). Joined members of the team get edit access.
  teamId: string | null;
  // Provenance (docs/specs/013-workspace/folders.md). null = made by a person; non-null = generated
  // (see DesignSource). Set on create, never rewritten by meta updates.
  source: DesignSource | null;
  // Slide deck (docs/specs/012-collaboration/presentation-mode.md), serialised `StoredPresentation` JSON, or null when
  // the design has no deck (every design until somebody builds one).
  // Deliberately absent from DesignSummary: the Explorer lists designs and
  // has no use for their decks, and a deck is the one metadata field that can
  // grow with the design.
  presentation: string | null;
  savedAt: number;
  createdAt: number;
  // Owner's display name + avatar colour, joined server-side from the
  // participants table so visitors can render "Owner: <name>" without
  // waiting for the owner to come online in the realtime room. Null
  // when the owner has no participant row yet (e.g. signed-in
  // owners who never set a name on a design); the UI falls back to
  // hiding the badge in that case.
  ownerName: string | null;
  ownerColor: string | null;
} & RecordedIntent;

// The creation intent recorded on a design when it was created, written once by the create and
// never re-derived (docs/specs/013-workspace/default-folders.md "Recorded intent"). A null `opensIn`
// is unknown (made before intents were recorded, or by a create without one), and `tabKind` is
// then unknown too.
export type RecordedIntent = {
  opensIn: EditorMode | null;
  tabKind: CreationTabKind | null;
};

// Lightweight list projection — drops `tabs` so listing 100 designs
// doesn't ship 100 tab arrays.
export type DesignSummary = {
  id: string;
  ownerId: string;
  name: string;
  shareable: boolean;
  shareCode: string | null;
  folderId: string | null;
  // Team library placement (docs/specs/013-workspace/team-shared-designs.md) — see LiveDoc.teamId.
  teamId: string | null;
  // Provenance (docs/specs/013-workspace/folders.md) — see LiveDoc.source.
  source: DesignSource | null;
  savedAt: number;
  createdAt: number;
  // Nothing drawn: the first tab has no elements, or there is no tab
  // (docs/specs/006-design/design-snapshots.md). Its row shows the empty sketch and asks for no thumbnail.
  empty: boolean;
  // What the Details view shows (docs/specs/013-workspace/explorer-details-view.md), summed over the
  // design's tabs; null when it has no tab or one of its tabs is not counted yet.
  stats: DesignStats | null;
} & RecordedIntent;

// A design's tab stats (docs/specs/013-workspace/explorer-details-view.md "Where the numbers come
// from"): the mode of the tab written last, and elements, comments and stored bytes over every tab.
export type DesignStats = {
  mode: EditorMode;
  elements: number;
  comments: number;
  bytes: number;
};

// A design's shared tabs: how many of its tabs are also linked into another
// design, and how many other designs hold them. What the delete and Take
// Offline confirmations say stays behind
// (docs/specs/006-design/tab-design-many-to-many.md, "Shared-tab notice").
export type SharedTabsSummary = {
  tabs: number;
  designs: number;
};

// ---------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------

// One row of `LiveDoc.tabs`. Stored in D1 with id + design_id + name
// + order_index as columns and the rest of the payload as a JSON
// `data` column. The summary projection is what list / design
// responses ship; the full payload (below) is fetched per-tab on
// demand so the editor only ever holds the tabs the user opens.
export type TabSummary = {
  id: string;
  designId: string;
  name: string;
  orderIndex: number;
  updatedAt: number;
  // Per-design folder name (docs/specs/006-design/tab-folders.md), read from the design_tabs
  // link row. Optional / omitted = the tab is loose (no folder). The
  // TabBar groups contiguous same-folder tabs under one chip.
  folder?: string;
  // Set for a tab outside a tab-scoped visitor's scope (docs/specs/013-workspace/tab-scoped-share-links.md):
  // its name is blanked, its folder dropped, and its content never served.
  outOfScope?: true;
};

// Full tab payload returned by `GET /api/designs/:id/tabs/:tabId`:
// the editor's `Tab` (elements + comments + theme + canvas) plus the
// row's audit metadata. `folder` here is the per-design membership
// from the design_tabs link (docs/specs/006-design/tab-folders.md), distinct from anything in the
// tab body — it is never stored in the `tabs.data` blob.
//
// `rev` (docs/specs/024-agents/agent-changesets.md "The tab revision") advances with every write
// of the tab: an editor save, a changeset, a revert, a rename. The read also carries it as a weak ETag.
export type TabRecord = Tab & {
  rev: number;
  designId: string;
  orderIndex: number;
  updatedAt: number;
};

// ---------------------------------------------------------------------
// Share links (docs/specs/014-identity/auth-and-guest-access.md, docs/specs/015-api/api.md)
// ---------------------------------------------------------------------

export type ShareLink = {
  code: string;
  designId: string;
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
// Images (docs/specs/009-elements/images.md)
// ---------------------------------------------------------------------

// Canonical hash function for the X-Image-Sha256 wire-format header.
// Lives here so the client and server can't drift on the dedup key
// (see @liveworkspace/api-schema/sha256 for the rationale).
export { sha256Hex } from '@liveworkspace/api-schema/sha256';
export { pkceChallenge } from '@liveworkspace/api-kit/oauth';
// The digest itself, for a hash that is not hex (docs/specs/016-platform/secure-context.md).
export { sha256 } from './sha256-digest';

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
// The design format number an editor compares (docs/specs/016-platform/new-version-prompt.md).
export { DESIGN_FORMAT, DESIGN_FORMAT_HEADER, parseDesignFormat } from './design-format';
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
  // where the api answers, whether sign-in exists, the OAuth server, the stored design format, and the
  // oldest CLI accepted for writes.
  apiBase?: string;
  authEnabled?: boolean;
  oauthIssuer?: string;
  designFormat?: number;
  cli?: { minVersion: string };
  // True only when the deployment has the `EMAIL` binding (docs/specs/014-identity/transactional-email.md). The
  // live app hides the email-notification toggles (docs/specs/014-identity/profile-and-email-notifications.md) when false,
  // since they'd be inert without an email backend. Optional so an older
  // client / a fail-closed default still parses.
  emailEnabled?: boolean;
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
export * from '@liveworkspace/api-schema/image-limits';
export * from './cta-sources';
export * from './page-views';
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
// A design's own dates on create (docs/specs/015-api/api.md "Design dates"): the worker's
// check, and the editor's before it sends an imported design's dates.
export * from './design-dates';
// A tab's size cap, D1's row cap less headroom (docs/specs/015-api/api.md "Tab size"): the worker
// enforces it, the editor checks it before sending.
export * from '@liveworkspace/api-schema/tab-size';

// Placement on create: the shape and its named refusals (docs/specs/013-workspace/folders.md).
export {
  PLACEMENT_REJECTIONS,
  isPlacementRejection,
  type DesignPlacement,
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
// Making a design is a use, a bulk import is not (docs/specs/013-workspace/explorer-home.md).
export * from '@liveworkspace/api-schema/creation-use';
// Design views and ref refusals (docs/specs/024-agents/design-views.md).
export * from './design-views';
// The page lint's report (docs/specs/024-agents/page-lint.md).
export * from './lint';
export * from '@liveworkspace/api-schema/ref-errors';
// Returning visitor (docs/specs/019-marketing/returning-visitor.md).
export * from './recent-designs';
export * from '@liveworkspace/api-schema/snapshot-svg';

export * from '@liveworkspace/api-kit/api-token';
export * from './design-source';
export * from '@liveworkspace/api-schema/catalogues';
export * from './comment-threads';
export * from '@liveworkspace/api-schema/agent-presence';
export * from './design-paths';
export * from '@liveworkspace/api-schema/http-errors';
export * from './oauth-clients';
// Workbench embeds (docs/specs/013-workspace/workbench-embeds.md).
export * from './workbench';
export * from './workbench-messages';
export * from './pages';
export * from './photo-frames';
export * from './photo-blob-batch';
export * from './pages-summary';
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
