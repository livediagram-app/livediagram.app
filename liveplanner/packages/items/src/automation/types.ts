// Automations: a plan's rules, their triggers, conditions and steps, and their runs (docs/specs/026-plan/automations.md,
// blueprint automations.md). The shapes only; checks are validate.ts, the run's pure parts plan-actions.ts, values.ts,
// schedule.ts and related.ts.
// Plain JSON throughout: a rule is stored, sent and copied as written.

import {
  AUTOMATION_COLOR,
  AUTOMATION_PERSON_ID,
  type AutomationGone as Gone,
  type AutomationIf as If,
  type AutomationRule as Rule,
  type AutomationRuleBody as RuleBody,
  type AutomationRunShell,
  type AutomationStamp as Stamp,
  type AutomationStepLine as StepLine,
  type AutomationClock,
  type AutomationDay,
  type AutomationOutgoing,
  type AutomationWait,
} from '@liveworkspace/automations';
import type { ItemPerson } from '../item';
import type { CrossAppStep } from '@liveworkspace/automations/cross-app';
import type { ItemSnapshotStep } from '@liveworkspace/automations/item';

// The limits every app's rules share, the rule shell and the steps every app has (Wait, a message through a webhook)
// are @liveworkspace/automations' (liveworkspace/docs/specs/018-automations/automations.md); the card kinds are here.
export {
  AUTOMATION_ACTIONS_MAX,
  AUTOMATION_ADDRESS_EMAILS_PER_DAY,
  AUTOMATION_AI_PER_DAY,
  AUTOMATION_AI_STEPS_MAX,
  AUTOMATION_AI_SUMMARY_MAX,
  AUTOMATION_CHAIN_MAX,
  AUTOMATION_COLOR,
  AUTOMATION_CONDITIONS_MAX,
  AUTOMATION_EMAIL_ADDRESSES_MAX,
  AUTOMATION_FAILURES_TO_PAUSE,
  AUTOMATION_LATE_MAX_MS,
  AUTOMATION_LOG_MAX,
  AUTOMATION_LOG_MAX_AGE_MS,
  AUTOMATION_NAME_MAX,
  AUTOMATION_OUTGOING_MAX,
  AUTOMATION_PERSON_ID,
  AUTOMATION_QUEUE_MAX,
  AUTOMATION_RULES_MAX,
  AUTOMATION_RUNS_PER_DAY,
  AUTOMATION_TEXT_MAX,
  AUTOMATION_WAITING_RUNS_MAX,
  AUTOMATION_WAITS_MAX,
  AUTOMATION_WAIT_HOURS_MAX,
  AUTOMATION_WAIT_HOURS_MIN,
  type AutomationClock,
  type AutomationDay,
  type AutomationOutgoing,
  type AutomationResult,
  type AutomationRuleStats,
  type AutomationVia,
  type AutomationWait,
} from '@liveworkspace/automations';

// Limits of the card kinds (spec "Limits").
export const AUTOMATION_CREATED_PER_RUN = 1;
// Phase 2 (spec "Time triggers", "For Related Cards", "Assign in turn").
export const AUTOMATION_TIME_CARDS_MAX = 100;
export const AUTOMATION_BRANCH_CARDS_MAX = 100;
// Card Unblocked and Related Cards Done (spec "Triggers"): the cards one move runs the rule on, the first by number.
export const AUTOMATION_DERIVED_CARDS_MAX = 100;
export const AUTOMATION_BRANCH_ACTIONS_MAX = 10;
export const AUTOMATION_ROTATE_MIN = 2;
export const AUTOMATION_ROTATE_MAX = 10;
export const AUTOMATION_DUE_DAYS_MAX = 30;
// Phase 3's AI actions (spec "AI actions"): the labels Triage adds.
export const AUTOMATION_AI_LABELS_MAX = 3;
// The actions after Phase 3 (spec "Actions"): a checklist's items.
export const AUTOMATION_CHECKLIST_ITEMS_MAX = 20;
// Change Card Type's explicit mappings (Map Fields): a type's 12 custom fields and its Description, each named once.
export const AUTOMATION_TYPE_MAPS_MAX = 13;
// The triggers after Phase 3 (spec "Triggers"): Card Stuck's days and Column Over Limit's limit.
export const AUTOMATION_STUCK_DAYS_MAX = 90;
export const AUTOMATION_COLUMN_LIMIT_MAX = 500;

