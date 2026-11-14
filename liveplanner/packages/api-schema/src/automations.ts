// Automations on the wire (docs/specs/026-plan/automations.md, blueprint automations.md "Routes"). The rule and run
// shapes come from @liveplanner/items; these are the request and response bodies of `/api/projects/:id/automations`.

import type {
  AutomationNeed,
  AutomationRule,
  AutomationRuleBody,
  AutomationRuleStats,
  AutomationRun,
  AutomationResult,
} from '@liveplanner/items';

export type {
  AutomationNeed,
  AutomationRule,
  AutomationRuleBody,
  AutomationRuleStats,
  AutomationRun,
  AutomationResult,
};

// An Incoming Webhook rule's address, and its secret as an Editor sees it once made: its last 4 characters, when it
// was made and last used (null before Make Secret). Never the secret or its hash.
export interface AutomationHookInfo {
  url: string;
  secret: AutomationHookSecret | null;
}

export interface AutomationHookSecret {
  last4: string;
  madeAt: number;
  usedAt: number | null;
}

// A rule as the Rules list shows it: its figures, and what it names that the plan lacks (Needs Attention): `needs` a
// line each by stored id, for agents, and `attention` the same as data (kind and id), which the editor words without
// ids. An Incoming Webhook rule also carries `hook`: its address, and its secret's last 4 characters once made.
export type AutomationListedRule = AutomationRule & {
  stats: AutomationRuleStats;
  needs: string[];
  attention: AutomationNeed[];
  hook?: AutomationHookInfo;
};

// Make Secret and Regenerate (`POST /automations/:ruleId/secret`): the secret, shown this once, and the rule's hook.
export interface AutomationSecretResponse {
  secret: string;
  hook: AutomationHookInfo;
}

// An Incoming Webhook call's body (`POST /api/hooks/automations/:projectId/:ruleId`): the cards to run on, by number
// (up to 10; none: the rule runs once with no card), beside anything else the rule's `{{webhook.…}}` values read.
export interface AutomationHookRequest {
  cards?: number[];
  [key: string]: unknown;
}

// The call accepted: how many runs wait on the plan's queue.
export interface AutomationHookAccepted {
  queued: number;
}

// The call's refusals: 401 (the same for a wrong secret, a rule off, gone or unknown), 400, 413, 415, 429.
export const AUTOMATION_HOOK_ERRORS = [
  'webhook_unauthorized',
  'webhook_body_invalid',
  'webhook_too_large',
  'webhook_json_only',
  'webhook_rate_limited',
  'automation_budget_spent',
] as const;
export type AutomationHookError = (typeof AUTOMATION_HOOK_ERRORS)[number];

export interface AutomationsListResponse {
  rules: AutomationListedRule[];
  // The Runs today meter.
  runsToday: number;
  runsPerDay: number;
  // The plan's people as rules name them (`assign { person }` takes the id), for agents; the editor reads its own.
  people?: { id: string; name: string }[];
  // The boards' saved filters (each its board's tab, its id and name), for agents' sentences; the editor reads its own.
  filters?: { tab: string; id: string; name: string }[];
}

export interface AutomationRuleResponse {
  rule: AutomationListedRule;
}

export interface AutomationToggleRequest {
  enabled: boolean;
}

export interface AutomationOrderRequest {
  ids: string[];
}

export interface AutomationTestRequest {
  rule: AutomationRuleBody;
  // The card to try it on, by id.
  item: string;
  // The saved rule being edited, when it is one: its Assign in Turn place says whose turn it is.
  ruleId?: string;
}

export interface AutomationRunNowRequest {
  item: string;
}

// Test on a Card and Run Rule both answer the run; a test's actions say what they would do and change nothing.
export interface AutomationRunResponse {
  run: AutomationRun;
}

// Describe a Rule (spec "Describe a Rule"): the person's words and their time zone, answered with a rule body to open
// in the builder, unsaved and off, and what is left to pick in it (a webhook). Nothing is saved.
export interface AutomationDraftRequest {
  prompt: string;
  timeZone: string;
}

export interface AutomationDraftPick {
  path: string;
  pick: 'column' | 'type' | 'field' | 'label' | 'people' | 'webhook';
}

export interface AutomationDraftResponse {
  rule: AutomationRuleBody;
  picks: AutomationDraftPick[];
}

export interface AutomationRunsQuery {
  rule?: string;
  result?: AutomationResult;
  since?: number;
  limit?: number;
}

export interface AutomationRunsResponse {
  runs: AutomationRun[];
}

export const AUTOMATION_ERRORS = [
  'automations_need_editor',
  'automation_invalid',
  'automation_value_unknown',
  // A time trigger's rule naming whoever triggered it (Who Did It, Assign or Email whoever triggered it): 400.
  'automation_condition_unsupported',
  // A step where it can't go (an If or a branch inside a branch, Create Card or an outgoing action in one): 400.
  'automation_step_unsupported',
  'automation_name_taken',
  'automation_rules_full',
  'automation_not_found',
  'automation_not_manual',
  // Run Rule past the day's budget (AUTOMATION_RUNS_PER_DAY): 429, nothing ran.
  'automation_budget_spent',
  // Make Secret for a rule whose trigger is not Incoming Webhook: 409.
  'automation_not_incoming',
  // Describe a Rule: an empty or over-long request, or no time zone (400); a request that is not a rule for the plan,
  // or a reply that never read as one (422); the day's AI steps or drafts spent (429); no model, or one that erred
  // or was slow (503). Each `message` is fixed words, never the model's.
  'automation_draft_invalid',
  'automation_draft_off_topic',
  'automation_draft_unreadable',
  'automation_ai_capped',
  'automation_ai_unavailable',
] as const;
export type AutomationError = (typeof AUTOMATION_ERRORS)[number];

// A refusal's body: `path` names the part of the rule at fault (`steps.2.text`), for the builder to mark.
export interface AutomationErrorBody {
  error: AutomationError;
  path?: string;
  message?: string;
}
