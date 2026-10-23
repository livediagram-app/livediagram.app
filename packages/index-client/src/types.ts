// The index's wire shapes (liveworkspace/docs/one-explorer-contracts.md). Times are epoch milliseconds,
// except in tokens, which keep JWT seconds.

import type {
  App,
  AppTimelineEventType,
  ItemOwner,
  ItemSource,
  ItemView,
  Kind,
  Level,
  ShareLinkExpiry,
  TimelineEventType,
} from './constants';

export type ItemSummary = {
  elements?: number;
  comments?: number;
  bytes?: number;
  mode?: string;
  empty?: boolean;
  // A media key, or null.
  thumbnail?: string | null;
  [k: string]: unknown;
};

export type TrashReason = 'deleted' | 'empty';

export type Item = {
  id: string;
  app: App;
  kind: Kind;
  title: string;
  // The person who owns it.
  ownerId: string;
  // Owned by a team when set: every joined member edits.
  teamId: string | null;
  folderId: string | null;
  source: ItemSource | null;
  // App-defined creation intent (e.g. "plan:board"), for filters and defaults.
  intent: string | null;
  createdAt: number;
  // Last content or title change.
  updatedAt: number;
  trashedAt: number | null;
  trashReason: TrashReason | null;
  summary: ItemSummary;
  // For the person asking:
  access: Level;
  favourite: boolean;
  tagIds: string[];
  lastOpenedAt: number | null;
  // Hidden from the person's Recent (and Jump Back In) by Hide from Recent. Always sent by the index.
  hiddenFromRecent?: boolean;
  // The share code, when they reach it only through a link.
  sharedVia: string | null;
  // Most Used only: the distinct days in the window the person opened it.
  useDays?: number;
};

export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  teamId: string | null;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
};

export type Tag = {
  id: string;
  name: string;
  // A standard colour's name or `#rrggbb`.
  colour: string;
  createdAt: number;
};

export type ShareLink = {
  code: string;
  itemId: string;
  level: Level;
  // The one tab it opens, or null for every tab.
  tabId: string | null;
  // The lifetime chosen when it was made, kept so Extend re-applies it.
  expiry: ShareLinkExpiry;
  // When it stops working; null for never. A past one is listed but opens nothing.
  expiresAt: number | null;
  createdAt: number;
};

// An item shared with me through a link I opened.
export type SharedWithItem = {
  item: Item;
  code: string;
  level: Level;
  tabId: string | null;
  lastSeenAt: number;
};

export type PlacementDefault = { key: string; folderId: string };

// What an item pushes about one comment thread (`PUT /app/items/:id/collab/:tabId`).
export type CollabThreadInput = {
  elementId: string;
  elementLabel: string;
  resolved: boolean;
  commentCount: number;
  participantIds: string[];
  mentionedIds: string[];
  latestText: string;
  latestAuthorName: string;
  firstAt: number;
  latestAt: number;
};

export type ActionStatus = 'open' | 'done' | 'wont-do';

