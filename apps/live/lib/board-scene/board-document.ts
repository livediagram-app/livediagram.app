// An imported board as its own document (docs/specs/020-import-export/board-import.md "new-document"):
// named after the board, dated as the board. Pure; the import hook creates the document.
import { documentDates } from '@livediagram/api-schema';
import type { BoardScene } from './scene';

// What an untitled board's document is called, its created date after it.
export const UNTITLED_BOARD_NAME = 'Whiteboard';
export const UNREADABLE_DATES_RULE = "Board dates that couldn't be read were set to today";

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const parse = (iso: string | undefined): number | undefined => {
  if (iso === undefined) return undefined;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : Number.NaN;
};

export type BoardDocumentDates = {
  createdAt?: number;
  savedAt?: number;
  // A date was given and could not be used: the document is dated today.
  unreadable: boolean;
};

/**
 * The board's created and last-modified dates as the create sends them, checked by the same rule
 * the api applies (documentDates): both when both hold, the created one alone when only it does,
 * none otherwise.
 */
export function boardDocumentDates(
  scene: Pick<BoardScene, 'createdAt' | 'modifiedAt'>,
  now: number,
): BoardDocumentDates {
  const created = parse(scene.createdAt);
  const modified = parse(scene.modifiedAt);
  if (created === undefined) {
    return { unreadable: modified !== undefined };
  }
  const both = documentDates({ createdAt: created, savedAt: modified }, now);
  if (both.ok)
    return {
      createdAt: both.createdAt,
      ...(modified !== undefined ? { savedAt: both.savedAt } : {}),
      unreadable: false,
    };
  const alone = documentDates({ createdAt: created }, now);
  return alone.ok ? { createdAt: alone.createdAt, unreadable: true } : { unreadable: true };
}

/** The document's name: the board's title, else "Whiteboard, 14 Aug 2020", else "Whiteboard". */
export function boardDocumentName(scene: BoardScene, createdAt: number | undefined): string {
  const title = scene.title?.trim();
  if (title) return title;
  return createdAt === undefined
    ? UNTITLED_BOARD_NAME
    : `${UNTITLED_BOARD_NAME}, ${DATE_FORMAT.format(new Date(createdAt))}`;
}
