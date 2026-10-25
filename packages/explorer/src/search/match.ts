// The Search panel's matching (README.md "Search panel"): what it finds without asking the index (folders, teams and
// the host's entries), and how many of each it shows. Items are the index's to find (its `search` view).

/** At most this many of each group: a panel, not a list. */
export const SEARCH_GROUP_MAX = 8;
/** The typing pauses this long before the index is asked; the request before is cancelled. */
export const SEARCH_DEBOUNCE_MS = 200;

/** The lower-cased words of a query. */
export const queryWords = (query: string): string[] =>
  query.toLowerCase().split(/\s+/).filter(Boolean);

/**
 * The things whose text holds every word, those starting with the first word first, at most `max`. Linear in the
 * things given (each lowered once), and it keeps no more than `max` of either kind.
 */
export function matchAll<T>(
  things: readonly T[],
  words: readonly string[],
  text: (thing: T) => string,
  max = SEARCH_GROUP_MAX,
): T[] {
  if (words.length === 0) return [];
  const first = words[0]!;
  const leading: T[] = [];
  const rest: T[] = [];
  for (const thing of things) {
    if (leading.length >= max) break;
    const lower = text(thing).toLowerCase();
    if (!words.every((w) => lower.includes(w))) continue;
    if (lower.startsWith(first)) leading.push(thing);
    else if (rest.length < max) rest.push(thing);
  }
  return [...leading, ...rest].slice(0, max);
}
