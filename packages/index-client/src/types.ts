// The index's wire shapes (liveworkspace/docs/one-explorer-contracts.md). Times are epoch milliseconds,
// except in tokens, which keep JWT seconds.

import type {
  AccountTimelineEventType,
  App,
  AppPersonEventType,
  AppTimelineEventType,
  ItemOwner,
  ItemSource,
  ItemView,
  Kind,
  Level,
  ShareLinkExpiry,
  TimelineApp,
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
  // For an item the person manages (owner or team): it has a live share link. Always sent by the index.
  hasLinks?: boolean;
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
  // The latest author's colour (a CSS colour), for their avatar; '' for none.
  latestAuthorColor?: string;
  // Who wrote the latest comment, and who resolved the thread, when the app knows: the Timeline's
  // `commented` and `comment_resolved` say who. Unknown, the card names `latestAuthorName` or no one.
  latestAuthorId?: string | null;
  resolvedById?: string | null;
  firstAt: number;
  latestAt: number;
  // A card's thread rather than an element's (pushed under COLLAB_CARDS_TAB, `elementId` the card's id).
  card?: CollabCard | null;
};

/** A card in an item (a Plan card), as the Inbox lists it: its number, type and title, and the board that shows
 *  it, where its row opens it (null: no board shows it, and the row opens the item at the card). */
export type CollabCard = {
  key: number | null;
  // The card type's id, and its name as the app shows it ("Task").
  type: string;
  typeLabel: string;
  title: string;
  board: { tabId: string; elementId: string; title: string; tabName: string } | null;
};

export type ActionStatus = 'open' | 'done' | 'wont-do';

export type CollabActionInput = {
  elementId: string;
  actionId: string;
  elementLabel: string;
  name: string;
  // The action's notes, one line of which the Inbox shows; '' for none.
  description?: string;
  status: ActionStatus;
  assigneeId: string | null;
  // The names shown on the row ("Assigned by Ada"); null when unknown.
  assigneeName?: string | null;
  assignerId: string;
  assignerName?: string | null;
  teamId: string | null;
  // Who closed it, when the app knows (the Timeline's `action_done`); unknown, its assignee.
  doneById?: string | null;
  createdAt: number;
  updatedAt: number;
  // An open card assigned to someone rather than an element's action (pushed under COLLAB_CARDS_TAB, `elementId`
  // and `actionId` the card's id).
  card?: CollabCard | null;
};

// `tabName`: the tab's name, shown on its rows ("Board · Sprint 4"); omitted under COLLAB_CARDS_TAB.
export type CollabPush = {
  tabName?: string;
  threads: CollabThreadInput[];
  actions: CollabActionInput[];
};

/** A form on one tab of an item and how many responses it has taken (`PUT /app/items/:id/forms/:tabId`); `form:
 *  null` takes it off the Inbox (unpublished, or the tab gone). */
export type CollabFormInput = {
  heading: string;
  // The tab of the board its responses land on, where its row opens; null opens the form's own tab.
  boardTabId: string | null;
  responses: number;
  latestAt: number;
  // The live link's public code, so `formByCode` finds this form. Left out, the form keeps the code it has.
  code?: string;
};

/** Where a live form's public code points (`GET /app/forms/:code`). */
export type CollabFormPlace = { itemId: string; tabId: string };

/** A person has seen a form's first `seen` responses (`PUT /app/items/:id/forms/:tabId/seen`). */
export type CollabFormSeen = { personId: string; seen: number };

// An Inbox row: where it is, so opening it goes to that app; `itemTeamId` is the team whose library holds the item.
type InboxPlace = {
  app: App;
  itemId: string;
  itemTitle: string;
  itemTeamId: string | null;
  tabId: string;
  tabName: string;
};

export type InboxThread = InboxPlace &
  Omit<CollabThreadInput, 'participantIds' | 'mentionedIds' | 'latestAuthorColor' | 'card'> & {
    latestAuthorColor: string;
    card: CollabCard | null;
    // Why the person sees it: they are @-mentioned in it, they commented in it, the item is theirs.
    mentionsYou: boolean;
    youCommented: boolean;
    onYourItem: boolean;
  };
