// An answer as the page draws it (docs/specs/030-knowledgebase/search-and-ask.md "What an answer shows"). The model's
// answer is other people's text and the model's: it is drawn as text, never as HTML. The only marks are the page's
// own: a citation marker (`[2]`, `[1, 3]`) that names a passage the answer came with becomes a chip, and a matched
// word in a passage is softly marked. Everything else stays the characters it was. Pure and linear in the text.
import type { AskSource } from '@liveknowledge/api-schema';

export type AnswerPart = { kind: 'text'; text: string } | { kind: 'cite'; number: number };

const MARKER = /\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]/g;

/** The answer cut into text and citation chips. A marker naming a number that is not among `cited` stays text. */
export function answerParts(text: string, cited: ReadonlySet<number>): AnswerPart[] {
  const parts: AnswerPart[] = [];
  let from = 0;
  const say = (piece: string) => {
    if (!piece) return;
    const last = parts[parts.length - 1];
    if (last?.kind === 'text') last.text += piece;
    else parts.push({ kind: 'text', text: piece });
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

// Words too common to say anything about a match.
const COMMON = new Set(
  'the and for are but not you all any can her was one our out day get has him his how its may new now old see two way who did why what when where which with from that this they them then than have will your into does about there their would could should'.split(
    ' ',
  ),
);
const MAX_MARK_WORDS = 12;

/** The question's content words: letters or digits, three or more, not common, each once, twelve at most. */
export function contentWords(question: string): string[] {
  const words = question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  return [...new Set(words.filter((word) => !COMMON.has(word)))].slice(0, MAX_MARK_WORDS);
}

/** A passage cut where a word of the question begins a word of it, so the page can mark the matched parts. */
export function markedParts(text: string, question: string): MarkedPart[] {
  const words = contentWords(question);
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

/** An answer as Markdown, for Copy Answer and Save as Page: the answer as written, then the pages it cites. */
export function answerMarkdown(
  answer: string,
  sources: readonly Pick<AskSource, 'number' | 'title'>[],
  linkOf?: (source: Pick<AskSource, 'number' | 'title'>) => string | undefined,
): string {
  const body = answer.trim();
  if (sources.length === 0) return body;
  const lines = sources.map((source) => {
    const title = source.title.replace(/([\\[\]])/g, '\\$1');
    const href = linkOf?.(source);
    return `${source.number}. ${href ? `[${title}](${href})` : title}`;
  });
  return `${body}\n\n## Sources\n\n${lines.join('\n')}`;
}
