// A design's Automations rules for agents (docs/specs/013-workspace/automations.md "Agents"): the shared rule run
// and tools (@liveworkspace/agent-verbs/rules, ./mcp/rule-tools) bound to this product's words, its kinds
// (@livedesign/design/automations) and its templates, so the MCP's list_rules and change_rules and the CLI's
// `rule` verbs describe and read the same rules.
import { createRuleRun, type RuleProduct } from '@liveworkspace/agent-verbs/rules';
import { KINDS } from '@livedesign/design/automations';
import { TEMPLATES } from '@livedesign/templates';
import { AGENT_PRODUCT } from '../agent-product';
import { apiRefusalOf } from '../api-refusal';

export const RULE_PRODUCT: RuleProduct = {
  product: AGENT_PRODUCT,
  kinds: KINDS,
  templates: TEMPLATES.map((t) => ({ kind: t.kind, title: t.title })),
  naming:
    'Component Changed keeps to one main component by its id, as read_design view "components" prints it.',
};

export const ruleRun = createRuleRun(RULE_PRODUCT, apiRefusalOf);
