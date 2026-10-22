// A line's width in ems, estimated per character from the class it falls in (narrow, wide, capital, digit), for an
// export that places text side by side with no DOM to measure it. A flat average per character runs short on wide
// letters ("Home" at 0.51 em each is 2.0 em, Inter draws it near 2.7), so labels placed one after another overlapped.
// Erring wide only spends a little more room. Pure.

// Inter's advances, rounded up a touch, by character class.
const NARROW = new Set([...`ijl|!.,:;'"`]);
const SEMI_NARROW = new Set([...'frt()[]{}/\\-']);
const WIDE = new Set([...'mw']);
const WIDE_CAPS = new Set([...'MW']);
const EM = {
  narrow: 0.27,
  semiNarrow: 0.38,
  space: 0.28,
  lower: 0.6,
  wide: 0.88,
  capital: 0.74,
  capitalNarrow: 0.3,
  wideCapital: 0.98,
  digit: 0.62,
  other: 0.62,
} as const;

function charEm(ch: string): number {
  if (ch === ' ') return EM.space;
  if (NARROW.has(ch)) return EM.narrow;
  if (SEMI_NARROW.has(ch)) return EM.semiNarrow;
  if (WIDE.has(ch)) return EM.wide;
  if (WIDE_CAPS.has(ch)) return EM.wideCapital;
  if (ch === 'I') return EM.capitalNarrow;
  if (ch >= 'A' && ch <= 'Z') return EM.capital;
  if (ch >= 'a' && ch <= 'z') return EM.lower;
  if (ch >= '0' && ch <= '9') return EM.digit;
  return EM.other;
}

/** The estimated width of `text` on one line, in ems of its font size. */
export function textAdvanceEm(text: string): number {
  let em = 0;
  for (const ch of text) em += charEm(ch);
  return em;
}

// A bold glyph's advance as a share of a regular one's, as the headless renders widen a bold label's estimate.
export const BOLD_EM = 1.06;
