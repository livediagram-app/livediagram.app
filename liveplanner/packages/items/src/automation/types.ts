// Automations: a plan's rules, their triggers, conditions and steps, and their runs (docs/specs/026-plan/automations.md,
// blueprint automations.md). The shapes only; checks are validate.ts, the run's pure parts plan-actions.ts, values.ts,
// schedule.ts and related.ts.
// Plain JSON throughout: a rule is stored, sent and copied as written.

import type { ItemPerson } from '../item';

// Limits (spec "Limits").
export const AUTOMATION_RULES_MAX = 50;
export const AUTOMATION_CONDITIONS_MAX = 10;
export const AUTOMATION_ACTIONS_MAX = 20;
export const AUTOMATION_CHAIN_MAX = 5;
export const AUTOMATION_RUNS_PER_DAY = 1000;
export const AUTOMATION_QUEUE_MAX = 500;
export const AUTOMATION_FAILURES_TO_PAUSE = 10;
export const AUTOMATION_LOG_MAX = 2000;
export const AUTOMATION_LOG_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const AUTOMATION_TEXT_MAX = 2000;
export const AUTOMATION_NAME_MAX = 60;
export const AUTOMATION_CREATED_PER_RUN = 1;
// Phase 2 (spec "Time triggers", "For Related Cards", "Outgoing actions", "Assign in turn").
export const AUTOMATION_TIME_CARDS_MAX = 100;
export const AUTOMATION_BRANCH_CARDS_MAX = 100;
export const AUTOMATION_BRANCH_ACTIONS_MAX = 10;
export const AUTOMATION_OUTGOING_MAX = 5;
export const AUTOMATION_ROTATE_MIN = 2;
export const AUTOMATION_ROTATE_MAX = 10;
export const AUTOMATION_DUE_DAYS_MAX = 30;
export const AUTOMATION_LATE_MAX_MS = 24 * 60 * 60 * 1000;

// Who a rule's changes are by: `name` is the rule's name at the moment it ran, the history tag says it was a rule.
export const AUTOMATION_PERSON_ID = 'automation';
export const AUTOMATION_COLOR = '#7c3aed';
export function automationPerson(ruleName: string): ItemPerson {
  return { id: AUTOMATION_PERSON_ID, name: ruleName, color: AUTOMATION_COLOR };
}
// Who an Incoming Webhook call is by: no person, so `{{person}}` (Who Did It) reads "Incoming webhook".
export const INCOMING_WEBHOOK_PERSON: ItemPerson = {
  id: 'incoming_webhook',
  name: 'Incoming webhook',
  color: AUTOMATION_COLOR,
};

// ---- Triggers ----------------------------------------------------------------------------------------------------

// A time of day, 'HH:MM' in the rule's time zone, on the quarter hour.
export type AutomationClock = string;

export type AutomationTrigger =
  | { kind: 'card_created'; status?: string }
  | { kind: 'form_response'; formTab?: string }
  | { kind: 'card_moved'; from?: string[]; to?: string[] }
  | { kind: 'field_changed'; fields: string[] }
  | { kind: 'comment_added' }
  | { kind: 'manual' }
  | {
      kind: 'scheduled';
      every: 'day' | 'weekday' | 'week' | 'month';
      // week: 0 Sunday … 6 Saturday, at least one.
      days?: number[];
      // month: 1 to 31; past the month's end is its last day.
      dayOfMonth?: number;
      at: AutomationClock;
    }
  | { kind: 'due_in'; days: number; at: AutomationClock }
  | { kind: 'overdue'; at: AutomationClock }
  // Phase 3: another tool's call to the rule's own address, proving it holds the rule's secret (incoming.ts).
  | { kind: 'incoming_webhook' };

