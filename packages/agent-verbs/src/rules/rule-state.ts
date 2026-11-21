// An item's Automations rules as agents read them (liveworkspace/docs/specs/018-automations/automations.md "Agents";
// blueprint item-engine.md "Agents"): what a product binds (its words, its kinds, its templates), the item's rules
// path, the limits, and the two reads, the rules list and the Audit Trail. list_rules, change_rules and the CLI's
// `rule` verbs share these in livediagram, livedocuments and livedesign; liveplanner's card rules keep their own.
import type { ApiClient } from '@liveworkspace/api-client';
import type {
  AutomationListedRule,
  AutomationRunsResponse,
  AutomationsListResponse,
} from '@liveworkspace/api-schema/automations';
import type { ItemKinds, ItemRef, ItemRule, ItemRun } from '@liveworkspace/automations/item';
import type { AgentProduct } from '../product';

// What a product's rule tools are bound to.
export interface RuleProduct {
  product: AgentProduct;
  // Its Automations kinds: the check's, the sentence's and the format the tools describe.
  kinds: ItemKinds;
  // Its tab templates (list_templates' kinds), so Add a Tab from a Template reads by the template's title.
  templates?: readonly { kind: string; title: string }[];
  // A sentence on how its own kinds name what is its alone (a version, a component), for the tool's description.
  naming?: string;
}

export type ItemRulesList = AutomationsListResponse<ItemRule, ItemRef>;
export type ItemListedRule = AutomationListedRule<ItemRule, ItemRef>;

// How many Audit Trail runs a listing answers: 20 unless asked, up to 50 (as liveplanner's).
export const RULE_RUNS_DEFAULT = 20;
export const RULE_RUNS_MAX = 50;
// How many changes one change_rules call carries.
export const RULE_CHANGES_MAX = 20;

/** `/<collection>/<id>/automations`, the item's rules routes on the api. */
export const rulesPathOf = (product: Pick<AgentProduct, 'collection'>, itemId: string): string =>
  `/${product.collection}/${encodeURIComponent(itemId)}/automations`;

/** The item's rules, with its tabs and people as a rule names them: one read however many rules. */
export const readRulesList = (api: ApiClient, base: string): Promise<ItemRulesList> =>
  api.json<ItemRulesList>(base);

/** The Audit Trail, newest first: one rule's when `rule` is its id, every rule's otherwise. */
export async function readRuleRuns(
  api: ApiClient,
  base: string,
  query: { rule?: string; limit?: number },
): Promise<ItemRun[]> {
  const q = new URLSearchParams();
  if (query.rule) q.set('rule', query.rule);
  q.set('limit', String(Math.min(RULE_RUNS_MAX, query.limit ?? RULE_RUNS_DEFAULT)));
  const { runs } = await api.json<AutomationRunsResponse<ItemRun>>(`${base}/runs?${q}`);
  return runs;
}
