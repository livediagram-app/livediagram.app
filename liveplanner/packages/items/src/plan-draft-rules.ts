// Describe a Plan's starter rules (docs/specs/026-plan/describe-a-plan.md "Starter rules"; blueprint describe-a-plan.md
// "Starter rules"): up to two Automations rules a drafted plan may carry, read by Describe a Rule's reader
// (readAiDraft) against the drafted board and card types, held to a starter's few kinds, and kept named as the draft
// names things so the preview's changes and Make Plan read them against the plan as it is then. The most a rule can do
// is sit in the preview: the editor's Make Plan makes it. Pure.

import { readAiDraft } from './automation/ai-draft';
import { ruleNeedItems, type AutomationNeed } from './automation/attention';
import { namedRuleBody, ruleWithRefs, type RuleNames } from './automation/named';
import type { AutomationOutline } from './automation/outline';
import type {
  AutomationCondition,
  AutomationRuleBody,
  AutomationStep,
  AutomationTrigger,
} from './automation/types';
import { setFieldRefusal } from './automation/set-field-check';
import { readRuleBody } from './automation/validate';
import {
  ruleSentence,
  type RuleSentenceOutline,
  type RuleSentencePart,
} from './automation/sentence';
import type { CustomFieldKind, ItemTypeDef } from './item-types';
import type { PlanBoardSetup } from './board-model';
import { statusKey } from './status-names';
import { typesOf, type ItemTypeCatalogue } from './type-catalogue';

export const PLAN_DRAFT_RULES_MAX = 2;
export const PLAN_DRAFT_RULE_STEPS_MAX = 3;
export const PLAN_DRAFT_RULE_CONDITIONS_MAX = 3;

// The kinds a starter rule may hold: those a new board can use with nothing else from the plan (no people by name, no
// webhooks, forms or other cards), and nothing that spends the plan's AI or sends mail.
export const STARTER_TRIGGERS: readonly AutomationTrigger['kind'][] = [
  'card_created',
  'card_moved',
  'field_changed',
  'checklist_completed',
  'overdue',
];
export const STARTER_CONDITIONS: readonly AutomationCondition['kind'][] = [
  'type',
  'column',
  'field',
];
export const STARTER_STEPS: readonly AutomationStep['kind'][] = [
  'move',
  'set_field',
  'clear_field',
  'assign',
  'add_label',
  'remove_label',
  'comment',
  'flag',
  'unflag',
];

// The starter kinds in words, for the plan's system message: a few hundred characters where the whole rule format
// (rule-format.ts) is about 8,800, so starter rules cost a draft little.
export const STARTER_RULE_FORMAT =
  `rules: 0 to ${PLAN_DRAFT_RULES_MAX} starter automation rules the work plainly suits, often none, each ` +
  '{"name":up to 40 characters, Title Case, saying what it does,"trigger":...,"conditions":[...],"steps":[...]}, ' +
  'naming columns, card types and fields exactly as this plan does. ' +
  'trigger, one of: {"kind":"card_created","status"?:column}; {"kind":"card_moved","from"?:[columns],"to"?:[columns]}; ' +
  '{"kind":"field_changed","fields":[fields]}; {"kind":"checklist_completed"}; {"kind":"overdue","at":"HH:MM"}. ' +
  `conditions, up to ${PLAN_DRAFT_RULE_CONDITIONS_MAX}: {"kind":"type","types":[card types]}; ` +
  '{"kind":"column","statuses":[columns]}; {"kind":"field","field":field,"op":"is"|"is_not"|"empty"|"not_empty",' +
  '"value"?:text}. ' +
  `steps, 1 to ${PLAN_DRAFT_RULE_STEPS_MAX}: {"kind":"move","status":column}; ` +
  '{"kind":"set_field","field":field,"value":{"text":"..."}|{"number":n}|{"date":{"today":whole days from today}}}; ' +
  '{"kind":"clear_field","field":field}; {"kind":"assign","to":{"trigger":true}}; {"kind":"add_label","label":"..."}; ' +
  '{"kind":"remove_label","label":"..."}; {"kind":"comment","text":"... up to 120 characters"}; {"kind":"flag"}; ' +
  '{"kind":"unflag"}.';

/** A starter rule as the draft holds it: named as the draft names its columns, card types and custom fields (a
 *  built-in field by its id), and whether Make Plan makes it on. */
export interface PlanDraftRule {
  name: string;
  on: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  steps: AutomationStep[];
}

// The part of a checked draft its rules are read against: the board as placed and the catalogue with its types.
export interface PlanDraftRulePlan {
  setup: Pick<PlanBoardSetup, 'columns'>;
  catalogue: ItemTypeCatalogue | null;
}

/** What a checked draft's rules may name: its board's statuses and its card types (no people, tabs, filters or
 *  forms: a new plan's rules never name them), as RuleNames and as the outline a rule's needs are read against. */
