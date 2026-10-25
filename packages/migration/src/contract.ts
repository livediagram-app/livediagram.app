// The one contract between the parts of the migration from the historical livediagram.app (docs/migration.md,
// "Tooling"): the migrate tool (liveworkspace/apps/migrate) builds these, the apps' migration doors take them, and
// the splitter (./split) makes them from an old document's rows. Plain data, no product imports, so a Worker, the
// Node tool and a browser can all use it.

/** The four apps a part of an old document can go to. */
export type MigrationApp = 'livediagram' | 'liveplanner' | 'livedocuments' | 'livedesign';

export const MIGRATION_APPS: readonly MigrationApp[] = [
  'livediagram',
  'liveplanner',
  'livedocuments',
  'livedesign',
];

/** The schema level of the old database the tool was built for: the last row of its `d1_migrations`. A snapshot at
 *  any other level is refused, so the readers never run against a schema they weren't written for. */
export const OLD_SCHEMA_LEVEL = '0099_workbench_workspace.sql';

/** A guest of the old site, as an owner on the new one: the old bare UUID behind the new guest prefix. Old ids are
 *  `crypto.randomUUID()` (lowercase v4), so this is a valid new guest id that no new guest is ever handed. */
export function legacyGuestOwner(oldGuestId: string): string {
  return `guest_${oldGuestId}`;
}

/** Whether an old owner id is an account's (a Clerk id) rather than a guest's. */
export function isOldAccountId(ownerId: string): boolean {
  return ownerId.startsWith('user_');
}

// ---- The apps' migration door --------------------------------------------------------------------------------------
//
// `PUT /api/internal/items/:id/migration` on each app's api, with `Authorization: Bearer <MIGRATION_KEY>` (the bulk
// run) or `Bearer <INDEX_KEY>` (the index's handoff of a browser's Local only parts). A plain 404 when neither key is
// set. It writes the item's room with the times given, never deletes, and on a re-run replaces a tab only while the
// room still holds the revision the door last wrote (nobody has edited it on the new side since).

/** One tab, as the door writes it. `data` is the stored body JSON (the tab without `id` and `name`), already through
 *  livediagram's stored-tab upgrades and the split, so the target app reads it as one of its own. */
export type MigrationTab = {
  id: string;
  name: string;
  orderIndex: number;
  folder: string | null;
  addedAt: number;
  updatedAt: number;
  data: string;
  elementCount: number;
};

/** One agent changeset with its parts, as the old `agent_changesets` and `agent_changeset_parts` rows held it. */
export type MigrationChangeset = {
  id: string;
  tabId: string;
  rev: number;
  baseRev: number;
  authorId: string | null;
  authorName: string | null;
  authorColor: string | null;
  tokenId: string | null;
  summary: string | null;
  fingerprints: string | null;
  added: number;
  changed: number;
  removed: number;
  createdTab: number;
  revertOf: string | null;
  createdAt: number;
  parts: { part: 'ops' | 'inverse' | 'results'; data: string }[];
};

/** Plan's data, for a liveplanner part: the old D1 rows of the document, keyed as liveplanner's room keys them. */
export type MigrationPlanData = {
  itemTypes: string | null;
  itemTypesRev: number;
  itemsRev: number;
  itemsNextKey: number;
  items: {
    id: string;
    type: string;
    itemKey: number;
    rank: string;
    fields: string;
    rev: number;
    createdAt: number;
    updatedAt: number;
    createdBy: string | null;
    updatedBy: string | null;
  }[];
  sheets: {
    id: string;
    tabId: string;
    title: string;
    layout: string;
    rev: number;
    createdAt: number;
    updatedAt: number;
    updatedBy: string | null;
  }[];
  cells: {
    sheetId: string;
    rowId: string;
    colId: string;
    input: string | null;
    format: string | null;
  }[];
  formLinks: {
    code: string;
    tabId: string;
    open: number;
    createdAt: number;
    responses: number;
    lastResponseAt: number | null;
    deletedAt: number | null;
  }[];
};

