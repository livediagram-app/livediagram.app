// How long a form has left (docs/specs/030-forms/forms.md "How long it takes"): each question still unanswered counts
// what a person typically takes to answer its type, and each content block its reading time. The form page shows it
// on the heading (the whole form left) and on each later section (that section left), updating as answers go in.
import { isEmptyAnswer } from './answers';
import type { QuestionType } from './model';
import type { PublicForm, PublicQuestion } from './public';

// Seconds to answer a question of each type: a quick pick a few, typing more, a paragraph a minute.
export const ANSWER_SECONDS: Readonly<Record<Exclude<QuestionType, 'content'>, number>> = {
  short: 20,
  paragraph: 60,
  number: 10,
  email: 15,
  phone: 15,
  link: 20,
  date: 10,
  datetime: 15,
  daterange: 15,
  single: 8,
  multi: 12,
  rating: 6,
  checkbox: 4,
  duration: 12,
  colour: 6,
};

// Reading speed for a content block's words (about 200 a minute), and the least a block counts.
const WORDS_PER_SECOND = 200 / 60;
const BLOCK_SECONDS_MIN = 3;

const words = (text: string | undefined) => (text ? text.split(/\s+/).filter(Boolean).length : 0);

// Seconds `q` still asks for: none once answered (a content block is read once, so it counts until passed).
export function partSeconds(q: PublicQuestion, answer: unknown): number {
  if (q.type === 'content') {
    const n = words(q.prompt) + words(q.help);
    return Math.max(BLOCK_SECONDS_MIN, Math.round(n / WORDS_PER_SECOND));
  }
  return isEmptyAnswer(answer) ? ANSWER_SECONDS[q.type] : 0;
}

/** Seconds left in each of the shown sections `order` (indexes into form.sections), and in all of them. Sections
 *  before `from` are passed: their blocks no longer count. */
export function secondsLeft(
  form: Pick<PublicForm, 'sections'>,
  answers: Readonly<Record<string, unknown>>,
  order: readonly number[],
  from = 0,
): { total: number; bySection: Map<number, number> } {
  const bySection = new Map<number, number>();
  let total = 0;
  for (const i of order) {
    const section = form.sections[i];
    if (!section) continue;
    const s = section.questions.reduce((sum, q) => sum + partSeconds(q, answers[q.id]), 0);
    bySection.set(i, s);
    if (i >= from) total += s;
  }
  return { total, bySection };
}

/** The words for `seconds` left: "Under a minute left", "About 3 min left"; null once nothing is. */
export function timeLeftText(seconds: number): string | null {
  if (seconds <= 0) return null;
  if (seconds < 45) return 'Under a minute left';
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `About ${minutes} min left`;
}
