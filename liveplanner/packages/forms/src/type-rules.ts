// Choosing the card type by an answer (docs/specs/030-forms/forms.md "Choosing the card type by an answer", blueprint
// §6d): which rules a board destination offers, whether each still holds, which one a response's answers pick, and
// where an answer goes on that rule's card type. Pure: the builder, its preview, the agents and the api's response
// write all ask here, so they agree.
import {
  boardsTaking,
  targetColumns,
  type ItemTypeDef,
  type TargetBoard,
} from '@liveplanner/items';
import type { AnswerValue } from './answers';
import { ruleChoices, ruleHolds, ruleQuestions, shownQuestions } from './branching';
import { columnForType, typeColumns } from './destination';
import { TYPE_RULES_MAX } from './limits';
import { effectiveTarget, fieldTakes, type ResolvedTarget } from './mapping';
import type { CardTypeRule, FormDefinition, FormDestination, FormQuestion } from './model';

// A board as the rules read it: the types it takes, whether it is an Archive, its columns.
export type RuleBoard = TargetBoard;

// What a rule is checked against: the project's card types and every board of the plan.
export interface RulePlace {
  types: readonly ItemTypeDef[];
  boards: readonly RuleBoard[];
}

export type TypeRuleProblem =
  'question_missing' | 'answer_missing' | 'type_missing' | 'type_not_on_board' | 'status_missing';

export const TYPE_RULE_PROBLEM_TEXT: Readonly<Record<TypeRuleProblem, string>> = {
  question_missing:
    'A card type rule’s question was removed or changed: responses use the default card type.',
  answer_missing:
    'A card type rule’s answers are no longer offered: responses use the default card type.',
  type_missing: 'A card type rule’s card type was removed: responses use the default card type.',
  type_not_on_board:
    'No board shows a card type rule’s cards in its column: responses use the default card type.',
  status_missing: 'A card type rule’s column was removed: responses use the default card type.',
};

// The questions a card type rule may read: every Single Choice, Multiple Choice and Checkbox question with answers,
// in any section, in form order.
export const typeRuleQuestions = (form: Pick<FormDefinition, 'sections'>): FormQuestion[] =>
  ruleQuestions(form, form.sections.length);

// Whether Choose the Card Type by an Answer is offered: the plan's boards show more than one type and the form has a
// question a rule may read (forms.md: progressive disclosure).
export function typeRulesOffered(
  form: Pick<FormDefinition, 'sections'>,
  takes: readonly { id: string }[],
): boolean {
  return takes.length > 1 && typeRuleQuestions(form).length > 0;
}

// Why a rule no longer holds, or null. A broken rule is skipped: the default type takes the response.
export function typeRuleProblem(
  rule: CardTypeRule,
  form: Pick<FormDefinition, 'sections'> & { destination?: FormDestination | undefined },
  place: RulePlace,
): TypeRuleProblem | null {
  const q = typeRuleQuestions(form).find((x) => x.id === rule.questionId);
  if (!q) return 'question_missing';
  const offered = ruleChoices(q);
  if (!rule.anyOf.some((a) => offered.includes(a))) return 'answer_missing';
  if (!place.types.some((t) => t.id === rule.typeId)) return 'type_missing';
  const taking = boardsTaking(place.boards, place.types, rule.typeId);
  if (taking.length === 0) return 'type_not_on_board';
  if (!taking.some((b) => b.columns.some((c) => c.status === rule.status))) return 'status_missing';
  return null;
}

// Where `q`'s answer goes on a card of the rule's `type`: Title when it goes to Title (the form's, whatever the type),
// else the rule's field for it while that resolves (else Description, marked broken), else Description.
export function ruleTarget(
  q: FormQuestion,
  rule: Pick<CardTypeRule, 'fields'>,
  type: ItemTypeDef | undefined,
): ResolvedTarget {
  if (q.goesTo?.to === 'title') return effectiveTarget(q, type);
  const fieldId = rule.fields?.[q.id];
  if (!fieldId) return { to: 'description' };
  return effectiveTarget({ ...q, goesTo: { to: 'field', fieldId } }, type);
}