// Who a rule's changes are by: `name` is the rule's name at the moment it ran, the history tag says it was a rule.
// `via`: a GitHub-triggered run's stamp says so (automations.md "On cards").
export function automationPerson(ruleName: string, via?: 'github'): ItemPerson {
  return {
    id: AUTOMATION_PERSON_ID,
    name: ruleName,
    color: AUTOMATION_COLOR,
    ...(via ? { via } : {}),
  };
}
// Whether a card's stamp is a GitHub-triggered rule's: Automation's person with its source.
export function isGithubStamp(person: ItemPerson | undefined): boolean {
  return person?.id === AUTOMATION_PERSON_ID && person.via === 'github';
}
// Who an Incoming Webhook call is by: no person, so `{{person}}` (Who Did It) reads "Incoming webhook".
export const INCOMING_WEBHOOK_PERSON: ItemPerson = {
  id: 'incoming_webhook',
  name: 'Incoming webhook',
  color: AUTOMATION_COLOR,
};
// Who Test on a Card runs an Email Received rule as: an email from nobody, so `{{person}}` reads "Email".
export const EMAIL_TEST_PERSON: ItemPerson = {
  id: 'email',
  name: 'Email',
  color: AUTOMATION_COLOR,
};

// ---- Triggers ----------------------------------------------------------------------------------------------------

export type AutomationTrigger =
  | { kind: 'card_created'; status?: string }
  | { kind: 'form_response'; formTab?: string }
  // An email to a board's address made the card (email-to-board.md). `board`: only that Plan board (its element id);
  // `sender`: only that address, or that domain as `@example.com` (email-trigger.ts); absent, any.
  | { kind: 'email_received'; board?: string; sender?: string }
  // `types`: only a card of one of these card types (by id); absent or empty, any type (docs/specs/026-plan/automations.md
  // "Triggers").
  | { kind: 'card_moved'; types?: string[]; from?: string[]; to?: string[] }
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
  | { kind: 'incoming_webhook' }
  | { kind: 'card_archived' }
  | { kind: 'card_restored' }
  | { kind: 'checklist_completed' }
  | { kind: 'threads_resolved' }
  // `people`: only when one of them is mentioned; absent, anyone.
  | { kind: 'mentioned'; people?: string[] }
  | { kind: 'card_unblocked' }
  | { kind: 'related_done'; related: 'children' | 'linked' }
  | { kind: 'column_limit'; status: string; limit: number }
  // A time trigger: cards unchanged for `days`, outside done columns (in `statuses`, when named).
  | { kind: 'stuck'; days: number; at: AutomationClock; statuses?: string[] }
  // A linked GitHub pull request (github-triggers.ts; docs/specs/026-plan/github-pull-requests.md "GitHub triggers").
  // `repositories`: only a pull request of one of them (`owner/name`, any case); absent, every one the plan hears.
  | { kind: 'pull_request_opened'; repositories?: string[] }
  | { kind: 'pull_request_merged'; repositories?: string[] }
  | { kind: 'pull_request_closed'; repositories?: string[] }
  // Its checks changed into Failing, or into Passing.
  | { kind: 'pull_request_checks'; result: 'failing' | 'passing'; repositories?: string[] };

