// A board's title and dates for its document (docs/specs/020-import-export/whiteboard-import.md
// "Documents"), cleaned from the board record. The document's name and the api's own date rule
// are the board scene's (board-document.ts); this only reads what Whiteboard wrote.
import { truncateName } from '@livediagram/document';

// No Microsoft Whiteboard board predates the app's 2017 preview; earlier dates are damage.
export const BOARD_DATES_FLOOR = '2016-01-01T00:00:00.000Z';

export type BoardDates = { createdAt?: string; modifiedAt?: string };

/** A date the import can trust: parses, not before the floor, not after `now`. */
function validDate(value: unknown, now: number): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const ms = Date.parse(value.trim());
  if (!Number.isFinite(ms) || ms < Date.parse(BOARD_DATES_FLOOR) || ms > now) return undefined;
  return ms;
}

/** The board's dates as ISO; one valid date stands in for both, created never after modified. */
export function boardDates(created: unknown, modified: unknown, now = Date.now()): BoardDates {
  let c = validDate(created, now);
  let m = validDate(modified, now);
  if (c === undefined) c = m;
  if (m === undefined) m = c;
  if (c === undefined || m === undefined) return {};
  if (c > m) c = m;
  return { createdAt: new Date(c).toISOString(), modifiedAt: new Date(m).toISOString() };
}

/** The board's title, whitespace collapsed and capped at the name limit; undefined when blank. */
export function boardTitle(title: unknown): string | undefined {
  const clean = typeof title === 'string' ? title.replace(/\s+/g, ' ').trim() : '';
  return clean ? truncateName(clean) : undefined;
}
