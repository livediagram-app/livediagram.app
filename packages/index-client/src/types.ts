// The index's wire shapes (liveworkspace/docs/specs/004-index/one-explorer-contracts.md). Times are epoch milliseconds,
// except in tokens, which keep JWT seconds.

import type {
  AccountEventType,
  App,
  AppEventType,
  EventApp,
  EventType,
  ItemOwner,
  ItemSource,
  ItemView,
  Kind,
  Level,
  ShareLinkExpiry,
  TeamAuditEventType,
} from './constants';

export type ItemSummary = {
  elements?: number;
  comments?: number;
  bytes?: number;
  mode?: string;
  // Nothing to draw: no tab, or an empty first tab (no preview is asked for, liveworkspace/docs/specs/006-media/previews.md).
  empty?: boolean;
  // Whether any tab holds anything (an element, a page, a form). False, the index's daily clean-up moves the item to
  // the Trash once it has been unchanged for EMPTY_ITEM_STALE_MS.
  hasContent?: boolean;
  // Anyone can find it: listed in a public gallery (livediagram's Community). The Explorer's Public badge.
  public?: boolean;
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
  // In its owner's Archived since (one-explorer-contracts.md "Archived"): it opens nowhere until moved out. Always
  // sent by the index; absent reads as not archived.
  archivedAt?: number | null;
  summary: ItemSummary;
  // For the person asking:
  access: Level;
  favourite: boolean;
  lastOpenedAt: number | null;
  // Hidden from the person's Recent (and Jump Back In) by Hide from Recent. Always sent by the index.
  hiddenFromRecent?: boolean;
  // The share code, when they reach it only through a link.
  sharedVia: string | null;
  // For an item the person manages (owner or team): it has a live share link. Always sent by the index.
  hasLinks?: boolean;
  // Most Used only: the distinct days in the window the person opened it.
  useDays?: number;
  // Most Used only: how many times the person opened it in the window (what Most Used ranks by).
  useOpens?: number;
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
  // A public link (a Community post's): it never asks for the item's share password; while one is set it opens
  // nothing (404), as if the post were closed. Absent from an older index: false.
  public?: boolean;
  // A connected tab's pass (connected-tabs.md): the item whose tab it was made for, for the Share dialog's
  // "Connected from <host>". Only on the item's own share list; absent for any other link.
  connection?: ShareLinkConnection;
};

export type ShareLinkConnection = { hostItemId: string; hostApp: App; hostTitle: string };

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
  // Who wrote in it themselves.
  participantIds: string[];
  mentionedIds: string[];
  // Who wrote in it only through an agent (an API token): they reach the thread as a participant does, but it is
  // not "you commented", so an agent's question waits on them. Absent: none.
  agentIds?: string[];
  latestText: string;
  latestAuthorName: string;
  // The latest author's colour (a CSS colour), for their avatar; '' for none.
  latestAuthorColor?: string;
  // Who wrote the latest comment, and who resolved the thread, when the app knows: the event log's
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
  // The card's id, when the row's `elementId` is not the card's own: one of its comment threads, whose element is the
  // thread (one-explorer-contracts.md "What an item pushes").
  id?: string;
  key: number | null;
  // The card type's id, and its name as the app shows it ("Task").
  type: string;
  typeLabel: string;
  title: string;
  board: { tabId: string; elementId: string; title: string; tabName: string } | null;
  // The column on that board holding the card's status as of the item's latest push (it pushes again when the card
  // moves or the board changes): its name, its colour (#rrggbb) when it has one, whether it is a done column. Null
  // or absent when no column holds it (an All Cards board, a deleted column), or from an older push.
  column?: CardColumn | null;
};