export type AutomationTriggerKind = AutomationTrigger['kind'];
export const AUTOMATION_TRIGGER_KINDS: readonly AutomationTriggerKind[] = [
  'card_created',
  'form_response',
  'email_received',
  'card_moved',
  'field_changed',
  'comment_added',
  'manual',
  'scheduled',
  'due_in',
  'overdue',
  'incoming_webhook',
  'card_archived',
  'card_restored',
  'checklist_completed',
  'threads_resolved',
  'mentioned',
  'card_unblocked',
  'related_done',
  'column_limit',
  'stuck',
  'pull_request_opened',
  'pull_request_merged',
  'pull_request_closed',
  'pull_request_checks',
];
export const GITHUB_TRIGGER_KINDS = [
  'pull_request_opened',
  'pull_request_merged',
  'pull_request_closed',
  'pull_request_checks',
] as const satisfies readonly AutomationTriggerKind[];
export type GithubTriggerKind = (typeof GITHUB_TRIGGER_KINDS)[number];
// The repositories one GitHub trigger may name: every one a plan may hear (github-pull-requests.md REPOSITORIES_MAX).
export const GITHUB_TRIGGER_REPOSITORIES_MAX = 20;
export const isGithubKind = (kind: AutomationTriggerKind): kind is GithubTriggerKind =>
  (GITHUB_TRIGGER_KINDS as readonly string[]).includes(kind);
export const isGithubTrigger = (
  t: AutomationTrigger,
): t is Extract<AutomationTrigger, { kind: GithubTriggerKind }> => isGithubKind(t.kind);
export type AutomationTimeTriggerKind = 'scheduled' | 'due_in' | 'overdue' | 'stuck';
export const isTimeTrigger = (
  t: AutomationTrigger,
): t is Extract<AutomationTrigger, { kind: AutomationTimeTriggerKind }> =>
  t.kind === 'scheduled' || t.kind === 'due_in' || t.kind === 'overdue' || t.kind === 'stuck';
// A trigger with no person of the plan behind it (a time, another tool's call, GitHub, an email's sender): no Who Did
// It, nobody to assign or email as whoever triggered it.
export const isPersonless = (t: AutomationTrigger): boolean =>
  isTimeTrigger(t) ||
  t.kind === 'incoming_webhook' ||
  t.kind === 'email_received' ||
  isGithubTrigger(t);

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
// Send Email's: a person as above, or 1 to 10 typed-in addresses (lower case, each once; email-addresses.ts).
export type AutomationEmailRecipient = AutomationRecipient | { addresses: string[] };

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
  | { kind: 'email'; to: AutomationEmailRecipient; subject: string; body: string }
  // `map`: explicit source field to new-type field mappings (item-types.md "Explicit mappings"); absent on older rules.
  | { kind: 'set_type'; type: string; map?: { from: string; to: string }[] }
  // `colour`: a #rrggbb, or null for none.
  | { kind: 'set_colour'; colour: string | null }
  | { kind: 'restore' }
  // A copy of the card: its type, title and fields, in its column or `status`.
  | { kind: 'copy_card'; status?: string }
  // Unticked items to add (values allowed); one the card's checklist already holds, by its text, is left out.
  | { kind: 'add_checklist'; items: string[] }
  // One of the card's Card fields pointed at a card: a chosen one by id, or (in a branch) the card that started it.
  | { kind: 'link_card'; field: string; to: { card: string } | { trigger: true } }
  // A thread @mentioning someone, with a message (values allowed).
  | { kind: 'mention'; to: AutomationRecipient; text: string }
  | { kind: 'resolve_threads' };

export type AutomationActionKind = AutomationAction['kind'];

// Which cards a branch runs on, from the triggering card.
export type AutomationRelated =
  | { kind: 'linked'; field?: string }
  | { kind: 'blocked_by' }
  | { kind: 'blocking' }
  | { kind: 'children' }
  | { kind: 'saved_filter'; tab: string; filter: string };

export type AutomationIf = If<AutomationCondition, AutomationAction>;

// For Related Cards: no If, branch, Create Card or outgoing action inside.
export type AutomationBranch = {
  kind: 'for';
  related: AutomationRelated;
  conditions: AutomationCondition[];
  then: AutomationAction[];
};

