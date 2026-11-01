// A board read from another tool's export (docs/specs/026-plan/tracker-import.md), before it is planned into a card
// type, a board and cards (tracker-plan.ts). Every string here has been cleaned (tracker-text.ts): nothing in it is
// trusted, nothing is markup.
import { ITEMS_MAX } from '../limits';
import type { Priority } from '../fields';

export type TrackerSource = 'trello' | 'asana' | 'jira' | 'linear';

export const TRACKER_SOURCES: readonly TrackerSource[] = ['trello', 'asana', 'jira', 'linear'];

export const TRACKER_SOURCE_NAMES: Readonly<Record<TrackerSource, string>> = {
  trello: 'Trello',
  asana: 'Asana',
  jira: 'Jira',
  linear: 'Linear',
};

export function isTrackerSource(v: unknown): v is TrackerSource {
  return typeof v === 'string' && (TRACKER_SOURCES as readonly string[]).includes(v);
}

// The largest file an import reads: a big Trello board's JSON carries every action on it.
export const TRACKER_FILE_MAX_BYTES = 20 * 1024 * 1024;
// A file of more cards than a plan holds is refused outright: an import is never made in part.
export const TRACKER_CARDS_MAX = ITEMS_MAX;
// Comments one import carries in all (ten a card at the cap), and on one card (project THREAD_COMMENTS_MAX).
export const TRACKER_COMMENTS_MAX = 20_000;
export const TRACKER_CARD_COMMENTS_MAX = 200;
// One comment's text, as a posted comment's (project THREAD_COMMENT_TEXT_MAX).
export const TRACKER_COMMENT_TEXT_MAX = 2_000;
// The characters of comment JSON a card's thread is planned to: under project THREAD_BYTES (131,072), with room for
// each comment's id, date and author.
export const TRACKER_THREAD_BUDGET = 120_000;
// What one comment costs the budget beyond its text's JSON: its id, date, author and colour.
export const TRACKER_COMMENT_OVERHEAD = 160;
// The most options a Choice field holds (CUSTOM_CHOICE_OPTIONS_MAX); more, and the field is Text.
export const TRACKER_CHOICE_MAX = 20;

export interface TrackerPerson {
  name: string;
  // Lower-cased, when the source gave one.
  email?: string;
}

export interface TrackerComment {
  author: string;
  // Unix ms, or null when the source gave no readable date.
  at: number | null;
  text: string;
}

export interface TrackerLink {
  name: string;
  url: string;
}

// An extra the source has that no built-in field holds: a new custom field on the card type.
export interface TrackerExtra {
  key: string;
  label: string;
  // What the source calls it, when that is not its label ("Component/s").
  from?: string;
  kind: 'text' | 'choice' | 'person';
  // A Choice's options, in the order the file names them.
  options?: readonly string[];
  // A Person field that holds several (Trello's Members).
  several?: boolean;
}

export type TrackerExtraValue = string | readonly TrackerPerson[];

export interface TrackerCard {
  title: string;
  // The source column (list, status or section) the card is in, as the source names it.
  column: string;
  description: string;
  assignee?: TrackerPerson;
  priority?: Priority;
  estimate?: number;
  start?: string;
  due?: string;
  labels: readonly string[];
  checklist: readonly { text: string; done: boolean }[];
  comments: readonly TrackerComment[];
  links: readonly TrackerLink[];
  extras: Record<string, TrackerExtraValue>;
}

// Why something in the file is left out, each counted for the preview.
export type TrackerSkipReason =
  | 'archivedCards'
  | 'archivedLists'
  | 'untitledRows'
  | 'commentsOverCap'
  | 'attachmentLinks'
  | 'attachmentsNoLink'
  | 'otherColumn'
  | 'shortened'
  | 'invalidCards';

export type TrackerSkips = Partial<Record<TrackerSkipReason, number>>;

export interface TrackerBoard {
  source: TrackerSource;
  title: string;
  // The source's columns in its order, every column a card names among them.
  columns: readonly string[];
  cards: readonly TrackerCard[];
  extras: readonly TrackerExtra[];
  skips: TrackerSkips;
}

export function addSkip(skips: TrackerSkips, reason: TrackerSkipReason, n = 1): void {
  if (n > 0) skips[reason] = (skips[reason] ?? 0) + n;
}
