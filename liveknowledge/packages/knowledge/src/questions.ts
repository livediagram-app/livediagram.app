// Like questions, grouped (docs/specs/030-knowledgebase/insights.md "Questions nobody could answer"): two
// questions are the same when they hold the same words after lowercasing, dropping punctuation and stop words and
// stemming. No dependency: a small stop list and a light English stemmer, since the key only has to bring
// "How do we deploy?" and "how are deploys done" together, not parse a language.
import type { Reader } from './sql/reads';

const STOP_WORDS = new Set(
  (
    'a an and are as at be by can could did do does done for from had has have how i if in is it its me my of on or ' +
    'our should so than that the their them then there these they this to us was we were what when where which ' +
    'who whom whose why will with would you your'
  ).split(' '),
);

/** Whether a word carries no meaning of its own in a question or a search. */
export const isStopWord = (word: string): boolean => STOP_WORDS.has(word);

/** A word's stem: plurals, -ing, -ed and a final -e taken off, a doubled last letter made single. Light on
 *  purpose; it only has to make like words alike. */
export function stemWord(word: string): string {
  let stem = word;
  if (stem.length > 4 && stem.endsWith('ies')) stem = `${stem.slice(0, -3)}y`;
  else if (stem.length > 5 && stem.endsWith('ing')) stem = stem.slice(0, -3);
  else if (stem.length > 4 && stem.endsWith('ed')) stem = stem.slice(0, -2);
  else if (stem.length > 4 && /(?:s|x|z|ch|sh)es$/.test(stem)) stem = stem.slice(0, -2);
  else if (stem.length > 3 && stem.endsWith('s') && !stem.endsWith('ss')) stem = stem.slice(0, -1);
  if (stem.length > 4 && stem.endsWith('e')) stem = stem.slice(0, -1);
  const last = stem.length - 1;
  if (stem.length > 3 && stem[last] === stem[last - 1] && !/[aeiouls]/.test(stem[last]!)) {
    stem = stem.slice(0, last);
  }
  return stem;
}

/** The words of a text, lowercased, punctuation dropped. */
export const wordsOf = (text: string): string[] =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) ?? [];

/** A question's words that carry meaning, in order: stop words dropped. A question of stop words alone ("Why?")
 *  keeps them, so it still has words. */
export function contentWords(question: string): string[] {
  const words = wordsOf(question);
  const content = words.filter((w) => !isStopWord(w));
  return content.length ? content : words;
}

/** The key like questions share: their stems, each once, in alphabetical order. '' for a question with no words,
 *  which is not logged. */
export function questionKey(question: string): string {
  return [...new Set(contentWords(question).map(stemWord))].sort().join(' ');
}

export type QuestionGroup = {
  key: string;
  /** The words of the first asker. */
  question: string;
  /** How many times it was asked. */
  asked: number;
  /** How many of those were by people. */
  people: number;
  /** How many times each agent asked it, by the agent's name. */
  agents: Record<string, number>;
};

/** Questions in groups of like ones, in the order each group was first asked. What the room's `questions` table
 *  holds, worked out in memory: for an Offline knowledgebase and for tests of the grouping. */
export function groupQuestions(
  asks: readonly { question: string; asker: Reader }[],
): QuestionGroup[] {
  const groups = new Map<string, QuestionGroup>();
  for (const { question, asker } of asks) {
    const key = questionKey(question);
    if (!key) continue;
    let group = groups.get(key);
    if (!group) {
      group = { key, question: question.trim(), asked: 0, people: 0, agents: {} };
      groups.set(key, group);
    }
    group.asked++;
    if (asker.kind === 'person') group.people++;
    else group.agents[asker.name] = (group.agents[asker.name] ?? 0) + 1;
  }
  return [...groups.values()];
}
