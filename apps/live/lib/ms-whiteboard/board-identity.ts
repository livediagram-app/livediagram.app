// A board's document name and dates (docs/specs/020-import-export/whiteboard-import.md
// "Documents"): each board becomes a document named after the board and dated as the board.
import { truncateName } from '@livediagram/document';

// No Microsoft Whiteboard board predates the app's 2017 preview; earlier dates are damage.
export const BOARD_DATES_FLOOR = '2016-01-01T00:00:00.000Z';

export const UNTITLED_DOCUMENT = 'Whiteboard';

export type BoardDates = { createdAt?: string; modifiedAt?: string };

/** A date the import can trust: parses, not before the floor, not after `now`. */
function validDate(value: unknown, now: number): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  // .NET writes seven fractional digits; Date.parse wants at most three.
  const ms = Date.parse(value.trim().replace(/(\.\d{3})\d+/, '$1'));
  if (!Number.isFinite(ms) || ms < Date.parse(BOARD_DATES_FLOOR) || ms > now) return undefined;
  return ms;
}

/** The document's dates from the board record; one valid date stands in for both. */
export function boardDates(created: unknown, modified: unknown, now = Date.now()): BoardDates {
  let c = validDate(created, now);
  let m = validDate(modified, now);
  if (c === undefined) c = m;
  if (m === undefined) m = c;
  if (c === undefined || m === undefined) return {};
  if (c > m) c = m;
  return { createdAt: new Date(c).toISOString(), modifiedAt: new Date(m).toISOString() };
}

const DAY = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** The board's title, or for an untitled board "Whiteboard, 14 Aug 2020" (when it was made). */
export function boardDocumentName(title: unknown, dates: BoardDates): string {
  const clean = typeof title === 'string' ? title.replace(/\s+/g, ' ').trim() : '';
  if (clean) return truncateName(clean);
  const when = dates.createdAt ?? dates.modifiedAt;
  // "Sept" is en-GB's own short September; the rest are three letters.
  return when ? `${UNTITLED_DOCUMENT}, ${DAY.format(new Date(when))}` : UNTITLED_DOCUMENT;
}
