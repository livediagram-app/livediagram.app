// The shapes the Automations screen reads, whatever the app (liveworkspace/docs/specs/018-automations/automations.md;
// blueprint ui.md "Shapes"). Each is the least the shared screen needs of what an app's api answers: an app's own
// rule, run and list shapes are wider and pass through the kit untouched.

import type {
  AutomationGone,
  AutomationHookInfo,
  AutomationIf,
  AutomationKind,
  AutomationOutgoing,
  AutomationResult,
  AutomationRuleBody,
  AutomationRuleStats,
  AutomationTemplatePickAt,
  AutomationWait,
} from '@liveworkspace/automations';

// A rule as the builder holds it, over an app's kinds (open by default).
export type RuleBody<
  Trigger extends AutomationKind = AutomationKind,
  Condition extends AutomationKind = AutomationKind,
  Step extends AutomationKind = AutomationKind,
> = AutomationRuleBody<Trigger, Condition, Step>;

// A rule as the list answers it: its body, whether it is on, why it paused, who changed it last, its figures, what
// it needs (the app's own shape, read through the kit) and an Incoming Webhook rule's address.
export type ListedRule<
  Trigger extends AutomationKind = AutomationKind,
  Condition extends AutomationKind = AutomationKind,
  Step extends AutomationKind = AutomationKind,
  Need = unknown,
  Gone = AutomationGone,
> = RuleBody<Trigger, Condition, Step> & {
  id: string;
  enabled: boolean;
  paused?: { reason: string; at: number; webhook?: string; gone?: Gone };
  edited: { by: { name: string }; at: number; ai?: true };
  stats: AutomationRuleStats;
  attention: readonly Need[];
  hook?: AutomationHookInfo;
};

// One line of a run on the Audit Trail: the three every app has, and a `branch` line for an app whose steps fan out.
export type RunLine<Gone = AutomationGone> =
  | { kind: 'trigger'; text: string; by?: { name: string } }
  | { kind: 'condition'; ok: boolean; text: string; gone?: Gone }
  | { kind: 'action'; ok: boolean; text: string; already?: true; ai?: true; gone?: Gone }
  // An app's branch line may carry more of its own (what it ran on).
  | { kind: 'branch'; ok: boolean; text: string; [more: string]: unknown };

// A run as the Audit Trail lists it. What it is about is the app's (kit.audit.subjectOf).
export type ListedRun<Gone = AutomationGone> = {
  id: string;
  ruleId: string;
  ruleName: string;
  at: number;
  result: AutomationResult;
  reason?: string;
  gone?: Gone;
  tookMs: number;
  steps: RunLine<Gone>[];
  waitsUntil?: number;
  afterWait?: number;
};

export type ListResponse<Rule extends ListedRule = ListedRule> = {
  rules: Rule[];
  runsToday: number;
  runsPerDay: number;
};

// A drafted rule (Describe a Rule) and a template's rule: the body and what it left to pick.
export type RuleStart<Body extends RuleBody = RuleBody> = {
  body: Body;
  picks: AutomationTemplatePickAt[];
};

// ---- Steps the screen knows by shape ---------------------------------------------------------------------------------

// An AI step: its task names its tile (`ai_<task>`).
export type AiStep = { kind: 'ai'; task: string };

export const isIf = (s: AutomationKind | undefined): s is AutomationIf => s?.kind === 'if';
export const isWait = (s: AutomationKind | undefined): s is AutomationWait => s?.kind === 'wait';
export const isOutgoing = (s: AutomationKind | undefined): s is AutomationOutgoing =>
  s?.kind === 'notify';
export const isAi = (s: AutomationKind | undefined): s is AiStep => s?.kind === 'ai';

// A step holding steps of its own: an If / Else, or an app's branch (conditions and a Then list, no Else).
export type HolderStep = {
  kind: string;
  conditions: AutomationKind[];
  then: AutomationKind[];
  else?: AutomationKind[];
};
export const isHolder = (s: AutomationKind | undefined): s is HolderStep =>
  !!s &&
  Array.isArray((s as Partial<HolderStep>).conditions) &&
  Array.isArray((s as Partial<HolderStep>).then);

/** The tile a step is added from and named by: a message step by where it posts (`notify_slack`), an AI step by its
 *  task (`ai_summarise`), any other by its kind. */
export function stepKey(step: AutomationKind): string {
  if (isOutgoing(step)) return `notify_${step.via}`;
  if (isAi(step)) return `ai_${step.task}`;
  return step.kind;
}
