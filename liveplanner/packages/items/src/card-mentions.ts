// Card mentions (docs/specs/026-plan/github-pull-requests.md "How a card names its pull requests"): a pull request's
// title or body naming a card as "{plan name} #{number}" ("Work Tracker #143"). Read left to right with indexOf and
// plain loops, no regex, so a long body never backtracks. Pure.

// How much of a text is read (GitHub's own cap on a pull request's body), and the most cards one text names.
export const MENTION_TEXT_MAX = 65_536;
export const MENTIONS_MAX = 20;
const NUMBER_DIGITS_MAX = 10;

const isDigit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9';
const isSpace = (c: string | undefined) =>
  c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ' ';
// A letter or digit of any script: what may not touch a mention on either side.
const isWordChar = (c: string | undefined) =>
  c !== undefined && (isDigit(c) || c.toLowerCase() !== c.toUpperCase());

// A plan name's words as names compare: case aside, any run of spaces one space.
function nameWords(name: string): string[] {
  return name.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * The card numbers `text` mentions as `planName` followed by spaces or none, an optional `#` and the number, with no
 * letter or digit on either side. In the order first met, each once, at most `MENTIONS_MAX`; only the first
 * `MENTION_TEXT_MAX` characters are read.
 */
export function cardMentions(text: string, planName: string): number[] {
  const words = nameWords(planName);
  if (words.length === 0 || !text) return [];
  const t = text.slice(0, MENTION_TEXT_MAX).toLowerCase();
  const first = words[0]!;
  const out: number[] = [];
  const seen = new Set<number>();
  let from = 0;
  while (out.length < MENTIONS_MAX) {
    const i = t.indexOf(first, from);
    if (i < 0) break;
    from = i + 1;
    if (isWordChar(t[i - 1])) continue;
    const n = mentionAt(t, i, words);
    if (n === undefined || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

// The number a mention starting at `i` names, or undefined when there is none there.
function mentionAt(t: string, i: number, words: readonly string[]): number | undefined {
  let j = i;
  for (let w = 0; w < words.length; w++) {
    if (w > 0) {
      if (!isSpace(t[j])) return undefined;
      while (isSpace(t[j])) j++;
    }
    const word = words[w]!;
    if (!t.startsWith(word, j)) return undefined;
    j += word.length;
  }
  // Spaces or none, an optional `#`, then the number. A name ending in a digit ("Sprint 4") needs one of them, so
  // "Sprint 412" never reads as card 12.
  const nameEnd = j;
  while (isSpace(t[j])) j++;
  if (t[j] === '#') j++;
  if (j === nameEnd && isDigit(t[j - 1])) return undefined;
  const start = j;
  while (isDigit(t[j]) && j - start <= NUMBER_DIGITS_MAX) j++;
  const digits = j - start;
  if (digits === 0 || digits > NUMBER_DIGITS_MAX || isWordChar(t[j])) return undefined;
  const n = Number(t.slice(start, j));
  return n >= 1 ? n : undefined;
}
