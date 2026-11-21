// liveplanner's routes as the platform's Automations calls them (the platform's blueprint ui.md "The client"): each
// one of automations-client.ts's own, reached through that module's export at the call (so one replaced in a test is
// the one the screen reaches). The screen holds a rule openly (any app's kinds); what it hands back is the plan's
// own, as its panels made it.

import type { AutomationRuleBody } from '@liveplanner/api-schema';
import type { AutomationsClient } from '@liveworkspace/automations-ui/automations-client';
import * as routes from './automations-client';

export const PLAN_AUTOMATIONS_CLIENT: AutomationsClient = {
  list: (scope) => routes.listAutomations(scope),
  create: (scope, rule) => routes.createRule(scope, rule as AutomationRuleBody),
  update: (scope, id, rule) => routes.updateRule(scope, id, rule as AutomationRuleBody),
  toggle: (scope, id, enabled) => routes.toggleRule(scope, id, enabled),
  duplicate: (scope, id) => routes.duplicateRule(scope, id),
  remove: (scope, id) => routes.deleteRule(scope, id),
  // A plan's rule is tested and run on a card: the screen never asks with none.
  test: (scope, rule, item) => routes.testRule(scope, rule as AutomationRuleBody, item ?? ''),
  draft: (scope, prompt, timeZone) => routes.draftRule(scope, prompt, timeZone),
  run: (scope, id, item) => routes.runRule(scope, id, item ?? ''),
  runs: (scope, query) => routes.listRuns(scope, query),
  makeSecret: (scope, id) => routes.makeHookSecret(scope, id),
  summary: (scope, ask) => routes.readRuleSummary(scope, ask),
};
