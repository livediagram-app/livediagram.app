// The index's wire shapes (liveworkspace/docs/one-explorer-contracts.md). Times are epoch milliseconds,
// except in tokens, which keep JWT seconds.

import type { App, ItemSource, ItemView, Kind, Level, ShareLinkExpiry } from './constants';

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
  // The share code, when they reach it only through a link.
  sharedVia: string | null;
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

export type InboxResponse = { threads: InboxThread[]; actions: InboxAction[] };

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

export type ItemListQuery = {
  app?: App;
  view?: ItemView;
  folder?: string;
  // A team id, or `personal` for only my own items. Unset: mine and every team I have joined.
  team?: string;
  tag?: string;
  q?: string;
  limit?: number;
  cursor?: string;
};

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

export type MergeRequest = { guestId: string; userId: string };
