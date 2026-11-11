// Who made a route's write, as a plan's rules read it (docs/specs/026-plan/automations.md "Conditions", "Triggers";
// blueprint automations.md "The event"): an API token is an agent, a grant that may edit (a tab's or the whole
// plan's) an Editor, anyone else a Participant. Worked out only when the write makes an event some rule hears, so a
// plan without a rule that is on pays nothing for it. Also a new comment's event, queued when a rule hears comments.
import { levelAtLeast } from '@liveplanner/api-schema';
import type { AutomationRole } from '@liveplanner/items';
import { enqueueComment, type HistorySource } from '../plan-room/automations/automation-queue';
import { grantOn, type PlanRouteContext } from './context';
import { writer } from './item-route-kit';

function roleOf(ctx: PlanRouteContext, projectId: string): AutomationRole {
  if (ctx.token) return 'agent';
  const grant = grantOn(ctx, projectId);
  return grant && levelAtLeast(grant.role, 'edit') ? 'editor' : 'participant';
}

export function writeSource(ctx: PlanRouteContext, projectId: string): HistorySource {
  return { role: () => Promise.resolve(roleOf(ctx, projectId)) };
}

// A comment someone (never Automation) added on a card of this plan: a Comment Added trigger, when a rule hears one.
export async function queueComment(
  ctx: PlanRouteContext,
  projectId: string,
  cardId: string,
  owner: string,
  commentId: string,
): Promise<void> {
  if (!ctx.env.AUTOMATIONS?.kinds.has('comment')) return;
  await enqueueComment(ctx.env, {
    id: `c:${commentId}`,
    cardId,
    by: await writer(ctx, owner),
    role: roleOf(ctx, projectId),
  });
}
