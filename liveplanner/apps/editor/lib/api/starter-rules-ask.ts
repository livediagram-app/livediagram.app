// A create's ask for its template's starter rules (docs/specs/026-plan/plan-templates.md "Starter rules";
// docs/specs/015-api/api.md POST /api/projects `starterRules`), in the person's time zone.
import { hasStarterRules } from '@liveplanner/templates';

export type StarterRulesAsk = { template: string; timeZone: string };

/** The ask for `kind`'s starter rules, or undefined for a template with none (or no template). */
export function starterRulesAskOf(kind: string | null | undefined): StarterRulesAsk | undefined {
  if (!kind || !hasStarterRules(kind)) return undefined;
  return { template: kind, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
}
