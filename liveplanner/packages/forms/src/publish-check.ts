// What stops a form being published (docs/specs/030-forms/forms.md "Publishing and the form link"): the problems Share
// Form lists before Publish Form, and the api refuses (409 form_not_ready). Pure, so both agree. Responses that have
// nowhere to go are destinationProblem's, checked beside these.
import { requiredCustomFieldsOf, type ItemTypeDef } from '@liveplanner/items';
import { ruleQuestion } from './branching';
import { effectiveTarget } from './mapping';
import { questionsOf, type FormDefinition } from './model';

export type PublishProblem =
  | { kind: 'no_questions' }
  | { kind: 'unworded'; questionId: string }
  | { kind: 'no_options'; questionId: string }
  | { kind: 'broken_mapping'; questionId: string }
  | { kind: 'broken_rule'; sectionId: string }
  // A required field of the card type that no required question in an always-shown section goes to
  // (docs/specs/026-plan/item-types.md "Required fields"): `field` and `type` are their names, for the words.
  | { kind: 'required_unasked'; fieldId: string; field: string; type: string };

export const PUBLISH_PROBLEM_TEXT: Readonly<Record<PublishProblem['kind'], string>> = {
  no_questions: 'Add a question: a form needs at least one.',
  unworded: 'A question has no wording yet.',
  no_options: 'A choice question has no options.',
  broken_mapping: 'An answer goes to a card field that was removed or no longer fits.',
  broken_rule: 'A section shows only on an answer that is no longer there.',
  required_unasked: 'A field the card type requires has no required question going to it.',
};

// A problem's words, naming the field and type where it has them.
export function publishProblemText(p: PublishProblem): string {
  return p.kind === 'required_unasked'
    ? `${p.field} is required on ${p.type} cards: add a required question that goes to it.`
    : PUBLISH_PROBLEM_TEXT[p.kind];
}

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
  // Every response must fill each required field: a required question going to it, in a section every response
  // sees (the first, or one with no rule).
  if (type) {
    const asked = new Set<string>();
    form.sections.forEach((s, i) => {
      if (i > 0 && s.showIf) return;
      for (const q of s.questions) {
        const target = q.required ? effectiveTarget(q, type) : null;
        if (target?.to === 'field' && target.field) asked.add(target.field.id);
      }
    });
    for (const f of requiredCustomFieldsOf(type))
      if (!asked.has(f.id))
        out.push({ kind: 'required_unasked', fieldId: f.id, field: f.label, type: type.label });
  }
  return out;
}
