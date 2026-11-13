// Make Plan's starter rules (docs/specs/026-plan/describe-a-plan.md "The preview", Make Plan): each made as New Rule
// makes one, through the Automations routes, in turn after the board, named free among the plan's rules, and turned
// off after when its switch was off. The routes' gate is the rule: an Editor of the whole plan, signed in, on a plan
// saved to an account.

import { freeRuleName, type AutomationRuleBody } from '@liveplanner/items';
import {
  createRule,
  listAutomations,
  toggleRule,
  type AutomationsScope,
} from '@/components/automations/automations-client';

export const STARTER_RULES_FAILED = 'Couldn’t add the starter rules. Add them in Automations.';

/** Makes `rules` in order, calling `onMade` for each one made; throws on the first that can't be (the ones before it
 *  stay made). */
export async function makeStarterRules(
  scope: AutomationsScope,
  rules: readonly { body: AutomationRuleBody; on: boolean }[],
  onMade: () => void,
): Promise<void> {
  if (rules.length === 0) return;
  const taken = (await listAutomations(scope)).rules.map((r) => ({ id: r.id, name: r.name }));
  for (const { body, on } of rules) {
    const name = freeRuleName(body.name, taken);
    const { rule } = await createRule(scope, { ...body, name });
    taken.push({ id: rule.id, name });
    if (!on && rule.enabled) await toggleRule(scope, rule.id, false);
    onMade();
  }
}
