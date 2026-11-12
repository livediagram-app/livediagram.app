// Who made a route's write, as a plan's rules read it (docs/specs/026-plan/automations.md "Conditions", "Triggers";
// blueprint automations.md "The event"): an API token is an agent, a grant that may edit (a tab's or the whole
// plan's) an Editor, anyone else a Participant. Worked out only when the write makes an event some rule hears, so a
// plan without a rule that is on pays nothing for it. Also a new comment's event, queued when a rule hears comments.
import { levelAtLeast } from '@liveplanner/api-schema';
import type { CommentMention } from '@liveplanner/project';
import { itemPersonId, type AutomationRole } from '@liveplanner/items';
import { openCommentCountsOfItems } from '../db/card-threads';
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
  mentions?: readonly CommentMention[],
): Promise<void> {
  if (!ctx.env.AUTOMATIONS?.kinds.has('comment')) return;
  // The card person ids it @mentions (Someone Mentioned), from the mentioned accounts.
  const mentioned = await Promise.all(
    (mentions ?? []).flatMap((m) => (m.userId ? [itemPersonId(m.userId)] : [])),
  );
  await enqueueComment(ctx.env, {
    id: `c:${commentId}`,
    cardId,
    by: await writer(ctx, owner),
    role: roleOf(ctx, projectId),
    ...(mentioned.length ? { mentioned } : {}),
  });
}

// A resolve that left a card of this plan with no open thread: All Threads Resolved, when a rule hears it.
export async function queueResolved(
  ctx: PlanRouteContext,
  projectId: string,
  cardIds: readonly string[],
  owner: string,
  threadId: string,
  // The thread's comment count: a second resolve with nothing new said makes the same event, so runs once.
  comments: number,
): Promise<void> {
  if (!ctx.env.AUTOMATIONS?.kinds.has('resolved')) return;
  const open = await openCommentCountsOfItems(ctx.env, projectId, cardIds, threadId);
  for (const cardId of cardIds) {
    if ((open.get(cardId) ?? 0) > 0) continue;
    await enqueueComment(
      ctx.env,
      {
        id: `r:${threadId}:${cardId}:${comments}`,
        cardId,
        by: await writer(ctx, owner),
        role: roleOf(ctx, projectId),
      },
      'resolved',
    );
  }
}
