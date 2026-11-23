// What an Automations answer says of the plan's tier (docs/specs/026-plan/automations.md "Tiers"; blueprint
// automations.md "Tiers (Pro)"): the plan's own fixed bounds and its owner, the owner's rule total asked and told to
// the subscription service as rules are added and deleted, and the owner's month of runs refused. With Pro off only
// the fixed bounds hold and nothing is said or sent.
//
// Who is told what (019 "What a collaborator is told"): the plan's own bounds are every Editor's; the owner's
// figures are the owner's and the owning team's alone (their summary); a guest's plan names no owner, and says it is a
// guest's.
import type { AutomationsListResponse } from '@liveplanner/api-schema';
import {
  listTier as sharedListTier,
  recountRules,
  rulesAtLimit,
  rulesOverLimit,
  runsUsedBody,
  type RulesFull,
} from '@liveworkspace/automations/room';
import type { AutomationStore } from '../plan-room/automations/automation-store';
import type { PlanTier } from '../plan-room/tier/plan-tier';

type ListTier = Pick<AutomationsListResponse, 'runsPerDay' | 'rulesMax' | 'owner' | 'guest'>;

// The shared engine's (@liveworkspace/automations/room tier.ts), in the plan's wire type.
export function listTier(store: AutomationStore, tier: PlanTier | null): ListTier {
  return sharedListTier(store, tier);
}

export { recountRules, rulesAtLimit, rulesOverLimit, runsUsedBody, type RulesFull };
