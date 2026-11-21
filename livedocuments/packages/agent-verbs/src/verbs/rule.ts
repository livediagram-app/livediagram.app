// The `rule` verbs (docs/specs/013-workspace/automations.md "Agents"; docs/specs/015-api/cli.md "Commands"): a
// document's Automations rules listed, read, added, changed, turned on and off, copied, deleted, tested and run, and
// its Audit Trail, by the shared verbs (@liveworkspace/agent-verbs/verbs/rule) over this product's addressing.
import { createRuleVerbs } from '@liveworkspace/agent-verbs/verbs/rule';
import { resolveDocument } from '../addressing';
import type { Verb } from '../define';
import { RULE_PRODUCT, ruleRun } from '../rules';

export const ruleVerbs = createRuleVerbs({
  rules: RULE_PRODUCT,
  run: ruleRun,
  arg: 'doc',
  resolveFile: resolveDocument,
}) as unknown as Verb[];
