// What list_rules and the CLI's `rule ls`, `rule get` and `rule log` answer (liveworkspace/docs/specs/018-automations/
// automations.md "Agents"): every rule's line, the item's tabs and people as a rule names them, one rule whole when
// asked, and the Audit Trail when asked. One read (the rules list, which carries the tabs and people), a second for
// the runs; the sentences are worked out over names made once a call.
import type { ApiClient } from '@liveworkspace/api-client';
import {
  listedRule,
  listedRuleBody,
  listedRun,
  resolveRule,
  ruleNamesOf,
  type ListedRule,
  type ListedRuleBody,
  type ListedRun,
} from './rule-listing';
import { readRuleRuns, readRulesList, type ItemRulesList, type RuleProduct } from './rule-state';

export type RuleListingInput = { rule?: string; runs?: boolean; limit?: number };

export type RuleListing = {
  rules: ListedRule[];
  // What a rule may name a tab and a person by: their id or their name.
  tabs: { id: string; name: string }[];
  people: string[];
  rule?: ListedRuleBody;
  runs?: ListedRun[];
  runsToday: number;
  runsPerDay: number;
  count: number;
};

export type RuleListingResult =
  | { ok: true; listing: RuleListing; list: ItemRulesList }
  | { ok: false; code: string; message: string };

/** The listing over `base` (the item's rules path), in the product's words and kinds. */
export async function readRuleListing(
  api: ApiClient,
  base: string,
  input: RuleListingInput,
  binding: RuleProduct & { templateNames?: ReadonlyMap<string, string> },
): Promise<RuleListingResult> {
  const list = await readRulesList(api, base);
  const word = binding.product.word ?? binding.product.noun;
  const found = input.rule === undefined ? null : resolveRule(input.rule, list.rules, word);
  if (found && !found.ok) return found;
  const one = found?.value;
  const runs = input.runs
    ? (await readRuleRuns(api, base, { rule: one?.id, limit: input.limit })).map(listedRun)
    : undefined;
  const names = ruleNamesOf(list, binding);
  const rules = list.rules.map((r) => listedRule(r, binding.kinds, names));
  return {
    ok: true,
    list,
    listing: {
      rules,
      tabs: (list.tabs ?? []).map((t) => ({ id: t.id, name: t.name })),
      people: (list.people ?? []).map((p) => p.name),
      ...(one ? { rule: listedRuleBody(one) } : {}),
      ...(runs ? { runs } : {}),
      runsToday: list.runsToday,
      runsPerDay: list.runsPerDay,
      count: rules.length,
    },
  };
}
