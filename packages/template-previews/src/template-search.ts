// One search for a product's template catalogue (each product's docs/specs/008-canvas/canvas-and-palette.md
// "Template categories", Search), shared by the editor's template step and the marketing gallery so the two find the
// same templates: a template matches when every word typed is found, case, punctuation and hyphens ignored, in its
// title, description, kind, or the words the product gives for it (the labels of every category it is shown in, their
// search words, its own search words). Each product binds it to its catalogue with `createTemplateSearch`.
// A word that is not found as typed still finds a template one slip away (a letter missing, extra, wrong or two
// swapped; two slips from eight letters), so "wirefrme" lists the wireframes; words under four letters stay exact.

/** What a search reads of a template. */
export type SearchableTemplate<Kind extends string = string> = {
  kind: Kind;
  title: string;
  description: string;
};

// Punctuation and hyphens are no part of a word here, on both sides: read as a space ("to-do" is "to do", "1-on-1" is
// "1 on 1"), or dropped within a word ("to-do" is "todo"), so a word typed either way finds it.
const PUNCTUATION = /[^\p{L}\p{N}\s]+/gu;
const spaced = (s: string): string =>
  s.toLowerCase().replace(PUNCTUATION, ' ').replace(/\s+/g, ' ').trim();
const joined = (s: string): string => s.toLowerCase().replace(PUNCTUATION, '');

type Haystack = { spaced: string; joined: string; words: string[] };

/** The slips a typed word of this length may carry: none under four letters, one under eight, else two. */
export function typoAllowance(length: number): number {
  if (length < 4) return 0;
  return length < 8 ? 1 : 2;
}

/**
 * True when `a` is within `max` edits of `b` (a letter added, dropped or changed, or two next to each other swapped:
 * the optimal string alignment distance). Left to right over two rows, leaving early once a whole row is over `max`.
 */
export function withinEdits(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let least = i;
    for (let j = 1; j <= b.length; j++) {
      let d = Math.min(
        prev[j]! + 1,
        row[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, prev2[j - 2]! + 1);
      }
      row.push(d);
      if (d < least) least = d;
    }
    if (least > max) return false;
    prev2 = prev;
    prev = row;
  }
  return prev[b.length]! <= max;
}

/** A search over one template; `exact` is the same test without the slips allowed, to rank exact finds first. */
export type TemplateSearch<Kind extends string> = ((
  t: SearchableTemplate<Kind>,
  query: string,
) => boolean) & { exact: (t: SearchableTemplate<Kind>, query: string) => boolean };

/** The words of a query as typed, lower-cased; none for an empty one, or one of punctuation alone. */
export function templateQueryWords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => joined(w) !== '');
}

/**
 * A product's `templateMatchesQuery`: true when every word of the query is found in the template's searchable text
 * (an empty query matches all), its punctuation read as spaces or dropped ("to-do" finds "to do" and "todo").
 * `wordsOf` gives the product's own words for a kind, beyond its title, description and kind.
 */
export function createTemplateSearch<Kind extends string>(
  wordsOf: (kind: Kind) => readonly string[],
): TemplateSearch<Kind> {
  const haystacks = new Map<Kind, Haystack>();
  // Built once per template and kept: the catalogue is fixed, and a search runs per keystroke over every template.
  const haystack = (t: SearchableTemplate<Kind>): Haystack => {
    let hay = haystacks.get(t.kind);
    if (hay === undefined) {
      const fields = [t.title, t.description, t.kind, ...wordsOf(t.kind)];
      const text = fields.map(spaced).join('\n');
      hay = {
        spaced: text,
        joined: fields.map(joined).join('\n'),
        words: [...new Set(text.split(/\s+/))],
      };
      haystacks.set(t.kind, hay);
    }
    return hay;
  };
  const found = (hay: Haystack, w: string) =>
    hay.spaced.includes(spaced(w)) || hay.joined.includes(joined(w));
  // A word a slip or two off one of the template's words (a bounded edit distance, only for words of 4+ letters).
  const nearly = (hay: Haystack, w: string) => {
    const typed = joined(w);
    const max = typoAllowance(typed.length);
    return max > 0 && hay.words.some((word) => withinEdits(typed, word, max));
  };
  const search = (t: SearchableTemplate<Kind>, query: string) => {
    const words = templateQueryWords(query);
    if (words.length === 0) return true;
    const hay = haystack(t);
    return words.every((w) => found(hay, w) || nearly(hay, w));
  };
  search.exact = (t: SearchableTemplate<Kind>, query: string) => {
    const hay = haystack(t);
    return templateQueryWords(query).every((w) => found(hay, w));
  };
  return search;
}
