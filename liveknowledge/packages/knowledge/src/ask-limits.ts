// The bounds of Ask (docs/specs/030-knowledgebase/search-and-ask.md "Ask"), and the check the room makes before a
// question reaches the model. The counts themselves live in the room (sql/counters.ts).

export const ASK_PER_PERSON_PER_HOUR = 20;
export const ASK_PER_KNOWLEDGEBASE_PER_DAY = 200;
export const ASK_MAX_QUESTION_CHARS = 1000;
export const ASK_MAX_PASSAGES = 12;
/** The most characters of passages one question sends. */
export const ASK_MAX_PASSAGE_CHARS = 24_000;
/** A conversation keeps this many turns, the question being asked among them. */
export const ASK_MAX_TURNS = 10;

export type AskRefusal =
  'no-question' | 'question-too-long' | 'person-limit' | 'knowledgebase-limit';

/** Why a question is not sent, or undefined when it may be. `personThisHour` and `knowledgebaseToday` are the
 *  questions already counted in the person's hour and the knowledgebase's day. */
export function askRefusal(
  question: string,
  used: { personThisHour: number; knowledgebaseToday: number },
): AskRefusal | undefined {
  const asked = question.trim();
  if (!asked) return 'no-question';
  if (asked.length > ASK_MAX_QUESTION_CHARS) return 'question-too-long';
  if (used.personThisHour >= ASK_PER_PERSON_PER_HOUR) return 'person-limit';
  if (used.knowledgebaseToday >= ASK_PER_KNOWLEDGEBASE_PER_DAY) return 'knowledgebase-limit';
  return undefined;
}