export type AutomationTriggerKind = AutomationTrigger['kind'];
export const AUTOMATION_TRIGGER_KINDS: readonly AutomationTriggerKind[] = [
  'card_created',
  'form_response',
  'card_moved',
  'field_changed',
  'comment_added',
  'manual',
  'scheduled',
  'due_in',
  'overdue',
  'incoming_webhook',
];
export type AutomationTimeTriggerKind = 'scheduled' | 'due_in' | 'overdue';
export const isTimeTrigger = (
  t: AutomationTrigger,
): t is Extract<AutomationTrigger, { kind: AutomationTimeTriggerKind }> =>
  t.kind === 'scheduled' || t.kind === 'due_in' || t.kind === 'overdue';
// A trigger with no person behind it (a time, another tool's call): no Who Did It, nobody to assign or email as
// whoever triggered it.
export const isPersonless = (t: AutomationTrigger): boolean =>
  isTimeTrigger(t) || t.kind === 'incoming_webhook';

// ---- Conditions --------------------------------------------------------------------------------------------------

export type AutomationFieldOp =
  | 'is'
  | 'is_not'
  | 'empty'
  | 'not_empty'
  | 'contains'
  | 'not_contains'
  | 'before'
  | 'after'
  | 'on_or_before'
  | 'on_or_after'
  | 'less_than'
  | 'more_than';

// A day a date condition compares with: a fixed day, or today shifted by whole days.
export type AutomationDay = { day: string } | { today: number };

export type AutomationWho = { person: string } | { role: 'editor' | 'participant' | 'agent' };

export type AutomationCondition =
  | { kind: 'type'; not?: true; types: string[] }
  | { kind: 'column'; not?: true; statuses: string[] }
  | {
      kind: 'field';
      field: string;
      op: AutomationFieldOp;
      // Absent for empty / not_empty; a day for the date ops; text, a number or a list otherwise.
      value?: string | number | string[] | AutomationDay;
    }
  | { kind: 'who'; not?: true; who: AutomationWho[] }
  | { kind: 'saved_filter'; tab: string; filter: string };

// ---- Actions -----------------------------------------------------------------------------------------------------

// A value a Set Field writes: literal text (values allowed), a number, a list, a day, or another field of the card.
export type AutomationSetValue =
  | { text: string }
  | { number: number }
  | { list: string[] }
  | { date: AutomationDay }
  | { from: string };

export type AutomationAssignee =
  | { person: string }
  | { trigger: true }
  | { nobody: true }
  // People in turn: 2 to 10 person ids, in order; the rule keeps its place.
  | { rotate: string[] };
export type AutomationRecipient = { assignee: true } | { trigger: true } | { person: string };

export type AutomationAction =
  | { kind: 'move'; status: string }
  | { kind: 'set_field'; field: string; value: AutomationSetValue }
  | { kind: 'clear_field'; field: string }
  | { kind: 'assign'; to: AutomationAssignee }
  | { kind: 'add_label'; label: string }
  | { kind: 'remove_label'; label: string }
  | { kind: 'comment'; text: string }
  | { kind: 'flag' }
  | { kind: 'unflag' }
  | { kind: 'archive' }
  | {
      kind: 'create_card';
      type: string;
      title: string;
      status?: string;
      copy?: ('assignee' | 'labels' | 'due')[];
      // A Card field on the new card that points back at the triggering card.
      linkField?: string;
    }
  | { kind: 'email'; to: AutomationRecipient; subject: string; body: string };

export type AutomationActionKind = AutomationAction['kind'];

// Send to Webhook, Post to Slack, Post to Teams: through one of the plan's platform webhooks, by id.
export type AutomationOutgoing = {
  kind: 'notify';
  via: 'webhook' | 'slack' | 'teams';
  webhook: string;
  // The webhook's name when it was picked, for the Audit Trail's "Queued for Launch Channel" (the room holds no list of
  // the plan's webhooks); the builder's sentence reads the current name where it has one.
  name?: string;
  text: string;
};
export type AutomationVia = AutomationOutgoing['via'];

// Which cards a branch runs on, from the triggering card.
export type AutomationRelated =
  | { kind: 'linked'; field?: string }
  | { kind: 'blocked_by' }
  | { kind: 'blocking' }
  | { kind: 'children' }
  | { kind: 'saved_filter'; tab: string; filter: string };

