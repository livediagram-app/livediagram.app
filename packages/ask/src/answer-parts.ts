// An answer as a page draws it (liveworkspace/docs/specs/019-ask/ask.md "What an answer shows"). The model's answer is
// other people's text and the model's: it is drawn as text, never as HTML. The only marks are the page's own: a
// citation marker (`[2]`, `[1, 3]`) that names a passage the answer came with becomes a chip, and a matched word in a
// passage is softly marked. Everything else stays the characters it was. Pure and linear in the text. Shared by
// liveknowledge's Ask and every other app's Ask AI.
import { contentWords } from './passages';

export type AnswerPart = { kind: 'text'; text: string } | { kind: 'cite'; number: number };

const MARKER = /\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]/g;

/** The answer cut into text and citation chips. A marker naming a number that is not among `cited` stays text. */
export function answerParts(text: string, cited: ReadonlySet<number>): AnswerPart[] {
  const parts: AnswerPart[] = [];
  let from = 0;
  // Text between two markers, or after the last: a chip always sits between two pieces.
  const say = (piece: string) => {
    if (piece) parts.push({ kind: 'text', text: piece });
  };
  for (const match of text.matchAll(MARKER)) {
    const numbers = match[1]!.split(',').map((n) => Number(n.trim()));
    if (!numbers.every((n) => cited.has(n))) continue;
    // The space before a chip is the chip's own gap.
    say(text.slice(from, match.index).replace(/[ \t]+$/, ''));
    for (const number of numbers) parts.push({ kind: 'cite', number });
    from = match.index + match[0].length;
  }
  say(text.slice(from));
  return parts;
}

/** The answer with its markers taken out, for a page or a turn that carries no passages. */
export function answerWithoutMarkers(text: string): string {
  return text
    .replace(MARKER, '')
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ');
}

export type MarkedPart = { text: string; marked: boolean };

/** A passage is marked by at most this many of the question's words. */
export const MAX_MARK_WORDS = 12;

/** A passage cut where a word of the question begins a word of it, so the page can mark the matched parts. */
export function markedParts(text: string, question: string): MarkedPart[] {
  const words = contentWords(question, MAX_MARK_WORDS);
  if (words.length === 0) return text ? [{ text, marked: false }] : [];
  const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const finder = new RegExp(`(?<![\\p{L}\\p{N}])(?:${escaped.join('|')})[\\p{L}\\p{N}]*`, 'giu');
  const parts: MarkedPart[] = [];
  let from = 0;
  for (const match of text.matchAll(finder)) {
    if (match.index > from) parts.push({ text: text.slice(from, match.index), marked: false });
    parts.push({ text: match[0], marked: true });
    from = match.index + match[0].length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), marked: false });
  return parts;
}
