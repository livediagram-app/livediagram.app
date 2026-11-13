// What stops a form being published (docs/specs/030-forms/forms.md "Publishing and the form link"): the problems Share
// Form lists before Publish Form, and the api refuses (409 form_not_ready). Pure, so both agree. Responses that have
// nowhere to go are destinationProblem's, checked beside these.
import { requiredCustomFieldsOf, type ItemTypeDef } from '@liveplanner/items';
import { ruleQuestion } from './branching';
import { brokenFixed, fixedCardFields, fixedFieldsOf } from './fixed';
import { effectiveTarget, type ResolvedTarget } from './mapping';
import { questionsOf, type FormDefinition, type FormQuestion } from './model';
import {
  ruleTarget,
  TYPE_RULE_PROBLEM_TEXT,
  typeRuleProblem,
  type RulePlace,
  type TypeRuleProblem,
} from './type-rules';

export type PublishProblem =
  | { kind: 'no_questions' }
  | { kind: 'unworded'; questionId: string }
  | { kind: 'no_options'; questionId: string }
  // `ruleId`: on a card type rule's type (type-rules.ts), not the default's.
  | { kind: 'broken_mapping'; questionId: string; ruleId?: string }
  // A card type rule that no longer holds (forms.md "Choosing the card type by an answer"): skipped, so responses
  // take the default type. `questionId` while its question is still on the form, for the mark on its card.
  | { kind: 'broken_type_rule'; ruleId: string; reason: TypeRuleProblem; questionId?: string }
  | { kind: 'broken_rule'; sectionId: string }
  // A required field of the card type that no required question in an always-shown section goes to
  // (docs/specs/026-plan/item-types.md "Required fields"): `field` and `type` are their names, for the words.
  | { kind: 'required_unasked'; fieldId: string; field: string; type: string }
  // A field set automatically to a value that no longer resolves (docs/specs/030-forms/forms.md "Filled in
  // automatically"): its field gone or changed, or its option removed. `field` its name, the id when it is gone.
  | { kind: 'broken_fixed'; fieldId: string; field: string };

export const PUBLISH_PROBLEM_TEXT: Readonly<Record<PublishProblem['kind'], string>> = {
  no_questions: 'Add a question: a form needs at least one.',
  unworded: 'A question has no wording yet.',
  no_options: 'A choice question has no options.',
  broken_mapping: 'An answer goes to a card field that was removed or no longer fits.',
  broken_rule: 'A section shows only on an answer that is no longer there.',
  broken_type_rule: 'A card type rule no longer holds: responses use the default card type.',
  required_unasked: 'A field the card type requires has no required question going to it.',
  broken_fixed: 'A field set automatically has a value its field no longer has.',
};

// A problem's words, naming the field and type where it has them.
export function publishProblemText(p: PublishProblem): string {
  if (p.kind === 'required_unasked')
    return `${p.field} is required on ${p.type} cards: add a required question that goes to it.`;
  if (p.kind === 'broken_type_rule') return TYPE_RULE_PROBLEM_TEXT[p.reason];
  if (p.kind === 'broken_mapping' && p.ruleId)
    return 'An answer goes to a field a card type rule’s type no longer has, or that no longer fits.';
  if (p.kind === 'broken_fixed')
    return `${p.field} is set automatically to a value its field no longer has: change or remove it.`;
  return PUBLISH_PROBLEM_TEXT[p.kind];
}

// Every problem, in form order (the form-level one first). With `place` (the card types and the destination tab's
// boards), a board destination's card type rules are checked too: each broken rule, its broken mappings and the
// required fields of its type that no question fills.
export function publishProblems(
  form: Pick<FormDefinition, 'sections'> & Partial<Pick<FormDefinition, 'destination'>>,
  type: ItemTypeDef | undefined,
  place?: RulePlace,
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
  if (!type) return out;
  const fixed = form.destination?.fixed;
  out.push(...requiredUnasked(form, type, (q) => effectiveTarget(q, type)));
  const names = new Map(fixedFieldsOf(type).map((f) => [f.id, f.label]));
  for (const id of brokenFixed(fixed, type))
    out.push({ kind: 'broken_fixed', fieldId: id, field: names.get(id) ?? 'A field' });
  // Card type rules: only with the board to judge them by, and never on a sheet form (no `type` then).
  for (const rule of (place && form.destination?.typeRules) || []) {
    const reason = typeRuleProblem(rule, form, place!);
    if (reason) {
      const asked = questions.some((q) => q.id === rule.questionId);
      out.push({
        kind: 'broken_type_rule',
        ruleId: rule.id,
        reason,
        ...(asked ? { questionId: rule.questionId } : {}),
      });
      continue;
    }
    const ruleType = place!.types.find((t) => t.id === rule.typeId)!;
    for (const q of questions)
      if (rule.fields?.[q.id] && ruleTarget(q, rule, ruleType).broken)
        out.push({ kind: 'broken_mapping', questionId: q.id, ruleId: rule.id });
    out.push(...requiredUnasked(form, ruleType, (q) => ruleTarget(q, rule, ruleType)));
  }
  return out;
}

// Every response must fill each required field of `type`: a required question going to it (by `target`), in a section
// every response sees (the first, or one with no rule), or a value set automatically that still resolves.
function requiredUnasked(
  form: Pick<FormDefinition, 'sections'> & Partial<Pick<FormDefinition, 'destination'>>,
  type: ItemTypeDef,
  target: (q: FormQuestion) => ResolvedTarget,
): PublishProblem[] {
  const asked = new Set<string>(Object.keys(fixedCardFields(form.destination?.fixed, type, 0)));
  form.sections.forEach((s, i) => {
    if (i > 0 && s.showIf) return;
    for (const q of s.questions) {
      const t = q.required ? target(q) : null;
      if (t?.to === 'field' && t.field) asked.add(t.field.id);
    }
  });
  return requiredCustomFieldsOf(type)
    .filter((f) => !asked.has(f.id))
    .map((f) => ({ kind: 'required_unasked', fieldId: f.id, field: f.label, type: type.label }));
}
