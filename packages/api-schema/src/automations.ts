// Automations on the wire (liveworkspace/docs/specs/018-automations/automations.md; blueprint item-engine.md "Wire
// types", "Routes"): the request and response bodies of an item's `…/automations` routes and its Incoming Webhook
// door, and the error codes they answer. Generic over the rule, the run and the need an app's engine has, so this
// package names no engine: `@liveworkspace/automations` fills them in.

// One rule's figures for the Rules list.
export interface AutomationWireStats {
  lastRunAt: number | null;
  // A time trigger's next moment (ms); null otherwise.
  nextAt?: number | null;
  runsThisWeek: number;
  failuresInARow: number;
}

// An Incoming Webhook rule's address, and its secret as an Editor sees it once made. Never the secret or its hash.
export interface AutomationWireHook {
  url: string;
  secret: { last4: string; madeAt: number; usedAt: number | null } | null;
}

// A rule as the Rules list shows it: its figures, what it names that the item lacks (`needs` a line each for
// agents, `attention` the same as data) and, for an Incoming Webhook rule, its address.
export type AutomationListedRule<Rule, Need = unknown> = Rule & {
  stats: AutomationWireStats;
  needs: string[];
  attention: Need[];
  hook?: AutomationWireHook;
};

export interface AutomationsListResponse<Rule, Need = unknown> {
  rules: AutomationListedRule<Rule, Need>[];
  // The Runs today meter.
  runsToday: number;
  runsPerDay: number;
  // The item's tabs and people as rules name them, for agents; the editor reads its own.
  tabs?: { id: string; name: string }[];
  people?: { id: string; name: string }[];
}

export interface AutomationRuleResponse<Rule, Need = unknown> {
  rule: AutomationListedRule<Rule, Need>;
}

export interface AutomationToggleRequest {
  enabled: boolean;
}

export interface AutomationOrderRequest {
  ids: string[];
}

// Test Rule: the rule as the builder holds it, and the tab to try it on where its trigger is about one.
export interface AutomationTestRequest<Body> {
  rule: Body;
  tab?: string;
}

// Run Rule, on a tab or on the item alone.
export interface AutomationRunNowRequest {
  tab?: string;
}

// Test Rule and Run Rule both answer the run; a test's steps say what they would do and change nothing.
export interface AutomationRunResponse<Run> {
  run: Run;
}

export interface AutomationRunsResponse<Run> {
  runs: Run[];
}

// Describe a Rule: the person's words and their time zone, answered with a rule body to open in the builder,
// unsaved and off, and what is left to pick in it. Nothing is saved.
export interface AutomationDraftRequest {
  prompt: string;
  timeZone: string;
}

export interface AutomationDraftPick<Pick extends string = string> {
  path: string;
  pick: Pick;
}

export interface AutomationDraftResponse<Body, Pick extends string = string> {
  rule: Body;
  picks: AutomationDraftPick<Pick>[];
}

// Make Secret and Regenerate: the secret, shown this once, and the rule's hook.
export interface AutomationSecretResponse {
  secret: string;
  hook: AutomationWireHook;
}

// A rule as anyone who may read the item sees it (`GET …/automations/summary?rule=` or `?name=`): built from an
// allow-list, never the stored rule.
export interface AutomationSummaryResponse<Summary> {
  rule: Summary;
}

// An Incoming Webhook call's body: the tab the run is about, by name or id (none: the item alone), beside anything
// else the rule's `{{webhook.…}}` values read.
export interface AutomationHookRequest {
  tab?: string;
  [key: string]: unknown;
}

// The call accepted: how many runs wait on the item's queue.
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

export const AUTOMATION_ERRORS = [
  // Anyone but a signed-in Editor of the whole item: 403.
  'automations_need_editor',
  'automation_invalid',
  'automation_value_unknown',
  // Who Did It, or an email to whoever started it, under a trigger nobody is behind: 400.
  'automation_condition_unsupported',
  // A step where it can't go: 400.
  'automation_step_unsupported',
  'automation_name_taken',
  'automation_rules_full',
  'automation_not_found',
  'automation_not_manual',
  // Run Rule past the day's budget: 429, nothing ran.
  'automation_budget_spent',
  // Run Rule the room could not start or record (its claim failed, or the run never settled): 500, try again.
  'automation_run_failed',
  // Make Secret for a rule whose trigger is not Incoming Webhook: 409.
  'automation_not_incoming',
  // Describe a Rule: an empty or over-long request, or no time zone (400); a request that is not a rule, or a
  // reply that never read as one (422); the day's AI asks or drafts spent (429); no model, or one that erred or
  // was slow (503). Each `message` is fixed words, never the model's.
  'automation_draft_invalid',
  'automation_draft_off_topic',
  'automation_draft_unreadable',
  'automation_ai_capped',
  'automation_ai_unavailable',
  // Describe a Rule on the person's key, or their team's: the provider refused it (revoked, out of credit, a model
  // it can't use) or it will not open (422), with `aiKey`; never sent to built-in AI instead.
  'ai_key_failed',
  // An API token saving a rule only a person may save (Revert to Snapshot): 403.
  'automation_needs_a_person',
  // An API token's add, change or duplicate naming a connection the rule did not already name: 403.
  'automation_connection_needs_a_person',
  // A save that would keep more snapshots than an item keeps for its rules: 409.
  'automation_snapshots_full',
] as const;
export type AutomationError = (typeof AUTOMATION_ERRORS)[number];

// A refusal's body: `path` names the part of the rule at fault (`steps.2.text`), for the builder to mark.
export interface AutomationErrorBody {
  error: AutomationError;
  path?: string;
  message?: string;
  // `ai_key_failed`: whose key, its provider (null for one that will not open) and the kind of failure.
  aiKey?: {
    source: 'item' | 'team' | 'account';
    provider: 'anthropic' | 'openai' | null;
    kind: 'bad-key' | 'no-credit' | 'model-unavailable' | 'unreadable';
  };
}
