// The plan room's tier (plan-tier.ts; docs/specs/026-plan/blueprints/automations.md "Tiers (Pro)"): the PlanTier on
// the room's own row and background work, and the two Automations limits it sets.
import { subscriptionClientOf } from '@liveworkspace/subscription';
import { AUTOMATION_RULES_MAX } from '@liveplanner/items';
import type { PlanRoom } from '../plan-room';
import { PlanTier, type TierHead } from './plan-tier';

type HeadRow = { owner_id: string | null; team_id: string | null; name: string | null };

// The plan's owner, team and name as its row holds them now: one synchronous read by its key.
function headOf(room: PlanRoom): TierHead | null {
  if (room.planId === null || !room.schemaReady) return null;
  const row = room.state.storage.sql
    .exec<HeadRow>('SELECT owner_id, team_id, name FROM plan WHERE id = ?', room.planId)
    .toArray()[0];
  if (!row?.owner_id) return null;
  return { ownerId: row.owner_id, teamId: row.team_id ?? null, name: row.name ?? '' };
}

export function roomTier(room: PlanRoom): PlanTier {
  return new PlanTier({
    client: () => (room.roomEnv ? subscriptionClientOf(room.roomEnv, 'liveplanner.app') : null),
    head: () => headOf(room),
    defer: (work) => room.state.waitUntil(work),
  });
}

// The plan's own fixed runs a day and rules (and Free's rules for a guest's plan): the shared engine's.
export { automationLimitsOf } from '@liveworkspace/automations/room';

// The most rules a copy or a file's plan keeps (automation-copy.ts): the plan's own fixed 50 on every tier (spec
// "Tiers"). The owner's total is not asked as the copy lands (it has no owner yet); the copy counts from its first
// change on.
export function rulesCopyMax(): number {
  return AUTOMATION_RULES_MAX;
}