export type AutomationIf = {
  kind: 'if';
  conditions: AutomationCondition[];
  then: AutomationAction[];
  else: AutomationAction[];
};

// For Related Cards: no If, branch, Create Card or outgoing action inside.
export type AutomationBranch = {
  kind: 'for';
  related: AutomationRelated;
  conditions: AutomationCondition[];
  then: AutomationAction[];
};

export type AutomationStep =
  AutomationAction | AutomationOutgoing | AutomationIf | AutomationBranch;

// ---- A rule ------------------------------------------------------------------------------------------------------

// What a person writes in the builder: everything but the stamps.
export interface AutomationRuleBody {
  name: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  steps: AutomationStep[];
  // "Let this rule's changes trigger other rules".
  chain: boolean;
  // The saver's IANA time zone, for Today and {{now}}.
  timeZone: string;
}

export interface AutomationStamp {
  by: ItemPerson;
  at: number;
}

export interface AutomationRule extends AutomationRuleBody {
  id: string;
  enabled: boolean;
  // Set when the rule turned itself off after AUTOMATION_FAILURES_TO_PAUSE failures; cleared by Resume.
  paused?: { reason: string; at: number; webhook?: string };
  made: AutomationStamp;
  edited: AutomationStamp;
}

// ---- Runs --------------------------------------------------------------------------------------------------------

export type AutomationResult = 'done' | 'no_match' | 'skipped' | 'failed';

export type AutomationStepLine =
  | { kind: 'trigger'; text: string; by?: ItemPerson }
  | { kind: 'condition'; ok: boolean; text: string }
  | { kind: 'action'; ok: boolean; text: string; already?: true }
  | { kind: 'branch'; ok: boolean; text: string; cards: number };

export interface AutomationRun {
  id: string;
  ruleId: string;
  ruleName: string;
  // The card the trigger was about (null for a dropped burst line).
  card: { id: string; key: number; title: string } | null;
  at: number;
  result: AutomationResult;
  // Why a run was skipped or failed, in a sentence.
  reason?: string;
  tookMs: number;
  steps: AutomationStepLine[];
}

// One rule's figures for the Rules list.
export interface AutomationRuleStats {
  lastRunAt: number | null;
  // A time trigger's next moment (ms), for "Next: Mon 9:00"; null otherwise.
  nextAt?: number | null;
  runsThisWeek: number;
  failuresInARow: number;
}

// ---- Values ------------------------------------------------------------------------------------------------------

// The values a rule's text may hold (spec "Values"), as written between `{{` and `}}`. `card.field.<Field Name>` and
// `now ± Nd` are patterns, matched by values.ts; these are the fixed names, in the order Insert a Value lists them.
export const AUTOMATION_VALUE_NAMES = [
  'card.title',
  'card.url',
  'card.assignee',
  'card.column',
  'card.due',
  'person',
  'now.date',
  'card.key',
  'rule',
  'now',
] as const;
export type AutomationValueName = (typeof AUTOMATION_VALUE_NAMES)[number];
// The values only a branch's text may hold: the card that started the rule, beside `card.…` (the related card).
export const AUTOMATION_BRANCH_VALUE_NAMES = [
  'trigger.title',
  'trigger.key',
  'trigger.url',
] as const;
export type AutomationBranchValueName = (typeof AUTOMATION_BRANCH_VALUE_NAMES)[number];
export const AUTOMATION_BRANCH_VALUE_LABELS: Record<AutomationBranchValueName, string> = {
  'trigger.title': 'Trigger Title',
  'trigger.key': 'Trigger Number',
  'trigger.url': 'Trigger Link',
};
// Insert a Value's chip labels, by name.
export const AUTOMATION_VALUE_LABELS: Record<AutomationValueName, string> = {
  'card.title': 'Card Title',
  'card.url': 'Card Link',
  'card.assignee': 'Assignee',
  'card.column': 'Column',
  'card.due': 'Due Date',
  person: 'Who Did It',
  'now.date': 'Today',
  'card.key': 'Card Number',
  rule: 'Rule Name',
  now: 'Now',
};
