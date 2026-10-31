// Every match of a query across a tab's searched texts (docs/specs/007-editor/find-and-replace.md "Matching", "The
// count and stepping"; blueprint "Matching", "The current match"). Pure.
import { findInText, type FindOptions } from './find-text';
import type { FindTarget } from './find-targets';

// The most matches counted and highlighted; past it the count reads "5,000+".
export const FIND_MATCHES_MAX = 5000;

export type FindMatch = {
  // The index of its searched text in the targets.
  target: number;
  start: number;
  end: number;
};

/** Every match, in Find's order, at most `limit` (FIND_MATCHES_MAX by default). */
export function findMatches(
  targets: readonly FindTarget[],
  query: string,
  opts: FindOptions,
  limit = FIND_MATCHES_MAX,
): { matches: FindMatch[]; capped: boolean } {
  const matches: FindMatch[] = [];
  if (query === '') return { matches, capped: false };
  for (let t = 0; t < targets.length; t++) {
    // One more than room is left, to know whether the cap cut anything off.
    const left = limit - matches.length;
    const starts = findInText(targets[t]!.text, query, opts, left + 1);
    for (const start of starts.slice(0, left)) {
      matches.push({ target: t, start, end: start + query.length });
    }
    if (starts.length > left) return { matches, capped: true };
  }
  return { matches, capped: false };
}

/** The match a new search starts on: the first on the page in view or after it in the row, else the first. */
export function firstMatchFrom(
  matches: readonly FindMatch[],
  targets: readonly FindTarget[],
  pageOrder: readonly string[],
  pageInView: string | undefined,
): number | null {
  if (matches.length === 0) return null;
  const from = pageInView === undefined ? 0 : Math.max(0, pageOrder.indexOf(pageInView));
  const rank = new Map(pageOrder.map((id, i) => [id, i] as const));
  const at = matches.findIndex((m) => (rank.get(targets[m.target]!.pageId) ?? 0) >= from);
  return at < 0 ? 0 : at;
}

/** Where the match in hand is after the matches were found again (an edit, anyone's): the same text at the same
 *  place, else the first after where it was, else round to the first. */
export function sameMatchAgain(
  was: { key: string; start: number; order: number } | null,
  matches: readonly FindMatch[],
  targets: readonly FindTarget[],
): number | null {
  if (matches.length === 0) return null;
  if (!was) return 0;
  const same = matches.findIndex(
    (m) => targets[m.target]!.key === was.key && m.start === was.start,
  );
  if (same >= 0) return same;
  // The first match of the same text at or past the old place, else the first in a later text.
  // Its text's place among the texts now, or where it was when the text is gone.
  const wasOrder = targets.findIndex((t) => t.key === was.key);
  const place = wasOrder >= 0 ? wasOrder : was.order;
  const after = matches.findIndex((m) =>
    targets[m.target]!.key === was.key ? m.start >= was.start : m.target > place,
  );
  return after < 0 ? 0 : after;
}

/** The match a step lands on: the next or the previous, round at the ends. */
export function stepMatch(index: number | null, count: number, by: 1 | -1): number | null {
  if (count === 0) return null;
  if (index === null) return by === 1 ? 0 : count - 1;
  return (((index + by) % count) + count) % count;
}
