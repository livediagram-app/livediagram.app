// Where a suggested edit's passage sits in a page's writing (docs/specs/030-knowledgebase/insights.md "On the
// page"; blueprint suggested-edits-ui.md "Finding the passage"). A suggestion's `before` is Markdown as an agent read
// the page; the writing on screen is text. Both are read as words, the Markdown's marks set aside (a heading's `#`, a
// list's marker, a quote's `>`, emphasis, backticks, a link's address, escapes, a table's pipes), and the passage is
// found where its words stand in the writing's text, in order, with any run of spaces and line breaks between them.
// Found once, it is marked; found nowhere, or in more than one place, it is never marked: the page is never marked in
// the wrong place. Pure: the writing's plugin builds the text and maps the answer to the document.
import type { KnowledgeSuggestion } from '@liveknowledge/api-schema';

/** The most words of a passage matched (a suggestion holds 20,000 characters at most; this bounds the pattern). */
export const PASSAGE_WORDS_MAX = 4_000;

const LINE_LEAD = /^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+(?:\[[ xX]\]\s+)?|\d{1,9}[.)]\s+)+/;
const FENCE = /^\s*(```|~~~)/;
const TABLE_RULE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const FRONT = /^(title|subtitle):\s*/;

/** The words of a Markdown passage as its text reads on the page. */
export function passageWords(markdown: string): string[] {
  const words: string[] = [];
  for (const raw of markdown.split('\n')) {
    if (FENCE.test(raw) || TABLE_RULE.test(raw) || raw.trim() === '---' || raw.trim() === '***')
      continue;
    const line = raw
      .replace(LINE_LEAD, '')
      .replace(FRONT, '')
      // Pictures read as nothing, links as their words, footnote references as nothing.
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[\^[^\]]+\]/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Escapes read as the character escaped; a hard break's trailing backslash as a break.
      .replace(/\\([!-/:-@[-`{-~])/g, '$1')
      .replace(/\\$/, '')
      // Emphasis and code marks, and a table's cell walls.
      // Underscores only at a word's edge, so `snake_case` keeps its own.
      .replace(/(\*{1,3}|~~)(?=\S)([\s\S]*?\S)\1/g, '$2')
      .replace(/(?<!\w)(_{1,3})(?=\S)([\s\S]*?\S)\1(?!\w)/g, '$2')
      .replace(/`+/g, '')
      .replace(/\|/g, ' ');
    for (const word of line.split(/\s+/)) if (word) words.push(word);
  }
  return words.slice(0, PASSAGE_WORDS_MAX);
}

/** Where the passage's words stand in `text`, once: [from, to) offsets, or null when they stand nowhere or in more
 *  than one place. Any run of whitespace in `text` matches one space between the words. Linear: `text` is collapsed
 *  once and searched with indexOf (a regex built from a long passage's words took seconds to compile). */
export function locatePassage(text: string, markdown: string): { from: number; to: number } | null {
  const words = passageWords(markdown);
  if (words.length === 0) return null;
  // The text with each whitespace run made one space, and where each of its words starts in both.
  const starts: { flat: number; at: number }[] = [];
  let flat = '';
  for (const match of text.matchAll(/\S+/g)) {
    if (flat) flat += ' ';
    starts.push({ flat: flat.length, at: match.index });
    flat += match[0];
  }
  const needle = words.join(' ');
  const found = flat.indexOf(needle);
  // A second place, starting after the first one's start, makes it ambiguous.
  if (found < 0 || flat.indexOf(needle, found + 1) >= 0) return null;
  // A flat offset back in `text`: within the word that holds it (no space is ever an end of the match).
  const back = (offset: number) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid]!.flat <= offset) lo = mid;
      else hi = mid - 1;
    }
    return starts[lo]!.at + (offset - starts[lo]!.flat);
  };
  return { from: back(found), to: back(found + needle.length - 1) + 1 };
}

/** The text a suggestion puts in, as it reads on the page: its words line by line, its blank lines dropped. */
export function arrivingLines(markdown: string): string[] {
  return markdown
    .split('\n')
    .filter((line) => line.trim() !== '' && !FENCE.test(line) && !TABLE_RULE.test(line))
    .map((line) => passageWords(line).join(' '))
    .filter((line) => line !== '');
}

/** "1 Suggested Edit", "3 Suggested Edits". */
export const suggestedEditsLabel = (n: number): string =>
  `${n.toLocaleString('en')} Suggested Edit${n === 1 ? '' : 's'}`;

/** "1 removed, 2 added": the lines the change takes out and puts in. */
export function changeCounts(s: Pick<KnowledgeSuggestion, 'kind' | 'before' | 'after'>): string {
  const lines = (text: string) => text.split('\n').filter((line) => line.trim() !== '').length;
  const removed = s.kind === 'append' ? 0 : lines(s.before);
  const added = lines(s.after);
  if (removed === 0) return `${added} added`;
  return `${removed} removed, ${added} added`;
}

/** The suggestion's first line of reason, for a row. */
export const reasonLine = (s: Pick<KnowledgeSuggestion, 'summary' | 'reason'>): string =>
  s.summary || s.reason.split('\n')[0] || '';

/** One step of a word diff: a word kept, one that goes (`old` its index), one that arrives (`new` its index). */
export type WordStep =
  | { kind: 'same'; old: number; new: number }
  | { kind: 'gone'; old: number }
  | { kind: 'new'; new: number };

/** The most cells a word diff works through (500 words against 500): past it the whole passage goes and the whole
 *  suggestion arrives, so a long suggestion costs a bounded moment, never a frozen page. */
export const WORD_DIFF_CELLS_MAX = 250_000;

/** The words that go and arrive between two passages, in order: the longest run they share kept. */
export function wordDiff(before: readonly string[], after: readonly string[]): WordStep[] {
  const n = before.length;
  const m = after.length;
  if (n * m > WORD_DIFF_CELLS_MAX) {
    return [
      ...before.map((_, old): WordStep => ({ kind: 'gone', old })),
      ...after.map((_, at): WordStep => ({ kind: 'new', new: at })),
    ];
  }
  // lcs[i][j]: the longest shared run of before[i..] and after[j..], one row of m + 1 at a time.
  const lcs = new Uint32Array((n + 1) * (m + 1));
  const at = (i: number, j: number) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[at(i, j)] =
        before[i] === after[j]
          ? lcs[at(i + 1, j + 1)]! + 1
          : Math.max(lcs[at(i + 1, j)]!, lcs[at(i, j + 1)]!);
  const steps: WordStep[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && before[i] === after[j]) {
      steps.push({ kind: 'same', old: i++, new: j++ });
    } else if (j < m && (i >= n || lcs[at(i, j + 1)]! >= lcs[at(i + 1, j)]!)) {
      steps.push({ kind: 'new', new: j++ });
    } else {
      steps.push({ kind: 'gone', old: i++ });
    }
  }
  return steps;
}
