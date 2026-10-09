// Explorer Home's data (docs/specs/013-workspace/explorer-home.md; blueprint
// docs/specs/013-workspace/blueprints/explorer-home.md): Jump back in and What happened. The api
// builds these from D1 and the editor renders them, so the shapes, the verbs, the limits and the
// refusals live here once.

import { utcDay } from './within-reach';
import { DAY_MS } from '@livediagram/items';

/** N of Jump back in's Within reach set: 4 most used and 4 recent (spec). */
export const HOME_WITHIN_REACH_PER_ROW = 4;
/** How many UTC days back, today included, a use day counts towards most used (spec). */
export const WITHIN_REACH_USE_WINDOW_DAYS = 90;

/** UTC midnight of the use window's first day: 89 days before today. */
export function windowStartOf(now: number): number {
  return Date.parse(`${utcDay(now - (WITHIN_REACH_USE_WINDOW_DAYS - 1) * DAY_MS)}T00:00:00.000Z`);
}

/** How many days back What happened reaches (spec). */
export const HOME_WHAT_HAPPENED_DAYS = 14;
/** The most actions one What happened read holds, newest first. */
export const HOME_WHAT_HAPPENED_ACTION_MAX = 200;
/** The longest time zone name accepted; the longest IANA name is 32 characters. */
export const HOME_TZ_MAX_LENGTH = 64;

/** The event type of a person's own coalesced open: the open-day record Jump back in counts.
 *  Recorded in their `user` scope only, and deliberately outside the Timeline feed's vocabulary
 *  (docs/specs/013-workspace/timeline.md §4.2). */
export const HOME_OPENED_EVENT_TYPE = 'document_opened';

/** The editor's declaration that a tab read is an open (docs/specs/013-workspace/explorer-home.md
 *  "Opens"). Nothing else sends it, so a duplicate, an embed or a resync is never counted. */
export const DOCUMENT_OPEN_HEADER = 'X-Document-Open';

/** True when a request's `X-Document-Open` value declares an open. */
export function readDocumentOpen(value: string | null): boolean {
  return value === '1';
}

/** What other people did, in the order a summary sentence names them. */
export const HOME_VERBS = [
  'commented',
  'replied',
  'resolved',
  'edited',
  'assigned_you',
  'assigned',
  'completed',
  'shared',
] as const;

export type HomeVerb = (typeof HOME_VERBS)[number];

/** Every refusal of a Home read, as the response's `error` token (status 400). */
export const HOME_REJECTIONS = ['tz_invalid'] as const;

export type HomeRejection = (typeof HOME_REJECTIONS)[number];

const REJECTIONS: ReadonlySet<string> = new Set(HOME_REJECTIONS);

/** True when an error token is a Home refusal. */
export function isHomeRejection(code: string | null): code is HomeRejection {
  return code !== null && REJECTIONS.has(code);
}

/** A document as every part of Home names it: enough to open it, show its thumbnail and say
 *  where it lives. */
export type HomeDocument = {
  documentId: string;
  /** The document's current name. */
  name: string;
  /** How the person reaches it: their own, a joined team's, or shared with them by a link. */
  via: 'own' | 'team' | 'shared';
  /** The live share code that opens it; set for `shared` only. */
  shareCode: string | null;
  /** The one tab a tab-scoped share opens; null = every tab. */
  tabId: string | null;
  /** Null for `shared`: the owner's filing is theirs. */
  teamId: string | null;
  teamName: string | null;
  /** Null for `shared`, and for a document at its space's root. */
  folderId: string | null;
  folderName: string | null;
  ownerName: string | null;
  /** The thumbnail's version. */
  savedAt: number;
  /** Nothing drawn: ask for no thumbnail. */
  empty: boolean;
};

/** One document of Jump back in, with the two measures Within reach places it by. */
export type HomeJumpBackInItem = HomeDocument & {
  /** UTC days in the use window on which the person opened or edited it: most used. */
  useDays: number;
  /** The later of the person's last open and last real edit: recent. */
  lastUsedAt: number;
};

/** Somebody who acted. */
export type HomePerson = {
  id: string;
  name: string | null;
  color: string | null;
  pictureUrl: string | null;
};

/** One thing somebody did. */
export type HomeAction = {
  /** The event's id. */
  id: string;
  verb: HomeVerb;
  personId: string;
  occurredAt: number;
  /** The comment's words, the action's name, or the team's name; null for an edit. */
  detail: string | null;
};

export type HomeVerbCount = { verb: HomeVerb; count: number };

/** One document's actions on one of the reader's days. */
export type HomeGroup = HomeDocument & {
  /** `<documentId>:<day>`. */
  id: string;
  /** YYYY-MM-DD in the reader's time zone. */
  day: string;
  /** More than one person acted: one entry with a summary sentence. */
  summary: boolean;
  /** Distinct people, newest action first. */
  people: HomePerson[];
  /** Distinct verbs with their counts, in `HOME_VERBS` order. */
  verbs: HomeVerbCount[];
  total: number;
  latestAt: number;
  /** Every action, newest first. */
  actions: HomeAction[];
};

/** `GET /api/home`. */
export type HomeResponse = {
  /** The server's Within reach set: the most used, then the recent; at most twice the per-row N. */
  jumpBackIn: HomeJumpBackInItem[];
  whatHappened: HomeGroup[];
  /** The Timeline feed's unread mark as it stood before this read (the read moves it, once per visit);
   *  null when the person had never looked. What happened after it is new to them. */
  lastSeenAt: number | null;
};
