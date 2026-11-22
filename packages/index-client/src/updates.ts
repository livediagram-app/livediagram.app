// Updates (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "What an item pushes" and "Inbox"): what changed
// on a page someone watches, within its hour (liveknowledge's Watching). The item pushes its whole set
// (`PUT /app/items/:id/updates`); the Inbox read answers the rows pushed for the reader.

import type { App } from './constants';

/** What an update can say happened, in the order a row names them. */
export const UPDATE_KINDS = [
  'saved',
  'review_due',
  'approved',
  'rejected',
  'moved',
  'deleted',
] as const;
export type UpdateKind = (typeof UPDATE_KINDS)[number];

export const isUpdateKind = (value: unknown): value is UpdateKind =>
  typeof value === 'string' && (UPDATE_KINDS as readonly string[]).includes(value);

/** The most updates one push carries (the item's newest). */
export const UPDATES_PUSH_MAX = 50;
/** The most actors one update names (newest first); `actorCount` counts them all. */
export const UPDATE_ACTORS_MAX = 5;
/** The most people one update is for. */
export const UPDATE_PEOPLE_MAX = 200;
/** How far back the Inbox read lists updates. */
export const INBOX_UPDATES_MS = 14 * 24 * 60 * 60 * 1000;
/** A page's name as the index keeps it, at most. */
export const UPDATE_TAB_NAME_MAX = 200;
/** An actor's name as the index keeps it, at most. */
export const UPDATE_ACTOR_NAME_MAX = 80;

export type UpdateActor = { id: string; name: string };

/** One update as an item pushes it. */
export type UpdatePush = {
  id: string;
  tabId: string;
  tabName: string;
  kinds: UpdateKind[];
  actors: UpdateActor[];
  actorCount: number;
  count: number;
  firstAt: number;
  latestAt: number;
  people: string[];
};

/** One update as the Inbox read answers it to one of its people. */
export type InboxUpdate = Omit<UpdatePush, 'people'> & {
  app: App;
  itemId: string;
  itemTitle: string;
  itemTeamId: string | null;
};
