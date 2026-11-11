// What list_rules and the CLI's `rule ls`, `rule get` and `rule log` answer (docs/specs/026-plan/automations.md
// "Agents and the CLI"): every rule's line, the plan's people by name, one rule whole when asked, and the Audit Trail
// when asked. Two reads (the rules and the plan), and a third for the runs.
import type { ApiClient } from '@liveworkspace/api-client';
import {
  listedRule,
  listedRuleBody,
  listedRun,
  resolveRule,
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
    ? (await readRuleRuns(api, projectId, { rule: one?.id, limit: input.limit })).map(listedRun)
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
