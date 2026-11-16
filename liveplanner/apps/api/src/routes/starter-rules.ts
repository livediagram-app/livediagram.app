// A template's starter rules on the API's create (docs/specs/026-plan/plan-templates.md "Starter rules"; blueprint
// automations.md "Starter rules"; docs/specs/015-api/api.md POST /api/projects `starterRules`): a plan made with a
// seeded template tab (the MCP's create_project, the CLI's --template), or whose create names its template (the
// editor's wizard, an Offline Mode sync), by a signed-in person or an API token of one, starts with the rules its
// template lists, made in the
// plan's room as New Rule makes them (named free among its rules, stamped by the caller), each on or off as the template
// ships it. A guest, a workbench session and a deployment without Automations make none.
import { freeRuleName, type AutomationRule } from '@liveplanner/items';
import { hasStarterRules } from '@liveplanner/templates';
import { templateStarterRules } from '@liveplanner/templates/template-starter-rules';
import { signedInCaller } from './automation-routes';
import { writer } from './item-route-kit';
import type { PlanRouteContext } from './context';

/** The create body's `starterRules`, when it names a template and, if any, a time zone this runtime knows; else null
 *  (never a refusal: the rules are a nicety the create goes on without). */
export function starterRulesAsked(raw: unknown): { template: string; timeZone?: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const { template, timeZone } = raw as Record<string, unknown>;
  if (typeof template !== 'string' || !hasStarterRules(template)) return null;
  if (typeof timeZone !== 'string' || timeZone.length > 64) return { template };
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return { template, timeZone };
  } catch {
    return { template };
  }
}

/** Makes `template`'s starter rules on the plan being created; answers how many it made. */
export async function makeStarterRules(
  ctx: PlanRouteContext,
  template: string,
  owner: string,
  timeZone = 'UTC',
): Promise<number> {
  const hook = ctx.env.AUTOMATIONS;
  if (!hasStarterRules(template) || !hook || !signedInCaller(ctx)) return 0;
  const by = await writer(ctx, owner);
  const stamp = { by, at: Date.now(), ...(ctx.token ? { ai: true as const } : {}) };
  const taken: { id: string; name: string }[] = hook.store.list();
  const rules = templateStarterRules(template, timeZone);
  for (const { body, on } of rules) {
    const rule: AutomationRule = {
      ...body,
      name: freeRuleName(body.name, taken),
      id: crypto.randomUUID(),
      enabled: on,
      made: stamp,
      edited: stamp,
    };
    hook.store.insert(rule);
    taken.push(rule);
  }
  console.info('[automations] starter rules', { template, made: rules.length });
  return rules.length;
}
