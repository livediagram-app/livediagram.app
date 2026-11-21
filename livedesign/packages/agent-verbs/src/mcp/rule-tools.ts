// list_rules and change_rules (docs/specs/013-workspace/automations.md "Agents"; docs/specs/015-api/mcp-server.md
// "Automations rules"): the shared rule tools (@liveworkspace/agent-verbs/mcp/rule-tools) in this product's words and
// kinds, and their run over its api.
import { createRuleTools } from '@liveworkspace/agent-verbs/mcp/rule-tools';
import { RULE_PRODUCT } from '../rules';

export { ruleRun } from '../rules';

export const { listRules: mcpListRules, changeRules: mcpChangeRules } = createRuleTools(
  RULE_PRODUCT,
  'designId',
);

// Their outputs by name, as the other tools' are (output-schema.ts).
export const listRulesOutput = mcpListRules.mcpShapes.output;
export const changeRulesOutput = mcpChangeRules.mcpShapes.output;
