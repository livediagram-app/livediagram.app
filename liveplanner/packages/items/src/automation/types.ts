// Automations: a plan's rules, their triggers, conditions and steps, and their runs (docs/specs/026-plan/automations.md,
// blueprint automations.md). The shapes only; checks are validate.ts, the run's pure parts evaluate.ts and values.ts.
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

// Who a rule's changes are by: `name` is the rule's name at the moment it ran, the history tag says it was a rule.
export const AUTOMATION_PERSON_ID = 'automation';
export const AUTOMATION_COLOR = '#7c3aed';
export function automationPerson(ruleName: string): ItemPerson {
  return { id: AUTOMATION_PERSON_ID, name: ruleName, color: AUTOMATION_COLOR };
}

// ---- Triggers ----------------------------------------------------------------------------------------------------

export type AutomationTrigger =
  | { kind: 'card_created'; status?: string }
  | { kind: 'form_response'; formTab?: string }
  | { kind: 'card_moved'; from?: string[]; to?: string[] }
  | { kind: 'field_changed'; fields: string[] }
  | { kind: 'comment_added' }
  | { kind: 'manual' };

export type AutomationTriggerKind = AutomationTrigger['kind'];
export const AUTOMATION_TRIGGER_KINDS: readonly AutomationTriggerKind[] = [
  'card_created',
  'form_response',
  'card_moved',
  'field_changed',
  'comment_added',
  'manual',
];

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

export type AutomationAssignee = { person: string } | { trigger: true } | { nobody: true };
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

export type AutomationStep =
  | AutomationAction
  | {
      kind: 'if';
      conditions: AutomationCondition[];
      then: AutomationAction[];
      else: AutomationAction[];
    };

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
  paused?: { reason: string; at: number };
  made: AutomationStamp;
  edited: AutomationStamp;
}

// ---- Runs --------------------------------------------------------------------------------------------------------

export type AutomationResult = 'done' | 'no_match' | 'skipped' | 'failed';

export type AutomationStepLine =
  | { kind: 'trigger'; text: string; by?: ItemPerson }
  | { kind: 'condition'; ok: boolean; text: string }
  | { kind: 'action'; ok: boolean; text: string; already?: true };

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
  runsThisWeek: number;
  failuresInARow: number;
}