export type InboxAction = InboxPlace &
  Omit<CollabActionInput, 'description' | 'assigneeName' | 'assignerName' | 'card'> & {
    description: string;
    assigneeName: string | null;
    assignerName: string | null;
    card: CollabCard | null;
  };

/** A form with responses the person hasn't seen, on an item they own or reach through a team. */
export type InboxForm = {
  app: App;
  itemId: string;
  itemTitle: string;
  itemTeamId: string | null;
  tabId: string;
  heading: string;
  boardTabId: string | null;
  unseen: number;
  latestAt: number;
};

// A folder's newest items (at most FOLDER_PREVIEW_ITEMS) and how many live items it holds directly, counted up to
// FOLDER_PREVIEW_COUNT_CAP.
export type FolderPreview = { folderId: string; itemCount: number; items: Item[] };

export type InboxResponse = {
  threads: InboxThread[];
  actions: InboxAction[];
  forms: InboxForm[];
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
  // The item's owner as the index has it now. Absent from a grant signed before the index named it.
  owner?: string;
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
  // Only these apps' items (or-ed); with `app` as well, both must hold.
  apps?: readonly App[];
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
  // A first page only, Home's other reads in the same request: My Work's live items (yours, in `app`) counted up to
  // this many (LIST_LIMIT_MAX), as `mine`; and whether you can open anything at all in `app`, as `any`.
  mine?: number;
  any?: boolean;
};

/** My Work's count beside a first page (`mine`): up to the cap asked, and whether there are more. */
export type MineCount = { count: number; more: boolean };

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
  // An item kept offline in one browser, put back in the cloud under its own id: the Timeline says `synced`
  // rather than `created`.
  synced?: boolean;
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
// when it happened (or the team's, the token's, the gallery's for an event about no item); `item` is the item
// as it is now (its name since, its place, its Trash), drawn by the Explorer's cards, or null for an event
// about no item (a team, an API token, images uploaded, an item taken offline).
export type TimelineEvent = {
  id: string;
  // The item's app; TIMELINE_PLATFORM for an account's teams and tokens, which every app's filter shows.
  app: TimelineApp;
  type: TimelineEventType;
  // Who did it: an account or guest id, or `deleted` once their account is closed. The index holds no
  // names; a report may carry one (`actorName`).
  actorId: string | null;
  actorName: string | null;
  itemId: string | null;
  title: string;
  // renamed: { from }; moved: { folderName, teamId } (null folderName: the top of the space);
  // shared: { level }; created: { source, copiedFrom }; commented: { text, count, reply };
  // comment_resolved: { text }; action_assigned: { action, assigneeId, assigneeName }; action_done: { action };
  // image_uploaded: { count }; team_*: { teamId, memberName, role, from, inviteeId, left };
  // token_*: { tokenId }; token_expiring: { expiresAt }.
  detail: Record<string, string | null> | null;
  occurredAt: number;
  item: Item | null;
};

export type TimelineQuery = {
  // One app's events; unset, every app's.
  app?: App;
  // One item's events only (its History).
  item?: string;
  limit?: number;
  cursor?: string;
};

export type TimelinePage = Page<TimelineEvent, 'events'> & {
  // When the person last marked their Timeline seen (POST /timeline/seen), or null for never.
  seenAt: number | null;
};

// What an app reports about an item: `edited` by `actorId` at `at`, with the name the app knows them by.
export type AppTimelineEvent = {
  type: AppTimelineEventType;
  actorId: string;
  actorName?: string | null;
  at: number;
};

// What an app reports about a person (`PUT /app/people/events`): `count` images uploaded by `actorId` at `at`.
export type AppPersonEvent = {
  type: AppPersonEventType;
  actorId: string;
  at: number;
  count?: number;
};

// What liveworkspace accounts reports (`POST /internal/timeline`, its key): one team or API token event, with
// the scopes that see it (`p:<person>`, `t:<team>`). `id` is stable, so a resend lands on the same event.
export type AccountTimelineEvent = {
  id: string;
  type: AccountTimelineEventType;
  actorId: string | null;
  actorName?: string | null;
  // The team's or the token's name.
  title: string;
  detail?: Record<string, string | null> | null;
  at: number;
  scopes: string[];
};

export type MergeRequest = { guestId: string; userId: string };
