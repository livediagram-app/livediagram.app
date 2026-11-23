// An answer as the page draws it (docs/specs/030-knowledgebase/search-and-ask.md "What an answer shows"): the chips,
// the marks and the words are the platform's (@liveworkspace/ask), shared with every other app's Ask AI. The model's
// answer is other people's text and the model's: it is drawn as text, never as HTML. The only marks are the page's
// own: a citation marker (`[2]`, `[1, 3]`) that names a passage the answer came with becomes a chip, and a matched
// word in a passage is softly marked. Everything else stays the characters it was. Pure and linear in the text.
import type { AskSource } from '@liveknowledge/api-schema';

export {
  answerParts,
  answerWithoutMarkers,
  markedParts,
  type AnswerPart,
  type MarkedPart,
} from '@liveworkspace/ask';
import { MAX_MARK_WORDS, contentWords as sharedContentWords } from '@liveworkspace/ask';

/** The question's content words: letters or digits, three or more, not common, each once, twelve at most. */
export const contentWords = (question: string): string[] =>
  sharedContentWords(question, MAX_MARK_WORDS);

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
