// Request Access (liveworkspace/docs/specs/004-index/request-access.md): a signed-in person asks the people who run an
// item they can't open to share it with them. The limits, the Inbox's row, and the notices the index sends the item's
// app for its emails.

import { isLevel, type App, type Level } from './constants';

// One person's asks in a day, across every id, real or not.
export const ACCESS_REQUESTS_PER_PERSON_DAY = 20;
// How long before one person may ask about one item again.
export const ACCESS_REQUEST_REPEAT_MS = 7 * 24 * 60 * 60 * 1000;
// The request emails one item's managers get in a day, however many people ask.
export const ACCESS_REQUEST_EMAILS_PER_ITEM_DAY = 10;
// The requester's note, at most.
export const ACCESS_REQUEST_NOTE_MAX = 300;
// The people one request email notice may name.
export const ACCESS_REQUEST_RECIPIENTS_MAX = 10;

export type AccessRequestState = 'open' | 'granted' | 'declined';

/** An open request on an item the reader manages, as the Inbox lists it. */
export type InboxAccessRequest = {
  id: string;
  app: App;
  itemId: string;
  itemTitle: string;
  itemTeamId: string | null;
  requesterId: string;
  // As accounts named them when they asked; null when it couldn't say ("Someone").
  requesterName: string | null;
  note: string | null;
  askedAt: number;
};

/** How far back the Inbox read lists the reader's own granted requests (`shares`, inbox-notices.md). */
export const INBOX_SHARES_MS = 7 * 24 * 60 * 60 * 1000;

/** One of the reader's own requests a manager granted lately, as the Inbox read answers it (`shares`): not a row of
 *  the Explorer's list, but what an editor's notice says. Who granted it is the grant's `shared` event's actor, and
 *  their name as accounts gave it then; null when the event kept none ("Someone"). */
export type InboxShare = {
  id: string;
  app: App;
  itemId: string;
  itemTitle: string;
  itemTeamId: string | null;
  sharedById: string | null;
  sharedByName: string | null;
  sharedAt: number;
};

export type AccessRequestInput = { note?: string | null };
export type AccessGrantInput = { level?: Level };

// ---------- The notices: what the index tells the item's app, for its emails -------------------------------------

export type AccessRequestedNotice = {
  type: 'access_requested';
  requestId: string;
  requesterId: string;
  requesterName: string | null;
  // Whom to email: the personal item's owner, or a team item's maker while they are in its team.
  recipientIds: string[];
  itemTitle: string;
  note: string | null;
};

export type AccessGrantedNotice = {
  type: 'access_granted';
  requestId: string;
  requesterId: string;
  granterId: string;
  granterName: string | null;
  level: Level;
  itemTitle: string;
};

export type AccessNotice = AccessRequestedNotice | AccessGrantedNotice;

const ID_MAX = 200;
const TITLE_MAX = 500;
const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= ID_MAX;
const textOrNull = (value: unknown, max: number): string | null | undefined =>
  value === null || value === undefined
    ? null
    : typeof value === 'string' && value.length <= max
      ? value
      : undefined;
const isTitle = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= TITLE_MAX;

/** An access notice as the app reads its body, or null for anything else. */
export function parseAccessNotice(value: unknown): AccessNotice | null {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v !== 'object') return null;
  if (!isId(v.requestId) || !isId(v.requesterId) || !isTitle(v.itemTitle)) return null;
  if (v.type === 'access_requested') {
    const ids = v.recipientIds;
    if (
      !Array.isArray(ids) ||
      ids.length < 1 ||
      ids.length > ACCESS_REQUEST_RECIPIENTS_MAX ||
      !ids.every(isId)
    ) {
      return null;
    }
    const requesterName = textOrNull(v.requesterName, ID_MAX);
    const note = textOrNull(v.note, ACCESS_REQUEST_NOTE_MAX);
    if (requesterName === undefined || note === undefined) return null;
    return {
      type: 'access_requested',
      requestId: v.requestId,
      requesterId: v.requesterId,
      requesterName,
      recipientIds: [...(ids as string[])],
      itemTitle: v.itemTitle,
      note,
    };
  }
  if (v.type === 'access_granted') {
    const granterName = textOrNull(v.granterName, ID_MAX);
    if (!isId(v.granterId) || granterName === undefined || !isLevel(v.level)) return null;
    return {
      type: 'access_granted',
      requestId: v.requestId,
      requesterId: v.requesterId,
      granterId: v.granterId,
      granterName,
      level: v.level,
      itemTitle: v.itemTitle,
    };
  }
  return null;
}
