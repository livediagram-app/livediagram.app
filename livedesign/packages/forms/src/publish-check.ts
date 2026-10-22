// What stops a form being published (docs/specs/030-forms/forms.md "Publishing and the form link"): the problems Share
// Form lists before Publish Form, and the api refuses (409 form_not_ready). Pure, so both agree. Responses that have
// nowhere to go are destinationProblem's, checked beside these.
import type { ItemTypeDef } from '@livedesign/items';
import { ruleQuestion } from './branching';
import { effectiveTarget } from './mapping';
import { questionsOf, type FormDefinition } from './model';

export type PublishProblem =
  | { kind: 'no_questions' }
  | { kind: 'unworded'; questionId: string }
  | { kind: 'no_options'; questionId: string }
  | { kind: 'broken_mapping'; questionId: string }
  | { kind: 'broken_rule'; sectionId: string };

export const PUBLISH_PROBLEM_TEXT: Readonly<Record<PublishProblem['kind'], string>> = {
  no_questions: 'Add a question: a form needs at least one.',
  unworded: 'A question has no wording yet.',
  no_options: 'A choice question has no options.',
  broken_mapping: 'An answer goes to a card field that was removed or no longer fits.',
  broken_rule: 'A section shows only on an answer that is no longer there.',
};

// Every problem, in form order (the form-level one first).
export function publishProblems(
  form: Pick<FormDefinition, 'sections'>,
  type: ItemTypeDef | undefined,
): PublishProblem[] {
  const out: PublishProblem[] = [];
  const questions = questionsOf(form);
  if (questions.length === 0) out.push({ kind: 'no_questions' });
  form.sections.forEach((s, i) => {
    if (i > 0 && s.showIf && !ruleQuestion(form, i, s.showIf))
      out.push({ kind: 'broken_rule', sectionId: s.id });
    for (const q of s.questions) {
      if (!q.prompt.trim()) out.push({ kind: 'unworded', questionId: q.id });
      if ((q.type === 'single' || q.type === 'multi') && !q.options?.length)
        out.push({ kind: 'no_options', questionId: q.id });
      if (q.goesTo && type && effectiveTarget(q, type).broken)
        out.push({ kind: 'broken_mapping', questionId: q.id });
    }
  });
  return out;
}