export type CollabActionInput = {
  elementId: string;
  actionId: string;
  elementLabel: string;
  name: string;
  status: ActionStatus;
  assigneeId: string | null;
  assignerId: string;
  teamId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type CollabPush = { threads: CollabThreadInput[]; actions: CollabActionInput[] };

// An Inbox row: where it is, so opening it goes to that app.
type InboxPlace = { app: App; itemId: string; itemTitle: string; tabId: string };

export type InboxThread = InboxPlace & Omit<CollabThreadInput, 'participantIds' | 'mentionedIds'>;
export type InboxAction = InboxPlace & CollabActionInput;

// A folder's newest items (at most FOLDER_PREVIEW_ITEMS) and how many live items it holds directly, counted up to
// FOLDER_PREVIEW_COUNT_CAP.
export type FolderPreview = { folderId: string; itemCount: number; items: Item[] };

export type InboxResponse = {
  threads: InboxThread[];
  actions: InboxAction[];
  // Timeline events by someone else since the person last looked, at most TIMELINE_NEW_CAP + 1 (read as
  // "99+"); 0 before their first look. In the same filter as the rest.
  timelineNew: number;
};

// The grant: an ES256 JWT signed by the index.
export type GrantClaims = {
  iss: string;
  // The item's app.
  aud: App;
  // `user_…`, `guest_…`, or `link:<code>` for a link visitor with no identity.
  sub: string;
  item: string;
  level: Level;
  tab: string | null;
  team: string | null;
  iat: number;
  exp: number;
  jti: string;
};

// A guest token, minted by liveworkspace accounts.
export type GuestTokenClaims = {
  iss: string;
  // The client's API resource.
  aud: string;
  sub: `guest_${string}`;
  kind: 'guest';
  iat: number;
  exp: number;
};

export type GrantResponse = {
  grant: string;
  level: Level;
  tabId: string | null;
  // Epoch ms.
  expiresAt: number;
};

export type Page<T, K extends string> = { [key in K]: T[] } & { nextCursor: string | null };

// The Explorer's filters (its lens), on GET /items and GET /shared. Values of one filter combine with or;
// filters combine with and.
export type ItemFilters = {
  // Words, each found in the title or the item's folder's name, taken literally.
  q?: string;
  // Only items made this way (`ai`: by an AI tool through MCP).
  source?: readonly ItemSource[];
  // Changed at or after this time (epoch ms).
  since?: number;
  // The asker's own items, or other people's.
  owner?: ItemOwner;
  // The last word of the creation intent (FILTER_VALUES_MAX at most; INTENT_WORD each).
  intent?: readonly string[];
  // Where it lives: `mine`, `shared` (reached through a link) or `team:<id>` of a joined team.
  space?: readonly string[];
};

export type ItemListQuery = ItemFilters & {
  app?: App;
  view?: ItemView;
  folder?: string;
  // With `folder`: its subfolders' items too, at any depth.
  deep?: boolean;
  // A team id, or `personal` for only my own items. Unset: mine and every team I have joined.
  team?: string;
  tag?: string;
  limit?: number;
  cursor?: string;
  // Recent's first page only: also up to this many (MOST_USED_MAX) Most Used items, as `mostUsed`.
  used?: number;
};

export type SharedListQuery = ItemFilters & { app?: App; limit?: number; cursor?: string };

export type CreateItemInput = {
  // The id the client minted (an offline item synced up, an API client's); the index makes one without it.
  id?: string;
  app: App;
  title?: string;
  folderId?: string | null;
  teamId?: string | null;
  intent?: string | null;
  source?: ItemSource | null;
};

export type UpdateItemInput = { title?: string; folderId?: string | null; teamId?: string | null };

export type CreateFolderInput = {
  // Optional: a client-made UUID, so a new folder can show before the answer.
  id?: string;
  name: string;
  parentId?: string | null;
  teamId?: string | null;
};
export type UpdateFolderInput = { name?: string; parentId?: string | null };

export type CreateTagInput = { id?: string; name: string; colour: string };
export type UpdateTagInput = { name?: string; colour?: string };

export type CreateShareLinkInput = {
  level?: Level;
  tabId?: string | null;
  expiry?: ShareLinkExpiry;
};
export type UpdateShareLinkInput = { level?: Level; tabId?: string | null };

// A link visitor's credentials, sent as headers.
export type ShareAccess = { code: string; password?: string | null };

export type ShareResolution = { item: Item; level: Level; tabId: string | null };

// One Timeline entry: what happened, to which item, by whom, as it was then. `title` is the item's name
// when it happened; `item` is the item as it is now (its name since, its place, its Trash), drawn by the
// Explorer's cards.
export type TimelineEvent = {
  id: string;
  app: App;
  type: TimelineEventType;
  // Who did it: an account or guest id, or `deleted` once their account is closed. The index holds no
  // names; an app's report may carry one (`actorName`).
  actorId: string | null;
  actorName: string | null;
  itemId: string;
  title: string;
  // renamed: { from }; moved: { folderName, teamId } (null folderName: the top of the space);
  // shared: { level }; created: { source, copiedFrom }.
  detail: Record<string, string | null> | null;
  occurredAt: number;
  item: Item;
};

export type TimelineQuery = {
  // One app's events; unset, every app's.
  app?: App;
  limit?: number;
  cursor?: string;
};

export type TimelinePage = Page<TimelineEvent, 'events'> & {
  // When the person last marked their Timeline seen (POST /timeline/seen), or null for never.
  seenAt: number | null;
};

// What an app reports: `edited` by `actorId` at `at`, with the name the app knows them by.
export type AppTimelineEvent = {
  type: AppTimelineEventType;
  actorId: string;
  actorName?: string | null;
  at: number;
};

export type MergeRequest = { guestId: string; userId: string };
