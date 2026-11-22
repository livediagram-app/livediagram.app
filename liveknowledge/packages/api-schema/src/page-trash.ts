// A knowledgebase's page Trash (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page Trash"): a
// deleted page waits here 30 days, whole, and comes back from it as it was. Not the platform's Trash of whole
// knowledgebases (./trash.ts): the two never mix.

import { TRASH_RETENTION_DAYS } from '@liveworkspace/api-schema/trash';

/** Days a page waits in the Trash before it is removed for good: the platform Trash's, so `trashDaysLeft` (./trash)
 *  counts a page's days too. */
export const PAGE_TRASH_DAYS = TRASH_RETENTION_DAYS;

/** The most pages the Trash holds: the knowledgebase's own page limit, so the Trash never outgrows the tree.
 *  Putting the 501st in removes the oldest for good. */
export const MAX_TRASHED_PAGES = 500;

/** One page put in the Trash, as a person sees it: with the trashed pages that were under it. */
export type TrashedPage = {
  id: string;
  name: string;
  /** When it was put in the Trash, ms since the epoch. */
  trashedAt: number;
  /** Who put it there, as they were named then; null when that is not known. */
  trashedBy: string | null;
  /** The trashed pages under it, in tree order. */
  subpages: { id: string; name: string }[];
};

export type PageTrashResponse = { pages: TrashedPage[] };

/** A restore's answer: the pages back in the tree, and whether the page came back at the top level because its
 *  parent is gone. */
export type PageRestoreResponse = { restored: string[]; topLevel: boolean };

/** The refusal every Trash door answers a token with: the Trash is a person's, in the editor. */
export const TRASH_IS_A_PERSONS = 'trash_is_a_persons';

/** A Trash door named a page that is not in the Trash. */
export const NOT_IN_TRASH = 'not_in_trash';