export function planDraftRuleNames(checked: PlanDraftRulePlan): {
  names: RuleNames;
  outline: AutomationOutline;
} {
  const statuses = checked.setup.columns.map((c) => ({ status: c.status, name: c.name }));
  const types = typesOf(checked.catalogue);
  return {
    names: { statuses, types, people: [], tabs: [] },
    outline: { statuses, types, people: [], savedFilters: [], formTabs: [] },
  };
}

type RuleParts = Pick<AutomationRuleBody, 'trigger' | 'conditions' | 'steps'>;

/** Why a rule is no starter (a kind or a count past the starter's), or null. */
export function starterRuleRefusal(rule: RuleParts): { path: string; message: string } | null {
  if (!STARTER_TRIGGERS.includes(rule.trigger.kind))
    return {
      path: 'trigger',
      message: 'A starter rule starts when a card is added, moved, changed, completed or overdue.',
    };
  if (rule.conditions.length > PLAN_DRAFT_RULE_CONDITIONS_MAX)
    return {
      path: 'conditions',
      message: `A starter rule has at most ${PLAN_DRAFT_RULE_CONDITIONS_MAX} conditions.`,
    };
  for (const [i, c] of rule.conditions.entries())
    if (!STARTER_CONDITIONS.includes(c.kind))
      return {
        path: `conditions.${i}`,
        message: 'A starter rule checks a card’s type, column or a field.',
      };
  if (rule.steps.length > PLAN_DRAFT_RULE_STEPS_MAX)
    return {
      path: 'steps',
      message: `A starter rule has at most ${PLAN_DRAFT_RULE_STEPS_MAX} steps.`,
    };
  for (const [i, s] of rule.steps.entries()) {
    const assignsSomeone = s.kind === 'assign' && !('trigger' in s.to) && !('nobody' in s.to);
    if (!STARTER_STEPS.includes(s.kind) || assignsSomeone)
      return { path: `steps.${i}`, message: 'A starter rule’s steps change only the card itself.' };
  }
  return null;
}

const NEED_NOUNS: Partial<Record<AutomationNeed['kind'], string>> = {
  column: 'column',
  type: 'card type',
  field: 'field',
};

/** A need in the preview's words: what the rule names that the plan won't have. */
export function planDraftNeedWords(need: AutomationNeed): string {
  if (need.kind === 'unheard') return `Field Changed never hears ${need.name}.`;
  if (need.kind === 'github' || need.kind === 'repositories')
    return 'This rule hears GitHub, which a new plan is not connected to.';
  const noun = NEED_NOUNS[need.kind];
  return noun
    ? `This rule names the ${noun} “${need.id}”, which this plan won’t have.`
    : 'This rule names something a new plan won’t have.';
}

// A body's refs (ids, as a check resolved them) back to the names the draft shows: a status to its column's name, a
// card type to its label, a custom field to its label; a built-in field keeps its id, which every plan shares.
function backToNames<T>(body: T, outline: AutomationOutline): T {
  const statuses = new Map(outline.statuses.map((s) => [s.status, s.name]));
  const types = new Map(outline.types.map((t) => [t.id, t.label]));
  const fields = new Map(
    outline.types.flatMap((t) => (t.custom ?? []).map((f) => [f.id, f.label])),
  );
  // A ref the map lacks is kept: the needs check leaves only a built-in field to keep.
  const by = (map: ReadonlyMap<string, string>) => (ref: string) => map.get(ref) ?? ref;
  return ruleWithRefs(body, { status: by(statuses), type: by(types), field: by(fields) });
}

/** A reply's `rules` read: at most PLAN_DRAFT_RULES_MAX, each through Describe a Rule's reader against the checked
 *  draft, then the starter's kinds and nothing the draft lacks; a rule that fails is left out, never asked again.
 *  The kept ones go back to names, on. */
export function readPlanDraftRules(
  raw: unknown,
  prompt: string,
  checked: PlanDraftRulePlan,
): { rules: PlanDraftRule[]; dropped: number } {
  if (!Array.isArray(raw)) return { rules: [], dropped: 0 };
  const { names, outline } = planDraftRuleNames(checked);
  const rules: PlanDraftRule[] = [];
  const asked = raw.slice(0, PLAN_DRAFT_RULES_MAX);
  for (const rule of asked) {
    const read = readAiDraft(
      { outcome: 'rule', rule },
      {
        prompt,
        names,
        timeZone: 'UTC',
        rules: rules.map((r, i) => ({ id: `${i}`, name: r.name })),
      },
    );
    if (!('body' in read)) continue;
    const body = read.body;
    if (
      starterRuleRefusal(body) ||
      setFieldRefusal(body, outline.types) ||
      ruleNeedItems(body, outline).length > 0
    )
      continue;
    const named = backToNames(body, outline);
    rules.push({
      name: named.name,
      on: true,
      trigger: named.trigger,
      conditions: named.conditions,
      steps: named.steps,
    });
  }
  return { rules, dropped: raw.length - rules.length };
}