// The fields of a rule's `type` that `q` could go to, each with the question already using it on that type.
export function ruleFieldChoices(
  rule: Pick<CardTypeRule, 'fields'>,
  q: FormQuestion,
  type: ItemTypeDef,
): { field: NonNullable<ResolvedTarget['field']>; takenBy?: string }[] {
  const fields = rule.fields ?? {};
  return (type.custom ?? [])
    .filter((f) => type.fields.includes(f.id) && fieldTakes(q, f))
    .map((field) => {
      const takenBy = Object.keys(fields).find((id) => id !== q.id && fields[id] === field.id);
      return takenBy ? { field, takenBy } : { field };
    });
}

// The card type a response makes: the first rule, in order, that holds and whose question shows and has one of its
// answers, in its column (as its type uses the board's columns); else the destination's own type and status. Null
// when the default type is gone (the destination's problem speaks). Read on the api from the stored form and the
// checked answers alone.
export function chooseCardType(
  form: Pick<FormDefinition, 'sections'> & { destination?: FormDestination | undefined },
  answers: ReadonlyMap<string, AnswerValue> | Readonly<Record<string, unknown>>,
  place: RulePlace,
): { type: ItemTypeDef; status: string; rule?: CardTypeRule } | null {
  const dest = form.destination;
  const fallback = dest ? place.types.find((t) => t.id === dest.typeId) : undefined;
  if (!dest || !fallback) return null;
  const rules = dest.typeRules ?? [];
  if (rules.length) {
    const raw: Record<string, unknown> =
      answers instanceof Map
        ? Object.fromEntries(answers as ReadonlyMap<string, unknown>)
        : { ...answers };
    const shown = new Map(shownQuestions(form, raw).map((q) => [q.id, q]));
    for (const rule of rules) {
      const q = shown.get(rule.questionId);
      if (!q || typeRuleProblem(rule, form, place)) continue;
      // An unanswered choice matches none; a Checkbox left alone reads as Not Ticked.
      if (!ruleHolds(q, rule, raw[q.id])) continue;
      const type = place.types.find((t) => t.id === rule.typeId)!;
      // The rule's own status is on a board taking its type (typeRuleProblem), so a column is always found.
      const columns = targetColumns(place.boards, place.types, type.id);
      return { type, status: columnForType(columns, type, rule.status)!, rule };
    }
  }
  return { type: fallback, status: dest.status };
}

// A new rule: the first question a rule may read and its first answer, the first type a board shows that neither the
// default nor another rule has, the first column of its boards that type uses. Null when there is no room or nothing
// left to pick.
export function newTypeRule(
  form: Pick<FormDefinition, 'sections'> & { destination?: FormDestination | undefined },
  takes: readonly ItemTypeDef[],
  place: RulePlace,
  id: string,
): CardTypeRule | null {
  const dest = form.destination;
  const rules = dest?.typeRules ?? [];
  if (!dest || rules.length >= TYPE_RULES_MAX) return null;
  const q = typeRuleQuestions(form)[0];
  const used = new Set([dest.typeId, ...rules.map((r) => r.typeId)]);
  const type = takes.find((t) => !used.has(t.id));
  if (!q || !type) return null;
  const columns = targetColumns(place.boards, place.types, type.id);
  const status = typeColumns(columns, type)[0]?.status ?? dest.status;
  return { id, questionId: q.id, anyOf: [ruleChoices(q)[0]!], typeId: type.id, status };
}

// `form` with its board destination's rules set; an empty list takes the key away, so a form without rules is stored
// as it always was.
export function withTypeRules<F extends Pick<FormDefinition, 'destination'>>(
  form: F,
  rules: readonly CardTypeRule[],
): F {
  const dest = form.destination;
  if (!dest) return form;
  const { typeRules: _gone, ...rest } = dest;
  return { ...form, destination: rules.length ? { ...rest, typeRules: [...rules] } : rest };
}

// A rule changed in place (by id).
export function updateTypeRule<F extends Pick<FormDefinition, 'destination'>>(
  form: F,
  id: string,
  patch: Partial<Omit<CardTypeRule, 'id'>>,
): F {
  const rules = form.destination?.typeRules ?? [];
  return withTypeRules(
    form,
    rules.map((r) => {
      if (r.id !== id) return r;
      const next: CardTypeRule = { ...r, ...patch };
      if (!next.fields || Object.keys(next.fields).length === 0) delete next.fields;
      return next;
    }),
  );
}
