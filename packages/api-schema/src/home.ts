// Explorer Home's data (docs/specs/013-workspace/explorer-home.md; blueprint
// docs/specs/013-workspace/blueprints/explorer-home.md): Jump back in, the person's own Timeline,
// and What happened. The api builds these from D1 and the editor renders them, so the shapes,
// the verbs, the limits and the refusals live here once.

/** The most documents Jump back in holds (spec). */
export const HOME_JUMP_BACK_IN_MAX = 12;
/** Timeline entries per page by default (spec: "30 entries at a time"). */
export const HOME_TIMELINE_PAGE_SIZE = 30;
/** The largest Timeline page a caller may ask for. */
export const HOME_TIMELINE_PAGE_MAX = 100;
/** How many days back What happened reaches (spec). */
export const HOME_WHAT_HAPPENED_DAYS = 14;
/** The most actions one What happened read holds, newest first. */
export const HOME_WHAT_HAPPENED_ACTION_MAX = 200;
/** The longest time zone name accepted; the longest IANA name is 32 characters. */
export const HOME_TZ_MAX_LENGTH = 64;

/** The event type of a person's own coalesced open. Recorded in their `user` scope only, and
 *  deliberately outside the Timeline feed's vocabulary (docs/specs/013-workspace/timeline.md §4.2). */
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
export const HOME_REJECTIONS = ['tz_invalid', 'limit_invalid', 'cursor_invalid'] as const;

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
  /** Null for `shared`, and for a document in its space's Unsorted. */
  folderId: string | null;
  folderName: string | null;
  ownerName: string | null;
  /** The thumbnail's version. */
  savedAt: number;
  /** Nothing drawn: ask for no thumbnail. */
  empty: boolean;
};

/** One document of Jump back in. */
export type HomeJumpBackInItem = HomeDocument & {
  lastOpenedAt: number;
  /** UTC days on which the person opened it. */
  openDays: number;
  /** The rank: the instant the decayed score falls to one (see ./frecency.ts). Sent so the view
   *  can place this browser's own local documents among these. */
  frecencyKey: number;
};

export type HomeTimelineKind = 'created' | 'updated' | 'opened';

/** One of the person's own events. Raw: the one-per-day fold is the view's, where the local
 *  day is known across loaded pages. */
export type HomeTimelineEntry = HomeDocument & {
  /** The event's id; with `occurredAt`, the keyset position. */
  id: string;
  kind: HomeTimelineKind;
  occurredAt: number;
};

export type HomeTimelinePage = {
  items: HomeTimelineEntry[];
  /** `<occurredAt>:<id>` of the last item when another page exists, else null. */
  nextCursor: string | null;
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
  jumpBackIn: HomeJumpBackInItem[];
  timeline: HomeTimelinePage;
  whatHappened: HomeGroup[];
  /** The Timeline's unread mark as it stood before this read (the read moves it, once per visit);
   *  null when the person had never looked. What happened after it is new to them. */
  lastSeenAt: number | null;
};
