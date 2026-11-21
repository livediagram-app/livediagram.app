// A document's Automations rules for agents (docs/specs/013-workspace/automations.md "Agents"): the shared rule run
// and tools (@liveworkspace/agent-verbs/rules, ./mcp/rule-tools) bound to this product's words, its kinds
// (@livedocuments/document/automations) and its templates, so the MCP's list_rules and change_rules and the CLI's
// `rule` verbs describe and read the same rules.
import { createRuleRun, type RuleProduct } from '@liveworkspace/agent-verbs/rules';
import { createRuleVerbs } from '@liveworkspace/agent-verbs/verbs/rule';
import { KINDS } from '@livedocuments/document/automations';
import { TEMPLATES } from '@livedocuments/templates';
import { resolveDocument } from '../addressing';
import { AGENT_PRODUCT } from '../agent-product';
import { apiRefusalOf } from '../api-refusal';
import type { Verb } from '../define';

export const RULE_PRODUCT: RuleProduct = {
  product: AGENT_PRODUCT,
  kinds: KINDS,
  templates: TEMPLATES.map((t) => ({ kind: t.kind, title: t.title })),
  naming:
    'A Restore a Version step names one of a tab’s named versions by its id, as list_versions lists them.',
};

export const ruleRun = createRuleRun(RULE_PRODUCT, apiRefusalOf);

/** The `rule` verbs (docs/specs/015-api/cli.md "Commands"): the shared verbs over this product's addressing. */
export const ruleVerbs = createRuleVerbs({
  rules: RULE_PRODUCT,
  run: ruleRun,
  arg: 'doc',
  resolveFile: resolveDocument,
}) as unknown as Verb[];
