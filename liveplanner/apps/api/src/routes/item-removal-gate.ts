// The item routes' door to the room's mass-removal guard (docs/specs/012-collaboration/realtime-conflict-resolution.md
// "Mass card removals"; blueprint item-store.md "Mass removals"). Every write that deletes a card or moves one into
// the Trash asks here before it writes: admitted, it gets a ticket to give back the ids that did not land; held, it
// answers 409 `removal_held` and the write is kept in the room's quarantine log. One place, so a later door (Board
// Trash, Work Tracker 947) can ask the same way.
import {
  isTrashed,
  planOutline,
  removalBoardsOf,
  removalHeldMessage,
  type Item,
} from '@liveplanner/items';
import { listItems } from '../db';
import { json } from '../responses';
import type { RemovalActor } from '../plan-room/removal-guard-store';
import type { PlanRouteContext } from './context';
import { planTabs } from './plan-route';
import { writer, type ItemCaller } from './item-route-kit';

export type RemovalTicket = { release: (ids: readonly string[]) => void };

const NO_TICKET: RemovalTicket = { release: () => {} };

/** The cards a write moves into the Trash from outside it. */
export function trashedBy(writes: Iterable<{ before: Item; next: Item }>): string[] {
  const out: string[] = [];
  for (const { before, next } of writes)
    if (isTrashed(next) && !isTrashed(before)) out.push(next.id);
  return out;
}

// Who the run belongs to: the token, or the person as cards sign them (never their raw id).
async function actorOf(ctx: PlanRouteContext, caller: ItemCaller): Promise<RemovalActor> {
  if (ctx.token) return { kind: 'token', id: ctx.token.id };
  const by = await writer(ctx, caller.owner);
  return { kind: 'person', id: by.id, name: by.name };
}

/** A ticket for removing `ids`, or the 409 that holds them. */
export async function admitRemovals(
  ctx: PlanRouteContext,
  caller: ItemCaller,
  ids: readonly string[],
): Promise<RemovalTicket | Response> {
  const guard = ctx.env.REMOVAL_GUARD;
  if (!guard || ids.length === 0) return NO_TICKET;
  // A person's confirmed removal is not judged; a token's confirmation is ignored.
  if (!ctx.token && ctx.url.searchParams.get('confirmRemoval') === '1') {
    console.info('[items] removal.confirmed', { projectId: caller.projectId, count: ids.length });
    return NO_TICKET;
  }
  const actor = await actorOf(ctx, caller);
  const verdict = await guard.admit(actor, ids, async () => {
    const [tabs, items] = await Promise.all([
      planTabs(ctx, caller.projectId, null),
      listItems(ctx.env, caller.projectId),
    ]);
    return removalBoardsOf(planOutline(tabs, caller.doc?.itemTypes).boards, items);
  });
  if (!verdict) return { release: (gone) => guard.release(actor, gone) };
  await guard.quarantine(actor, verdict, ids);
  console.warn('[items] removal.held', {
    projectId: caller.projectId,
    reason: verdict.reason,
    had: verdict.had,
    count: verdict.count,
    limit: verdict.limit,
    named: ids.length,
    actor: actor.kind,
  });
  return json(
    {
      error: 'removal_held',
      reason: verdict.reason,
      board: verdict.board,
      count: verdict.count,
      limit: verdict.limit,
      message: removalHeldMessage(verdict),
    },
    { status: 409 },
  );
}
