// The rule run bound to a product (liveworkspace/docs/specs/018-automations/automations.md "Agents"): its words, its
// kinds, its templates' titles and its refusals, so its MCP's list_rules and change_rules and its CLI's `rule` verbs
// call one thing with the item's id.
import type { ApiClient } from '@liveworkspace/api-client';
import { applyRuleChanges, type RuleChange, type RuleChangesResult } from './rule-changes';
import { readRuleListing, type RuleListingInput, type RuleListingResult } from './rule-read';
import { createRuleRefusal, type RuleRefusal } from './rule-refusals';
import { readRulesList, rulesPathOf, type RuleProduct } from './rule-state';

export type RuleRun = {
  readRuleListing(
    api: ApiClient,
    itemId: string,
    input: RuleListingInput,
  ): Promise<RuleListingResult>;
  // Reads the rules list once, then applies the changes in order over it.
  applyRuleChanges(
    api: ApiClient,
    itemId: string,
    changes: readonly RuleChange[],
  ): Promise<RuleChangesResult>;
  ruleRefusalOf(err: unknown): RuleRefusal | null;
};

export function createRuleRun(
  binding: RuleProduct,
  apiRefusalOf: (err: unknown) => RuleRefusal | null,
): RuleRun {
  const { product } = binding;
  const word = product.word ?? product.noun;
  // Made once per product: the rules' words read a template by its title.
  const templateNames = binding.templates
    ? new Map(binding.templates.map((t) => [t.kind, t.title]))
    : undefined;
  const ruleRefusalOf = createRuleRefusal(product, apiRefusalOf);
  return {
    ruleRefusalOf,
    readRuleListing: (api, itemId, input) =>
      readRuleListing(api, rulesPathOf(product, itemId), input, {
        ...binding,
        ...(templateNames ? { templateNames } : {}),
      }),
    applyRuleChanges: async (api, itemId, changes) => {
      const base = rulesPathOf(product, itemId);
      const list = await readRulesList(api, base);
      return applyRuleChanges({ api, base, list, word, ruleRefusalOf }, changes);
    },
  };
}
