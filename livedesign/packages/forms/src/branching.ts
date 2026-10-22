// Showing a section only sometimes (docs/specs/030-forms/forms.md "Showing a section only sometimes"): which sections
// a respondent's answers show, which questions a rule may use, and whether a rule still holds together. Pure: the
// builder, the respondent's page and the api's check all ask here, so they agree.
import type { FormDefinition, FormQuestion, FormSection, SectionRule } from './model';

// What a Checkbox question's answer reads as in a rule.
export const CHECKBOX_TICKED = 'Ticked';
export const CHECKBOX_UNTICKED = 'Not Ticked';

const RULE_TYPES: ReadonlySet<FormQuestion['type']> = new Set(['single', 'multi', 'checkbox']);

// The answers a question offers a rule: a choice's options, a Checkbox's two states.
export function ruleChoices(q: FormQuestion): string[] {
  if (q.type === 'checkbox') return [CHECKBOX_TICKED, CHECKBOX_UNTICKED];
  return [...(q.options ?? [])];
}

// The questions a rule on the section at `index` may use: every Single Choice, Multiple Choice or Checkbox question of
// an earlier section, in form order.
export function ruleQuestions(
  form: Pick<FormDefinition, 'sections'>,
  index: number,
): FormQuestion[] {
  return form.sections
    .slice(0, Math.max(0, index))
    .flatMap((s) => s.questions)
    .filter((q) => RULE_TYPES.has(q.type) && ruleChoices(q).length > 0);
}

// The rule's question, while it is still an earlier question a rule may use and one of its answers is still offered;
// null for a broken rule (the section then shows).
export function ruleQuestion(
  form: Pick<FormDefinition, 'sections'>,
  index: number,
  rule: SectionRule,
): FormQuestion | null {
  const q = ruleQuestions(form, index).find((x) => x.id === rule.questionId);
  if (!q) return null;
  const offered = ruleChoices(q);
  return rule.anyOf.some((a) => offered.includes(a)) ? q : null;
}

// Whether a rule's question has the answers it asks for. `answer` is the raw answer (a respondent's, unchecked).
function holds(q: FormQuestion, rule: SectionRule, answer: unknown): boolean {
  if (q.type === 'checkbox')
    return rule.anyOf.includes(answer === true ? CHECKBOX_TICKED : CHECKBOX_UNTICKED);
  if (Array.isArray(answer)) return answer.some((a) => rule.anyOf.includes(a as string));
  return typeof answer === 'string' && rule.anyOf.includes(answer);
}

// Which sections show for these answers, in order. The first always does; a later one shows when it has no rule, its
// rule is broken, or its rule holds. A rule reads only answers of sections that show, so a hidden section's answers
// never decide another's.
export function sectionsShown(
  form: Pick<FormDefinition, 'sections'>,
  answers: Readonly<Record<string, unknown>>,
): boolean[] {
  const shown: boolean[] = [];
  const visible = new Set<string>();
  form.sections.forEach((s, i) => {
    const q = i > 0 && s.showIf ? ruleQuestion(form, i, s.showIf) : null;
    const on = !q || (visible.has(q.id) && holds(q, s.showIf!, answers[q.id]));
    shown.push(on);
    if (on) for (const x of s.questions) visible.add(x.id);
  });
  return shown;
}

// The questions of the sections that show.
export function shownQuestions(
  form: Pick<FormDefinition, 'sections'>,
  answers: Readonly<Record<string, unknown>>,
): FormQuestion[] {
  const shown = sectionsShown(form, answers);
  return form.sections.flatMap((s: FormSection, i) => (shown[i] ? s.questions : []));
}
