// Find in one text (docs/specs/007-editor/find-and-replace.md "Matching"; blueprint "Matching"): plain text, never a
// pattern, so nothing typed ever reaches a RegExp. One left-to-right Knuth-Morris-Pratt scan over UTF-16 code units,
// each folded on its own, so the work is linear in the text whatever the query, and a match has the query's length
// (its offsets map 1:1 into the text, which Replace and the highlights rely on).

export type FindOptions = { matchCase: boolean; wholeWord: boolean };

export const DEFAULT_FIND_OPTIONS: FindOptions = { matchCase: false, wholeWord: false };

// The longest query the Find field takes (the field's maxLength).
export const FIND_QUERY_MAX = 500;

// A code unit as the comparison sees it: as typed with Match Case, else lower-cased where lower-casing keeps it one
// unit (it does for every letter but a handful, such as the dotted capital I, which then match only as typed).
function foldUnit(unit: string, matchCase: boolean): number {
  const code = unit.charCodeAt(0);
  if (matchCase) return code;
  // ASCII without a string made per character: most text is.
  if (code < 128) return code >= 65 && code <= 90 ? code + 32 : code;
  const lower = unit.toLowerCase();
  return (lower.length === 1 ? lower : unit).charCodeAt(0);
}

// A letter, a combining mark, a digit or an underscore: what Whole Word will not let touch a match. A test of one
// character with a fixed pattern (no repeats), so it costs the same for any input.
const WORD_UNIT = /[\p{L}\p{M}\p{N}_]/u;
export function isWordUnit(unit: string | undefined): boolean {
  return unit !== undefined && unit !== '' && WORD_UNIT.test(unit);
}

/** The query folded, and its failure table (the longest proper prefix that is also a suffix, per prefix). */
function prepare(query: string, matchCase: boolean): { q: number[]; fail: number[] } {
  const q = Array.from({ length: query.length }, (_, i) => foldUnit(query[i]!, matchCase));
  const fail = new Array<number>(q.length).fill(0);
  for (let i = 1, k = 0; i < q.length; i++) {
    while (k > 0 && q[i] !== q[k]) k = fail[k - 1]!;
    if (q[i] === q[k]) k += 1;
    fail[i] = k;
  }
  return { q, fail };
}

/** Where `query` occurs in `text` (each match's start; its end is start + query.length), left to right, never
 *  overlapping, at most `limit` of them. An empty query finds nothing. */
export function findInText(
  text: string,
  query: string,
  opts: FindOptions,
  limit = Number.POSITIVE_INFINITY,
): number[] {
  const out: number[] = [];
  const m = query.length;
  if (m === 0 || m > text.length || limit <= 0) return out;
  const { q, fail } = prepare(query, opts.matchCase);
  let k = 0;
  for (let i = 0; i < text.length; i++) {
    const c = foldUnit(text[i]!, opts.matchCase);
    while (k > 0 && c !== q[k]) k = fail[k - 1]!;
    if (c === q[k]) k += 1;
    if (k < m) continue;
    const start = i - m + 1;
    const whole = !opts.wholeWord || (!isWordUnit(text[start - 1]) && !isWordUnit(text[i + 1]));
    if (whole) {
      out.push(start);
      if (out.length >= limit) break;
      // Past the match: the next one starts after it.
      k = 0;
    } else {
      k = fail[k - 1]!;
    }
  }
  return out;
}
