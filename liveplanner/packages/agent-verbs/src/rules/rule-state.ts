// A plan's Automations rules as agents read them (docs/specs/026-plan/automations.md "Agents and the CLI"): the rules
// list and the plan, read together once a call, and the Audit Trail when asked. The MCP's list_rules and change_rules
// and the CLI's `rule` verbs share this.
import type { ApiClient } from '@liveworkspace/api-client';
import type {
  AutomationRun,
  AutomationRunsResponse,
  AutomationsListResponse,
  PlanResponse,
} from '@liveplanner/api-schema';
import type { RuleSentenceOutline } from '@liveplanner/items';
import { planPath } from '../plan/plan-state';

export const rulesPath = (projectId: string) =>
  `/projects/${encodeURIComponent(projectId)}/automations`;

// How many Audit Trail runs a listing answers (spec "Limits"): 20 unless asked, up to 50.
export const RULE_RUNS_DEFAULT = 20;
export const RULE_RUNS_MAX = 50;
// How many changes one change_rules call carries (spec "Limits").
export const RULE_CHANGES_MAX = 20;

export interface RulesState {
  list: AutomationsListResponse;
  plan: PlanResponse;
}

/** The plan's rules and the plan (its columns, card types and tabs), in parallel: two reads however many rules. */
export async function readRulesState(api: ApiClient, projectId: string): Promise<RulesState> {
  const [list, plan] = await Promise.all([
    api.json<AutomationsListResponse>(rulesPath(projectId)),
    api.json<PlanResponse>(planPath(projectId)),
  ]);
  return { list, plan };
}

/** The Audit Trail, newest first: one rule's when `rule` is its id, every rule's otherwise. */
export async function readRuleRuns(
  api: ApiClient,
  projectId: string,
  query: { rule?: string; limit?: number },
): Promise<AutomationRun[]> {
  const q = new URLSearchParams();
  if (query.rule) q.set('rule', query.rule);
  q.set('limit', String(Math.min(RULE_RUNS_MAX, query.limit ?? RULE_RUNS_DEFAULT)));
  const { runs } = await api.json<AutomationRunsResponse>(`${rulesPath(projectId)}/runs?${q}`);
  return runs;
}

/** The plan as a rule's sentence names it: card types, columns, people and tabs. */
export function sentenceOutlineOf(state: RulesState): RuleSentenceOutline {
  return {
    types: state.plan.types,
    statuses: new Map(state.plan.statuses.map((s) => [s.status, s.name])),
    people: state.list.people ?? [],
    tabs: new Map((state.plan.tabs ?? []).map((t) => [t.id, t.name])),
  };
}
