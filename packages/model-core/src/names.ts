// Tab + document name length (docs/specs/006-document/name-length.md).
//
// Names had no cap. Mostly invisible when you type one by hand, but the
// editor also AUTO-NAMES a tab and document from the first element's label
// (docs/specs/006-document/document-structure.md) — so pasting a paragraph into the welcome rectangle made the
// whole paragraph the document's name, which then had to be rendered in the
// header, the browser tab title, the Explorer list and every share surface.
//
// One helper, applied at every entry point, so a name can't arrive over-long
// from any direction (auto-naming, manual rename, import, API).

// 60 characters. The issue that prompted this suggested 40-60; 60 is the top
// of that range, which keeps real titles ("Q3 platform migration — phase 2
// rollout") intact while still fitting a tab pill and a browser tab title.
// Counted in code points, not UTF-16 units, so an emoji or accented
// character costs one the way a reader would count it.
export const NAME_MAX_LENGTH = 60;

// Trim a name to NAME_MAX_LENGTH, breaking at a WORD boundary and marking
// the cut with an ellipsis. Word-boundary because a mid-word chop reads as
// corruption ("Quarterly platform migra…") where a whole-word one reads as
// a summary.
//
// Also collapses whitespace: an auto-name derived from a pasted block would
// otherwise carry newlines and runs of spaces into a single-line title.
export function truncateName(raw: string): string {
  return cutName(raw, NAME_MAX_LENGTH);
}

// `truncateName` to a given cap: the one cap unless a caller adds words after the name (a copy's suffix).
function cutName(raw: string, max: number): string {
  const collapsed = raw.replace(/\s+/gu, ' ').trim();
  const chars = [...collapsed];
  if (chars.length <= max) return collapsed;
  // One char short of the cap so the ellipsis fits inside the budget.
  const clipped = chars.slice(0, max - 1).join('');
  const lastSpace = clipped.lastIndexOf(' ');
  // Only honour the word boundary if it leaves something worth reading —
  // a very long first word (a URL, a hash) would otherwise truncate to
  // nearly nothing, where a hard cut at least shows its opening.
  const body = lastSpace > max / 3 ? clipped.slice(0, lastSpace) : clipped;
  return `${body.trimEnd()}…`;
}

// What a copy is called until its person renames it: the name and " (copy)", the name cut so the whole
// fits NAME_MAX_LENGTH and the suffix is never the part that is lost.
const COPY_SUFFIX = ' (copy)';
export function copyName(name: string): string {
  return `${cutName(name, NAME_MAX_LENGTH - COPY_SUFFIX.length)}${COPY_SUFFIX}`;
}

// A letter or a number in any script (Latin, Cyrillic, Arabic, Hebrew, CJK, an astral letter), one code point.
const LETTER = /^[\p{L}\p{N}]$/u;

// The letters and numbers of each word, punctuation and symbols (emoji among them) dropped, words with none left out.
// An email (`ada.lovelace@…`) is read as the words of its local part.
function letterWords(text: string): string[][] {
  const trimmed = text.trim();
  const email = trimmed.includes('@') && !/\s/.test(trimmed);
  const words = email
    ? trimmed.slice(0, trimmed.indexOf('@')).split(/[._+-]/)
    : trimmed.split(/\s+/);
  return words
    .map((word) => Array.from(word).filter((ch) => LETTER.test(ch)))
    .filter((letters) => letters.length > 0);
}

// Up to two characters for a person's avatar, the one rule every app's avatars, presence stacks and cursors share
// (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures"): the first letter of the first and last
// words ("Curious Falcon" -> "CF"), or a single word's first two ("owl" -> "OW"). Only letters and numbers count, so
// "<Oscar>" reads "OS", never "<O". A name with none (only emoji or punctuation) takes `fallback`'s, an email's
// local part, else "?". Here rather than in the editor so the headless export draws the same initials the canvas
// does (a Roll call's people, docs/specs/020-import-export/export-fidelity.md). Letters are code points, so an
// astral letter stays whole rather than showing half of it as a replacement character.
export function initialsOf(name: string, fallback?: string | null): string {
  let words = letterWords(name);
  if (words.length === 0 && fallback) words = letterWords(fallback);
  if (words.length === 0) return '?';
  const picked =
    words.length === 1 ? words[0]!.slice(0, 2) : [words[0]![0]!, words[words.length - 1]![0]!];
  return picked.join('').toUpperCase();
}