/** What the door takes for one item. */
export type MigrationRoomPayload = {
  v: 1;
  app: MigrationApp;
  id: string;
  name: string;
  /** The owner on the new side, through the owner map: an account id, or a `legacyGuestOwner`. */
  ownerId: string;
  teamId: string | null;
  createdAt: number;
  savedAt: number;
  /** null for a person's document, else how it was made (`mcp`, `ai`, `import`). */
  source: string | null;
  /** livediagram and livedesign: the slide deck JSON, or null. */
  presentation: string | null;
  /** livedesign and liveplanner: the creation intent the old row recorded. */
  opensIn: string | null;
  tabKind: string | null;
  tabs: MigrationTab[];
  changesets: MigrationChangeset[];
  /** Images the item may serve beyond its owner's own (`image_grants`), and each placed image's media owner. */
  imageGrants: { imageId: string; createdAt: number }[];
  imageOwners: { imageId: string; owner: string }[];
  /** liveplanner only. */
  plan: MigrationPlanData | null;
};

/** The door's answer. */
export type MigrationDoorAnswer = {
  /** Tabs written (new, or replaced because they were still as last imported). */
  written: string[];
  /** Tabs left alone because someone edited them on the new side after the last import. */
  edited: string[];
  /** Whether the item's own row (name, times, deck) was written. */
  meta: boolean;
};

// ---- The split ------------------------------------------------------------------------------------------------------

/** Where the parts of one old document went: the moved_parts mapping (docs/migration.md, step 3). */
export type MovedParts = {
  oldId: string;
  /** The app that kept the old id. */
  keptBy: MigrationApp;
  parts: { app: MigrationApp; id: string; tabIds: string[] }[];
};

/** A reference from one part to content that went to another app, frozen at the split (docs/migration.md, step 3:
 *  a picture plus a link). */
export type CrossReference = {
  from: { app: MigrationApp; id: string; tabId: string; elementId: string };
  to: { app: MigrationApp; id: string; tabId: string | null };
  kind: 'tab-window' | 'chart-source' | 'link';
};

// ---- The browser's Local only parts ----------------------------------------------------------------------------------
//
// `POST /api/migration/local-parts` on livediagram's api, as the browser's guest or account: the editor's one-time
// pass over its Local only store (docs/migration.md, step 6) sends a document's raw tabs; the api splits them
// (./split splitLocalDocument), keeps nothing, and hands each other app's part to the index
// (`POST /api/index/app/migration/handoff`), which makes the item for the caller and calls that app's migration door.

export type LocalPartsRequest = {
  /** The local document's name, for the parts' titles. */
  name: string;
  /** Its tabs as stored in IndexedDB, untouched by any read migration. */
  tabs: unknown[];
};

export type LocalPartsAnswer = {
  parts: { app: MigrationApp; id: string; url: string; tabIds: string[] }[];
  /** The tabs (and their remaining content) the local document keeps: what is livediagram's. */
  keep: unknown[];
};

// Sent with livediagram's app key and the caller as the delegated person (`X-Index-Person`), who owns the new item.
export type HandoffRequest = {
  app: Exclude<MigrationApp, 'livediagram'>;
  title: string;
  payload: MigrationRoomPayload;
};

// ---- Returning legacy guests -----------------------------------------------------------------------------------------
//
// `POST /api/legacy-guest/claim` on livediagram's api, as the browser's guest or account, forwarded with the api's
// client credentials to the accounts Worker's `POST /api/account/internal/legacy-guests/claim`, which checks the old
// signature (HMAC-SHA-256 of the bare id under LEGACY_GUEST_ID_HMAC_SECRET, base64url, no padding) or, for an
// unsigned id, that the old `participants.created_at` predates LEGACY_GUEST_SIGNING_LIVE_AT (1790337600000), then
// merges `legacyGuestOwner(id)` into the caller through the index's `POST /internal/merge` with `legacy: true`.