// Summarise Card, Suggest Card Type and Triage (spec "AI actions"): one model call each, at the rule's top level only.
export type AutomationAi =
  // `field`: a custom text field to set; absent, a comment.
  | { kind: 'ai'; task: 'summarise'; field?: string }
  // `set`: set the card type; false, comment the suggestion.
  | { kind: 'ai'; task: 'card_type'; set: boolean }
  // At least one of the two is on.
  | { kind: 'ai'; task: 'triage'; priority: boolean; labels: boolean };
export type AutomationAiTask = AutomationAi['task'];
export const AUTOMATION_AI_TASKS: readonly AutomationAiTask[] = [
  'summarise',
  'card_type',
  'triage',
];

export type AutomationStep =
  | AutomationAction
  | AutomationOutgoing
  | AutomationIf
  | AutomationBranch
  | AutomationAi
  | AutomationWait
  // Steps in other apps (liveworkspace automations.md "Steps in other apps"): the shared kinds, at the top level only.
  | CrossAppStep
  // Take Snapshot and Revert to Snapshot (automations.md "Snapshot steps"): the shared kinds, at the top level only.
  | ItemSnapshotStep;

// ---- A rule ------------------------------------------------------------------------------------------------------

// What a person writes in the builder: everything but the stamps.
export type AutomationRuleBody = RuleBody<AutomationTrigger, AutomationCondition, AutomationStep>;

export type AutomationStamp = Stamp<ItemPerson>;

// `paused`: set when the rule turned itself off after AUTOMATION_FAILURES_TO_PAUSE failures; cleared by Resume.
export type AutomationRule = Rule<
  AutomationTrigger,
  AutomationCondition,
  AutomationStep,
  AutomationStamp,
  AutomationGone
>;

// ---- Runs --------------------------------------------------------------------------------------------------------

// What a failed step or an unheld condition names that the plan lacks, as data: its kind and its stored id (by
// construction the plan no longer has its name). The text keeps the id for agents ("Field estimate_x is gone"); the
// editor words the line without it ("A field is gone"). Set only on such a line, and on the run or pause it explains.
export type AutomationGone = Gone<'column' | 'type' | 'field' | 'person' | 'filter' | 'snapshot'>;

// The shared lines (trigger, condition, action), and a branch's: how many cards it ran on.
export type AutomationStepLine = StepLine<
  AutomationGone,
  ItemPerson,
  { kind: 'branch'; ok: boolean; text: string; cards: number }
>;

// A run as the Audit Trail keeps it: the shared run, about a card.
export interface AutomationRun extends AutomationRunShell<AutomationStepLine, AutomationGone> {
  // The card the trigger was about (null for a dropped burst line).
  // `ref`, its prefixed number as it ran ("WI-12"), absent from a run stored before refs or for a type of no prefix.
  card: { id: string; key: number; ref?: string; title: string } | null;
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
// The values only a GitHub rule's text may hold: the pull request that started it (github-triggers.ts).
export const AUTOMATION_PULL_REQUEST_VALUE_NAMES = [
  'pull_request.title',
  'pull_request.number',
  'pull_request.url',
] as const;
export type AutomationPullRequestValueName = (typeof AUTOMATION_PULL_REQUEST_VALUE_NAMES)[number];
export const AUTOMATION_PULL_REQUEST_VALUE_LABELS: Record<AutomationPullRequestValueName, string> =
  {
    'pull_request.title': 'Pull Request Title',
    'pull_request.number': 'Pull Request Number',
    'pull_request.url': 'Pull Request Link',
  };
// The values only an Email Received rule's text may hold: the sender's bare address (email-trigger.ts).
export const AUTOMATION_EMAIL_VALUE_NAMES = ['from'] as const;
export type AutomationEmailValueName = (typeof AUTOMATION_EMAIL_VALUE_NAMES)[number];
export const AUTOMATION_EMAIL_VALUE_LABELS: Record<AutomationEmailValueName, string> = {
  from: 'From Email',
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
