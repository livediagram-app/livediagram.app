// What list_rules and the CLI's `rule ls`, `rule get` and `rule log` answer (docs/specs/026-plan/automations.md
// "Agents and the CLI"): every rule's line, the plan's people by name, one rule whole when asked, and the Audit Trail
// when asked. Two reads (the rules and the plan), a third for the runs, and a fourth (the cards) when a run names one.
import type { ApiClient } from '@liveworkspace/api-client';
import type { ItemsResponse } from '@liveplanner/api-schema';
import { itemsPath } from '../verbs/shared';
import {
  listedRule,
  listedRuleBody,
  listedRun,
  resolveRule,
  runCardRefs,
  type ListedRule,
  type ListedRuleBody,
  type ListedRun,
} from './rule-listing';
import { readRuleRuns, readRulesState, sentenceOutlineOf, type RulesState } from './rule-state';

export type RuleListingInput = { rule?: string; runs?: boolean; limit?: number };

export type RuleListing = {
  rules: ListedRule[];
  // Who a rule can name, by name (an assignee, a recipient, Who Did It).
  people: string[];
  rule?: ListedRuleBody;
  runs?: ListedRun[];
  runsToday: number;
  runsPerDay: number;
  count: number;
};

export type RuleListingResult =
  | { ok: true; listing: RuleListing; state: RulesState }
  | { ok: false; code: string; message: string };

// The Audit Trail's runs, each card named by its type's prefix: the plan's cards are read only when a run names one.
async function listedRuns(
  api: ApiClient,
  projectId: string,
  state: RulesState,
  rule: string | undefined,
  limit: number | undefined,
): Promise<ListedRun[]> {
  const runs = await readRuleRuns(api, projectId, { rule, limit });
  if (!runs.some((r) => r.card)) return runs.map((r) => listedRun(r));
  const { items } = await api.json<ItemsResponse>(itemsPath(projectId));
  const refOf = runCardRefs(items, state.plan.types);
  return runs.map((r) => listedRun(r, refOf));
}

export async function readRuleListing(
  api: ApiClient,
  projectId: string,
  input: RuleListingInput,
): Promise<RuleListingResult> {
  const state = await readRulesState(api, projectId);
  const { list } = state;
  const found = input.rule === undefined ? null : resolveRule(input.rule, list.rules);
  if (found && !found.ok) return found;
  const one = found?.rule;
  const outline = sentenceOutlineOf(state);
  const runs = input.runs
    ? await listedRuns(api, projectId, state, one?.id, input.limit)
    : undefined;
  const rules = list.rules.map((r) => listedRule(r, outline));
  return {
    ok: true,
    state,
    listing: {
      rules,
      people: (list.people ?? []).map((p) => p.name),
      ...(one ? { rule: listedRuleBody(one) } : {}),
      ...(runs ? { runs } : {}),
      runsToday: list.runsToday,
      runsPerDay: list.runsPerDay,
      count: rules.length,
    },
  };
}
