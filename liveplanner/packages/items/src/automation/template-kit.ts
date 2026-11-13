// Automations: what the Templates gallery's templates are built from (templates.ts; docs/specs/026-plan/automations.md
// "The Automations screen": Templates): the plan a template reads, its categories, ids and picks, and the finders that
// fill a rule by role (the done columns, an In Progress column, a column named like Review, a date field named like
// Completed On, a Bug type). Pure.

import type { ItemTypeDef } from '../item-types';
import type { StatusPhase } from '../plan-views';
import type {
  AutomationCondition,
  AutomationRuleBody,
  AutomationStep,
  AutomationTrigger,
} from './types';

// What a template reads of the plan: its columns in order with the phase the boards give each, and its card types.
export interface AutomationTemplatePlan {
  statuses: readonly { status: string; name: string }[];
  phases: ReadonlyMap<string, StatusPhase>;
  types: readonly ItemTypeDef[];
  // The IANA time zone the rule will be saved in.
  timeZone: string;
}

export const AUTOMATION_TEMPLATE_CATEGORIES = [
  'status',
  'assigning',
  'due_dates',
  'forms',
  'telling_people',
  'ai',
  'github',
] as const;
export type AutomationTemplateCategory = (typeof AUTOMATION_TEMPLATE_CATEGORIES)[number];
export const AUTOMATION_TEMPLATE_CATEGORY_NAMES: Readonly<
  Record<AutomationTemplateCategory, string>
> = {
  status: 'Status',
  assigning: 'Assigning',
  due_dates: 'Due Dates',
  forms: 'Forms',
  telling_people: 'Telling People',
  ai: 'AI',
  github: 'GitHub',
};

// What a person picks before the rule can be saved, and how its step says so.
export type AutomationPick = 'column' | 'type' | 'field' | 'label' | 'people' | 'webhook';
export const AUTOMATION_PICK_WORDS: Readonly<Record<AutomationPick, string>> = {
  column: 'Pick a column',
  type: 'Pick a card type',
  field: 'Pick a field',
  label: 'Pick a label',
  people: 'Pick people',
  webhook: 'Pick a webhook',
};

export interface AutomationTemplatePickAt {
  path: string;
  pick: AutomationPick;
}

export interface AutomationTemplateFill {
  body: AutomationRuleBody;
  picks: AutomationTemplatePickAt[];
}

// The fixed list (telemetry carries the id: `UI · Opened · AutomationTemplate`).
export const AUTOMATION_TEMPLATE_IDS = [
  'stamp-finish',
  'assign-on-start',
  'overdue-nudge',
  'form-responses',
  'shipped-to-slack',
  'triage-bugs',
  'unblock-next',
  'due-soon',
  'clean-up-done',
  'escalate-urgent',
  'reopen-on-comment',
  'route-reviews',
  'due-on-start',
  'flag-blocked',
  'verify-fix',
  'back-to-backlog',
  'close-parent',
  'tell-unblocked',
  'nudge-stuck',
  'done-when-resolved',
  'sort-incoming',
  'summarise-requests',
  'review-on-open',
  'done-on-merge',
  'flag-failing-checks',
  'tell-checks-pass',
  'back-on-close',
  'merged-to-slack',
] as const;
export type AutomationTemplateId = (typeof AUTOMATION_TEMPLATE_IDS)[number];

export interface AutomationTemplate {
  id: AutomationTemplateId;
  name: string;
  // The tile's sentence (the spec's table).
  description: string;
  category: AutomationTemplateCategory;
  build: (plan: AutomationTemplatePlan) => AutomationTemplateFill;
}

// ---- Filling by role --------------------------------------------------------------------------------------------

export const doneStatuses = (plan: AutomationTemplatePlan) =>
  plan.statuses.filter((s) => plan.phases.get(s.status) === 'done').map((s) => s.status);

// The plan's In Progress column: one called so, else the first a board puts in progress.
export function inProgressStatus(plan: AutomationTemplatePlan): string | undefined {
  const doing = plan.statuses.filter((s) => plan.phases.get(s.status) === 'doing');
  return (doing.find((s) => /in progress/i.test(s.name)) ?? doing[0])?.status;
}

// A date field named like Completed On (Completed, Finished, Done On, Shipped), of any of the plan's types.
const FINISH_NAME = /complet|finish|done|shipped/i;
export function finishDateField(plan: AutomationTemplatePlan): string | undefined {
  for (const t of plan.types)
    for (const f of t.custom ?? [])
      if (f.kind === 'date' && t.fields.includes(f.id) && FINISH_NAME.test(f.label)) return f.id;
  return undefined;
}

// The plan's Review column: one named like Review (Review, In Review, Code Review), wherever the boards put it.
export const reviewStatus = (plan: AutomationTemplatePlan) =>
  plan.statuses.find((s) => /review/i.test(s.name))?.status;

export const todoStatuses = (plan: AutomationTemplatePlan) =>
  plan.statuses.filter((s) => plan.phases.get(s.status) === 'todo').map((s) => s.status);
export const doingStatuses = (plan: AutomationTemplatePlan) =>
  plan.statuses.filter((s) => plan.phases.get(s.status) === 'doing').map((s) => s.status);

export const bugType = (plan: AutomationTemplatePlan) =>
  plan.types.find((t) => /^bugs?$/i.test(t.label.trim()))?.id;

export function rule(
  plan: AutomationTemplatePlan,
  name: string,
  trigger: AutomationTrigger,
  conditions: AutomationCondition[],
  steps: AutomationStep[],
): AutomationRuleBody {
  return { name, trigger, conditions, steps, chain: false, timeZone: plan.timeZone };
}

// A column a step moves to, or its pick when the plan has none.
export const moveTo = (status: string | undefined, path: string) => ({
  step: { kind: 'move', status: status ?? '' } as const,
  picks: status ? [] : [{ path, pick: 'column' as const }],
});

// Card Moved to the plan's done columns: none, and the column is the person's to pick.
export function movedToDone(plan: AutomationTemplatePlan): {
  trigger: AutomationTrigger;
  picks: AutomationTemplatePickAt[];
} {
  const to = doneStatuses(plan);
  return {
    trigger: { kind: 'card_moved', to },
    picks: to.length ? [] : [{ path: 'trigger', pick: 'column' }],
  };
}

export const NINE = '09:00';
export const MONDAY = 1;