// A rule named against `names`, read as any rule is (chain off), with why it doesn't read.
function resolved(
  rule: PlanDraftRule,
  names: RuleNames,
  timeZone: string,
): { body: AutomationRuleBody } | { path: string; message: string } {
  const parts = namedRuleBody(
    { trigger: rule.trigger, conditions: rule.conditions, steps: rule.steps },
    names,
  );
  const read = readRuleBody({
    name: rule.name.trim() || 'Starter Rule',
    ...parts,
    chain: false,
    timeZone,
  });
  return 'error' in read ? { path: read.path, message: read.message } : read;
}

/** Each rule's problem past its name, at `rules.<i>`: a rule that no longer reads or is no starter, then the first
 *  thing it names that the plan won't have. Linear in the rules (two, of three steps). */
export function planDraftRuleProblems(
  rules: readonly PlanDraftRule[],
  checked: PlanDraftRulePlan,
): { path: string; message: string }[] {
  const { names, outline } = planDraftRuleNames(checked);
  const out: { path: string; message: string }[] = [];
  for (const [i, rule] of rules.entries()) {
    const read = resolved(rule, names, 'UTC');
    const refusal =
      'body' in read
        ? (starterRuleRefusal(read.body) ?? setFieldRefusal(read.body, outline.types))
        : read;
    const need = 'body' in read && !refusal ? ruleNeedItems(read.body, outline)[0] : undefined;
    const message = refusal?.message ?? (need ? planDraftNeedWords(need) : null);
    if (message) out.push({ path: `rules.${i}`, message });
  }
  return out;
}

/** Make Plan's rules: each named against the plan as made, chain off, in the person's time zone, with its on. A rule
 *  that doesn't read is left out (the preview's checks stop Make Plan before one could). */
export function planDraftRuleBodies(
  rules: readonly PlanDraftRule[],
  checked: PlanDraftRulePlan,
  timeZone: string,
): { body: AutomationRuleBody; on: boolean }[] {
  const { names } = planDraftRuleNames(checked);
  return rules.flatMap((rule) => {
    const read = resolved(rule, names, timeZone);
    return 'body' in read ? [{ body: read.body, on: rule.on }] : [];
  });
}

// ---- Renames ----------------------------------------------------------------------------------------------------

export type PlanDraftRef = 'column' | 'type' | 'field';
const REF_KINDS = { column: 'status', type: 'type', field: 'field' } as const;

/** The rules with `from` renamed `to` wherever they name a `kind`, case and spacing aside. */
export function renameInPlanDraftRules(
  rules: readonly PlanDraftRule[],
  kind: PlanDraftRef,
  from: string,
  to: string,
): PlanDraftRule[] {
  const key = statusKey(from);
  return rules.map((r) =>
    ruleWithRefs(r, { [REF_KINDS[kind]]: (ref: string) => (statusKey(ref) === key ? to : ref) }),
  );
}

/** Whether renaming the one of `names` at `at` to `to` should follow into the rules: its old name was its alone, and
 *  the new one is no other's (so a rule never ends up naming two things, or the wrong one). */
export function renameFollows(names: readonly string[], at: number, to: string): boolean {
  const from = names[at];
  if (from === undefined) return false;
  const was = statusKey(from);
  const will = statusKey(to);
  return names.every((n, i) => i === at || (statusKey(n) !== was && statusKey(n) !== will));
}

// ---- The preview's sentences ------------------------------------------------------------------------------------

type DraftShape = {
  columns: readonly string[];
  cardTypes: readonly {
    name: string;
    builtInFields: readonly string[];
    fields: readonly { name: string; kind: string }[];
  }[];
};

/** The draft as its rules name it, for the preview's sentences: each column, card type and custom field under its own
 *  name (a type the plan already has under its label, with the plan's fields), so a rule reads in the draft's words
 *  and anything it names that the draft lacks reads as gone. */
export function planDraftRuleView(
  draft: DraftShape,
  planTypes: readonly ItemTypeDef[],
): { names: RuleNames; outline: RuleSentenceOutline } {
  const statuses = draft.columns.map((c) => ({ status: c, name: c }));
  const types = draft.cardTypes.map((t): ItemTypeDef => {
    const own = planTypes.find((p) => statusKey(p.label) === statusKey(t.name));
    const custom = own
      ? (own.custom ?? []).map((f) => ({ ...f, id: f.label }))
      : t.fields.map((f) => ({ id: f.name, label: f.name, kind: f.kind as CustomFieldKind }));
    const builtIns = own
      ? own.fields.filter((f) => !own.custom?.some((c) => c.id === f))
      : t.builtInFields;
    return {
      id: t.name,
      label: t.name,
      newTitle: '',
      glyph: 'star',
      color: '',
      fields: [...builtIns, ...custom.map((f) => f.id)],
      custom,
    };
  });
  return {
    names: { statuses, types, people: [], tabs: [] },
    outline: {
      types,
      statuses: new Map(statuses.map((s) => [s.status, s.name])),
      people: [],
      goneWords: true,
    },
  };
}

/** A rule's sentence in the preview, as the Rules list draws one, in the draft's words. */
export function planDraftRuleSentence(
  rule: PlanDraftRule,
  view: { names: RuleNames; outline: RuleSentenceOutline },
): RuleSentencePart[] {
  return ruleSentence(namedRuleBody(rule, view.names), view.outline);
}