export type CardColumn = { name: string; color?: string; done: boolean };

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
  // Who closed it, when the app knows (the event log's `action_done`); unknown, its assignee.
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
  Omit<
    CollabThreadInput,
    'participantIds' | 'mentionedIds' | 'agentIds' | 'latestAuthorColor' | 'card'
  > & {
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

// A space's newest items (at most FOLDER_PREVIEW_ITEMS) and how many live items it holds in all, counted up to
// FOLDER_PREVIEW_COUNT_CAP: the person's own (`teamId: null`) or a team's.
export type SpacePreview = { teamId: string | null; itemCount: number; items: Item[] };

export type InboxResponse = {
  threads: InboxThread[];
  actions: InboxAction[];
  forms: InboxForm[];
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
  // Set on a grant for an item in the Trash (only its owner and team are granted one): the app answers it as
  // trashed (410 `document_trashed` on livediagram), not as missing.
  trashed?: true;
  // The share code the access came through, whoever holds the grant (a person who opened the link before
  // included), so an app never has to take the caller's word for it. Absent for the owner and the team.
  link?: string;
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
  // The item is in the Trash (as the grant's `trashed` claim says).
  trashed?: true;
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
  // The mode the item's app last reported (`summary.mode`: livediagram's `diagram`, `draw`, `workshop`).
  modes?: readonly string[];
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
  limit?: number;
  cursor?: string;
  // Recent's first page only: also up to this many (MOST_USED_MAX) Most Used items, as `mostUsed`.
  used?: number;
  // A first page only, Home's other reads in the same request: the live items in every space you are in (My Work
  // and each of your teams, in `app`) counted up to this many (LIST_LIMIT_MAX), as `mine`; and whether you can open anything at all in `app`, as `any`.
  mine?: number;
  any?: boolean;
  // A first page only: also up to this many (NEWEST_MAX) live items from your own space and each of your teams', in
  // `app`, the most recently made first, as `newest` (Home's New).
  newest?: number;
};

/** The count of every space's items beside a first page (`mine`): up to the cap asked, and whether there are more. */
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
  // An item kept offline in one browser, put back in the cloud under its own id: its History says `synced`
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

export type CreateShareLinkInput = {
  level?: Level;
  tabId?: string | null;
  expiry?: ShareLinkExpiry;
  // A public link (ShareLink.public): closed, not asking, while the item has a share password.
  public?: boolean;
};
export type UpdateShareLinkInput = { level?: Level; tabId?: string | null };

// A link visitor's credentials, sent as headers.
export type ShareAccess = { code: string; password?: string | null };

// `public`: a Community post's link (liveworkspace/docs/specs/006-media/previews.md). Absent from an index that predates it.
export type ShareResolution = { item: Item; level: Level; tabId: string | null; public?: boolean };

// `GET /items/:id`: the item, and how the caller reaches it: the one tab a link confines them to, and the public
// link's code when that is their only way in (liveworkspace/docs/specs/006-media/previews.md). Absent from an older index.
export type ItemRead = { item: Item; tabId?: string | null; publicCode?: string | null };

// One event in an item's History: what happened, by whom, as it was then. `title` is the item's name when it
// happened; `item` is the item as it is now (its name since, its place, its Trash).
export type ItemEvent = {
  id: string;
  app: EventApp;
  type: EventType;
  // Who did it: an account or guest id, or `deleted` once their account is closed. The index holds no
  // names; a report may carry one (`actorName`).
  actorId: string | null;
  actorName: string | null;
  itemId: string | null;
  title: string;
  // renamed: { from }; moved: { folderName, teamId } (null folderName: the top of the space);
  // shared: { level }; created: { source, copiedFrom }; commented: { text, count, reply };
  // comment_resolved: { text }; action_assigned: { action, assigneeId, assigneeName }; action_done: { action };
  // opened_by_visitor, copied_by_visitor: none (the actor is the visitor, null for one with no identity).
  detail: Record<string, string | null> | null;
  occurredAt: number;
  item: Item | null;
};

// `GET /items/:id/history`: one page of an item's events, newest first, kept EVENT_RETENTION_MS.
export type HistoryQuery = { limit?: number; cursor?: string };
export type HistoryPage = Page<ItemEvent, 'events'>;

// What an app reports about an item: `edited` by `actorId` at `at`, with the name the app knows them by.
export type AppEvent = {
  type: AppEventType;
  actorId: string;
  actorName?: string | null;
  at: number;
};

// What liveworkspace accounts reports (`POST /internal/events`, its key): one team event, for its team's audit log.
// `id` is stable, so a resend lands on the same event.
export type AccountEvent = {
  id: string;
  type: AccountEventType;
  actorId: string | null;
  actorName?: string | null;
  // The team's name.
  title: string;
  detail?: Record<string, string | null> | null;
  at: number;
};

// The team audit log (liveworkspace/docs/specs/004-index/team-audit-log.md "Who reads it"): one row as a team admin
// reads it. A person is named by accounts now (`name` null when nobody is: a closed account's `deleted`).
export type TeamAuditPerson = { id: string; name: string | null };

export type TeamAuditEvent = {
  id: string;
  type: TeamAuditEventType;
  // The document's app; PLATFORM_APP for a team's own event and a webhook's.
  app: EventApp;
  // Who did it.
  actor: TeamAuditPerson | null;
  // Whom a team event is about (an invitee, a member removed or whose role changed).
  subject: TeamAuditPerson | null;
  itemId: string | null;
  // The document's, team's or webhook's name then.
  title: string;
  // As in the event log: shared: { level, public }; moved: { fromTeamId, teamId }; deleted: { reason };
  // webhook_*: { webhookId, kind, host }; team_*: { teamId, memberName, role, from, inviteeId, left }.
  detail: Record<string, string | null> | null;
  occurredAt: number;
};

export type TeamAuditQuery = {
  team: string;
  // Who did it.
  person?: string;
  kind?: TeamAuditEventType;
  // Milliseconds: `from` inclusive, `to` exclusive.
  from?: number;
  to?: number;
  limit?: number;
  cursor?: string;
};

export type TeamAuditPage = Page<TeamAuditEvent, 'events'>;

// A CSV file of the log: its text, and where the next file starts when more rows matched than one holds.
export type TeamAuditCsv = { csv: string; nextCursor: string | null };

export type MergeRequest = { guestId: string; userId: string };