export type LegacyGuestClaim = {
  /** The old bare UUID from `localStorage['livediagram:v2:self-id']`. */
  legacyId: string;
  /** `localStorage['livediagram:v2:self-sig']`, or null for an id from before signing. */
  signature: string | null;
};

export type LegacyGuestClaimAnswer =
  | { merged: true }
  /** Nothing of this id was migrated, or it was already claimed: the browser can forget the old keys. */
  | { merged: false; reason: 'unknown' | 'claimed' };

/** The signing rule's cut-over on the old site (its GUEST_SIGNING_LIVE_AT): 2026-09-25 12:00 UTC. */
export const LEGACY_GUEST_SIGNING_LIVE_AT = 1790337600000;

// ---- The splitter's input and hooks (./split) ------------------------------------------------------------------------

/** One old document as the migrate tool reads it from the snapshot: its `documents` row, its tabs through
 *  `document_tabs` (in order), its Plan rows, changesets and image grants. Times are epoch ms, as stored. */
export type OldDocumentInput = {
  document: {
    id: string;
    /** The old owner id (a Clerk id, or a guest's bare UUID). */
    ownerId: string;
    name: string;
    teamId: string | null;
    source: string | null;
    presentation: string | null;
    savedAt: number;
    createdAt: number;
    trashedAt: number | null;
    opensIn: string | null;
    tabKind: string | null;
    templateFamily: string | null;
  };
  tabs: {
    id: string;
    name: string;
    /** The stored body JSON (`tabs.data`: the tab without `id`, `name` and `folder`), raw. */
    data: string;
    updatedAt: number;
    orderIndex: number;
    addedAt: number;
    folder: string | null;
    elementCount: number | null;
  }[];
  /** The document's Plan rows (items are the document's, sheets and form links name their tab), or null. */
  plan: MigrationPlanData | null;
  changesets: MigrationChangeset[];
  imageGrants: { imageId: string; createdAt: number }[];
};

/** What the splitter needs of the products, handed in so it imports none of them. */
export type SplitHooks = {
  /** A fresh id for a part made by the split (a UUID). Deterministic in the tool, so a bundle can be planned twice
   *  with the same answer. */
  newId(seed: string): string;
  /** The owner map: an old owner id to its new one. */
  ownerOf(oldOwnerId: string): string;
  /** livediagram's stored-tab upgrades, without its Pages and Plan drops: an old body in, the same content in
   *  today's shape out. */
  upgradeTab(body: Record<string, unknown>): Record<string, unknown>;
  /** Each page's rectangle on the tab's canvas, in canvas units, for a Pages tab (empty when it has none). */
  pageRects(
    body: Record<string, unknown>,
  ): { pageId: string; x: number; y: number; width: number; height: number }[];
  /** The media owner of an image the document places, for `imageOwners` (null when the image is unknown). */
  imageOwner(imageId: string): string | null;
};

export type SplitResult = {
  /** One payload per app the document had content for. The first keeps the old id. */
  parts: MigrationRoomPayload[];
  /** Where the parts went, or null when the whole document went to one app under its old id. */
  moved: MovedParts | null;
  crossReferences: CrossReference[];
  /** Anything the report should show: content that had nowhere to go, a page kind that was guessed. */
  notes: string[];
};

/** A browser's Local only document, as the old editor kept it in IndexedDB (`livediagram-offline`, store
 *  `documents`): tabs inline, each with its `id` and `name`. */
export type LocalDocumentInput = { id: string; name: string; tabs: unknown[] };

export type LocalSplitResult = {
  /** The tabs the local document keeps (livediagram's), raw. */
  keep: unknown[];
  /** One payload per other app; their ids are fresh, their owner is set by the api to the caller. */
  parts: MigrationRoomPayload[];
  crossReferences: CrossReference[];
  notes: string[];
};
