// A response's answers as an automation's values (docs/specs/030-forms/forms.md "Automations", docs/specs/026-plan/
// automations.md "Values"): each question's answer as text, by its question's words, for a Form Response rule's
// `{{answer.<Question>}}`. Content blocks ask nothing and give none; an empty answer reads as nothing. Each text is cut
// to ANSWER_VALUE_MAX, so the queued event a rule's run reads stays small.
import type { AnswerValue } from './answers';
import { answerText } from './card';
import { promptOf, questionsOf, type FormDefinition } from './model';

export const ANSWER_VALUE_MAX = 1_000;

export function answerValues(
  form: Pick<FormDefinition, 'sections'>,
  answers: ReadonlyMap<string, AnswerValue> | Readonly<Record<string, AnswerValue>>,
): Record<string, string> {
  const get = (id: string): AnswerValue | undefined =>
    answers instanceof Map
      ? (answers as ReadonlyMap<string, AnswerValue>).get(id)
      : (answers as Readonly<Record<string, AnswerValue>>)[id];
  const out: Record<string, string> = {};
  for (const q of questionsOf(form)) {
    const name = promptOf(q);
    // The first of two questions worded alike keeps the name.
    if (Object.hasOwn(out, name)) continue;
    const value = get(q.id);
    out[name] = value === undefined ? '' : answerText(q, value).slice(0, ANSWER_VALUE_MAX);
  }
  return out;
}
