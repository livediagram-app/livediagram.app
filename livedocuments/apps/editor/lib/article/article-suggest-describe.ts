// What a suggestion's card says (docs/specs/007-editor/suggestions.md "Reviewing"): how long ago it was made, and
// what it does ("Add "a quick test"", "Delete "slowly"", "Format: Bold", "Add a paragraph break"). Pure.
import type { Node as PMNode } from 'prosemirror-model';
import type { ArticleRunFormat } from '@livedocuments/document';

const QUOTE_MAX = 60;

const FORMAT_NAMES: readonly [keyof ArticleRunFormat, string][] = [
  ['b', 'Bold'],
  ['i', 'Italic'],
  ['u', 'Underline'],
  ['s', 'Strikethrough'],
  ['code', 'Inline Code'],
  ['sup', 'Superscript'],
  ['sub', 'Subscript'],
  ['href', 'Link'],
  ['color', 'Text Colour'],
  ['hl', 'Highlight'],
];

/** The formats that differ between `was` and `now`, by name, in a fixed order. */
export function formatChangeNames(was: ArticleRunFormat, now: ArticleRunFormat): string[] {
  return FORMAT_NAMES.filter(([k]) => (was[k] ?? null) !== (now[k] ?? null)).map(([, n]) => n);
}

const quote = (text: string) => {
  const t = text.replace(/\s+/g, ' ').trim();
  return `“${t.length > QUOTE_MAX ? `${t.slice(0, QUOTE_MAX - 1)}…` : t}”`;
};

export type SuggestionSummary =
  | { k: 'ins' | 'del'; text: string; isBreak: false }
  | { k: 'fmt'; was: ArticleRunFormat; now: ArticleRunFormat; isBreak: false }
  | { k: 'ins' | 'del'; isBreak: true };

/** What a suggestion does, as its card says it. */
export function describeSuggestion(s: SuggestionSummary): string {
  if (s.isBreak) return s.k === 'ins' ? 'Add a paragraph break' : 'Remove a paragraph break';
  if (s.k === 'fmt') {
    const names = formatChangeNames(s.was, s.now);
    return names.length > 0 ? `Format: ${names.join(', ')}` : 'Format';
  }
  return `${s.k === 'ins' ? 'Add' : 'Delete'} ${quote(s.text)}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** How long ago a suggestion was made: "just now", "4 min ago", "3 h ago", then the date. */
export function suggestionAgo(at: number, now: number, locale?: string): string {
  const d = Math.max(0, now - at);
  if (d < MINUTE) return 'just now';
  if (d < HOUR) return `${Math.floor(d / MINUTE)} min ago`;
  if (d < 24 * HOUR) return `${Math.floor(d / HOUR)} h ago`;
  return new Date(at).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/** Whether the writing holds a suggestion anywhere: a break, or a run's mark. Stops at the first. */
export function docHasSuggestions(doc: PMNode): boolean {
  let found = false;
  doc.descendants((node) => {
    if (found) return false;
    if (node.attrs.sg || node.marks.some((m) => m.type.name === 'suggestion')) found = true;
    return !found;
  });
  return found;
}
