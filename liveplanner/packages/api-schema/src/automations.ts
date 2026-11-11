// Automations on the wire (docs/specs/026-plan/automations.md, blueprint automations.md "Routes"). The rule and run
// shapes come from @liveplanner/items; these are the request and response bodies of `/api/projects/:id/automations`.

import type {
  AutomationRule,
  AutomationRuleBody,
  AutomationRuleStats,
  AutomationRun,
  AutomationResult,
} from '@liveplanner/items';

export type {
  AutomationRule,
  AutomationRuleBody,
  AutomationRuleStats,
  AutomationRun,
  AutomationResult,
};

// A rule as the Rules list shows it: its figures, and what it names that the plan lacks (Needs Attention).
export type AutomationListedRule = AutomationRule & { stats: AutomationRuleStats; needs: string[] };

export interface AutomationsListResponse {
  rules: AutomationListedRule[];
  // The Runs today meter.
  runsToday: number;
  runsPerDay: number;
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
}

export interface AutomationRunNowRequest {
  item: string;
}

// Test on a Card and Run Rule both answer the run; a test's actions say what they would do and change nothing.
export interface AutomationRunResponse {
  run: AutomationRun;
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
  'automation_name_taken',
  'automation_rules_full',
  'automation_not_found',
  'automation_not_manual',
  // Run Rule past the day's budget (AUTOMATION_RUNS_PER_DAY): 429, nothing ran.
  'automation_budget_spent',
] as const;
export type AutomationError = (typeof AUTOMATION_ERRORS)[number];

// A refusal's body: `path` names the part of the rule at fault (`steps.2.text`), for the builder to mark.
export interface AutomationErrorBody {
  error: AutomationError;
  path?: string;
  message?: string;
}
