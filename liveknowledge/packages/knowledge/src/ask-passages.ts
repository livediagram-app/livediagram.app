// The passages a question is answered from (docs/specs/030-knowledgebase/search-and-ask.md "Answering"): the
// search index's best matches, verified pages first, at most ASK_MAX_PASSAGES and ASK_MAX_PASSAGE_CHARS, numbered
// as the answer cites them.
import { ASK_MAX_PASSAGES, ASK_MAX_PASSAGE_CHARS } from './ask-limits';
import { contentWords } from './questions';
import { searchByTerms, type FoundPassage, type SearchOptions } from './sql/search';
import type { SqlStatement } from './sql/statement';
import type { PageHealthLabel } from './page-health';

/** A passage shorter than this is not worth sending cut. */
const MIN_CUT_PASSAGE_CHARS = 200;

/** A passage as Ask sends it: `number` is what the answer cites it by, 1 first. */
export type AskPassage = {
  number: number;
  passage: FoundPassage;
  /** The page's Health Score and word (verification.md "Health Score"), where the api scored it. */
  health?: { score: number; label: PageHealthLabel };
};

/** The search for a question's passages: any of its words that carry meaning, passages only. Undefined when the
 *  question has no words. */
export const askSearch = (
  question: string,
  options: Pick<SearchOptions, 'now' | 'reviewEvery' | 'exceptTab'>,
): SqlStatement | undefined =>
  searchByTerms(contentWords(question), {
    ...options,
    mode: 'any',
    passagesOnly: true,
    limit: ASK_MAX_PASSAGES,
  });

/** The passages to send, numbered: those of verified pages first, then by rank, title rows left out. The last one
 *  is cut to what is left of the characters, or dropped when little is. */
export function chooseAskPassages(found: readonly FoundPassage[]): AskPassage[] {
  const ranked = found
    .filter((p) => !p.isTitle && p.text)
    .map((passage, at) => ({ passage, at }))
    .sort(
      (a, b) =>
        Number(b.passage.trust === 'verified') - Number(a.passage.trust === 'verified') ||
        a.passage.rank - b.passage.rank ||
        a.at - b.at,
    );
  const chosen: AskPassage[] = [];
  let left = ASK_MAX_PASSAGE_CHARS;
  for (const { passage } of ranked) {
    if (chosen.length === ASK_MAX_PASSAGES) break;
    if (passage.text.length > left) {
      if (left >= MIN_CUT_PASSAGE_CHARS) {
        chosen.push({
          number: chosen.length + 1,
          passage: { ...passage, text: passage.text.slice(0, left) },
        });
      }
      break;
    }
    chosen.push({ number: chosen.length + 1, passage });
    left -= passage.text.length;
  }
  return chosen;
}
