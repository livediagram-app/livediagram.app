// Required Reading (docs/specs/030-knowledgebase/required-reading.md) on the wire: whether a page is asked to be read,
// by whom, the caller's own confirmation and the counts, and for an Editor or the page's owner who has read it. The
// api stores it (apps/api/src/knowledge/page-reading.ts); the editor draws the banner, the Page Info section, the
// setup panel and the AI Knowledge card.

/** Everyone who reads the knowledgebase, or the people an Editor chose. */
export type ReadingAudience = 'everyone' | 'people';

/** One person in a page's audience, as an Editor or the page's owner sees them. */
export type PageReadingPerson = {
  id: string;
  name: string;
  /** When they confirmed this round; absent: not yet. */
  readAt?: number;
  /** When they were last reminded of this page. */
  remindedAt?: number;
};

export type PageReadingResponse = {
  /** The page's requirement; null when it is not Required Reading. `round` is 1, then one more each time everyone is
   *  asked again, from `askedAt`. */
  required: { audience: ReadingAudience; askedAt: number; round: number } | null;
  /** The caller's own state: whether they are asked, and when they confirmed this round. */
  mine: { asked: boolean; readAt?: number };
  /** How many of those asked have confirmed, of how many; null when not required. */
  progress: { done: number; total: number } | null;
  /** Whether the caller sees who has read it and may Remind: an Editor or the page's owner, in person. */
  sees: boolean;
  /** Whether the caller may require, change, stop and ask again: an Editor in person. */
  manages: boolean;
  /** The audience, not yet read first: only when `sees`. */
  people?: PageReadingPerson[];
  /** The chosen ids, for the setup panel: only when `manages` and the audience is `people`. */
  chosen?: string[];
  /** When anyone was last reminded of this page: only when `sees`. */
  remindedAt?: number;
  /** Whether Remind can send at all (the deployment sends email). */
  email: boolean;
};

/** `PUT .../pages/<tab>/reading`: require the page for an audience, change it, or stop (null). */
export type PageReadingChange = { audience: ReadingAudience | null; people?: string[] };

/** `POST .../pages/<tab>/reading/remind`: what was sent, or why nothing was. */
export type ReadingRemindResult =
  | { outcome: 'sent'; sent: number }
  | { outcome: 'already_sent'; nextAt: number }
  | { outcome: 'nobody_pending' }
  | { outcome: 'no_recipients' }
  | { outcome: 'daily_limit' }
  | { outcome: 'unavailable' };

/** A Required Reading page in the AI Knowledge overview: counts, never who. */
export type KnowledgeRequiredReadingPage = {
  tab: string;
  title: string;
  audience: ReadingAudience;
  done: number;
  total: number;
};

/** At most this many Required Reading pages a knowledgebase (`reading_pages_full`). */
export const REQUIRED_READING_PAGES_MAX = 200;
/** At most this many chosen people a page (`too_many_people`). */
export const READING_PEOPLE_MAX = 200;
/** At most this many confirmations, changes and asks a minute a person a knowledgebase (`reading_too_fast`). */
export const READING_CHANGES_PER_MINUTE = 30;
/** A page's list of people names at most this many. */
export const READING_LIST_MAX = 500;
/** A person is reminded of a page at most once in this long. */
export const READING_REMIND_GAP_MS = 7 * 86_400_000;

export const isReadingAudience = (value: unknown): value is ReadingAudience =>
  value === 'everyone' || value === 'people';
