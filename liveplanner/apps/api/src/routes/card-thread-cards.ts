// A card coming and going, as its comment threads see it (docs/specs/026-plan/items.md "Cards coming and going",
// blueprint item-store.md "REST"): a card deleted for good comes off every thread it was on (a thread on no other
// card goes with it), and a card put back (an Editor's undo of that delete, an offline plan's sync) goes back on the
// threads its create carries, each checked as a restore.

import { readRestoredThread, type CardThread, type ThreadChange } from '@liveplanner/project';
import type { Item } from '@liveplanner/items';
import { insertLinkStatement, linksOfItem, readThread, type ThreadLink } from '../db/card-threads';
import { planRoom } from '../plan-client';
import {
  SYSTEM_ACTOR,
  insertThread,
  linkThread,
  writeThread,
  type ThreadWriteResult,
} from '../plan-room/card-thread-store';
import type { PlanRouteContext } from './context';

const defer = (ctx: PlanRouteContext) => (p: Promise<unknown>) => {
  if (ctx.waitUntil) ctx.waitUntil(p);
  else void p;
};

// A card-list change the plan itself makes, on the thread's home, through a plan listing one of its cards.
function cardChange(
  ctx: PlanRouteContext,
  here: string,
  home: string,
  threadId: string,
  change: ThreadChange,
  via: string,
): Promise<ThreadWriteResult> {
  const op = { kind: 'change' as const, change, actor: SYSTEM_ACTOR };
  return home === here
    ? writeThread(ctx.env, home, threadId, op, via, defer(ctx))
    : planRoom(ctx.env, home).threadWrite(threadId, op, via);
}

/** The links of a card about to be deleted: read before the row goes (its trigger takes them). */
export function threadLinksOf(ctx: PlanRouteContext, projectId: string, itemId: string) {
  return linksOfItem(ctx.env, projectId, itemId);
}

/** A card deleted for good: off each thread it was on. Each failure is logged; the thread's next relay here finds
 *  no link and takes the card off then (card-thread-store.ts `dropPlanCards`). */
export async function cardLeftThreads(
  ctx: PlanRouteContext,
  projectId: string,
  itemId: string,
  links: readonly ThreadLink[],
): Promise<void> {
  for (const link of links) {
    try {
      const out = await cardChange(
        ctx,
        projectId,
        link.home,
        link.threadId,
        { kind: 'removeCard', projectId, itemId },
        projectId,
      );
      if (!out.ok && out.error !== 'unchanged' && out.error !== 'thread_not_found')
        console.warn('[threads] card.leave.failed', { error: out.error });
    } catch (err) {
      console.warn('[threads] card.leave.failed', { error: String(err) });
    }
  }
  if (links.length) console.info('[threads] card.left', { threads: links.length });
}

/** The threads a create carries, each as a restore reads it: the list, or null when one is not a thread. */
export function readRestoredThreads(raw: unknown, owner: string): CardThread[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 50) return null;
  const out: CardThread[] = [];
  for (const entry of raw) {
    const t = readRestoredThread(entry, owner);
    if (!t) return null;
    out.push(t);
  }
  return out;
}

/** A card put back on the threads its create carried. A thread this plan stores and still holds takes the card back;
 *  one it no longer holds comes back whole, on this card; another plan's is asked back through its home, and left
 *  out when that home no longer holds it. */
export async function cardBackOnThreads(
  ctx: PlanRouteContext,
  projectId: string,
  item: Item,
  threads: readonly CardThread[],
): Promise<void> {
  const card = { projectId, itemId: item.id, key: item.key };
  for (const t of threads) {
    try {
      if (t.home === projectId) {
        const held = await readThread(ctx.env, projectId, t.id);
        if (!held) {
          await insertThread(ctx.env, { ...t, cards: [card], rev: t.rev + 1 }, defer(ctx));
          continue;
        }
        const via = held.cards[0]?.projectId ?? projectId;
        const out = await cardChange(
          ctx,
          projectId,
          projectId,
          t.id,
          { kind: 'addCard', card },
          via,
        );
        if (out.ok || out.error === 'thread_on_card') await linked(ctx, projectId, t, held, item);
        continue;
      }
      // Another plan's thread: its home must still hold it, through a plan it is still on.
      const via = t.cards.find((c) => c.projectId !== projectId)?.projectId ?? t.home;
      const link = await linkThread(ctx.env, projectId, {
        threadId: t.id,
        home: t.home,
        itemId: item.id,
        openComments: t.resolved ? 0 : t.comments.length,
      });
      if (!link.ok) continue;
      const out = await cardChange(ctx, projectId, t.home, t.id, { kind: 'addCard', card }, via);
      if (!out.ok && out.error !== 'thread_on_card') {
        console.info('[threads] restore.dropped', { error: out.error });
        await ctx.env.PLAN_DB.prepare(
          'DELETE FROM card_thread_links WHERE plan_id = ? AND thread_id = ? AND item_id = ?',
        )
          .bind(projectId, t.id, item.id)
          .run();
      }
    } catch (err) {
      console.warn('[threads] restore.failed', { error: String(err) });
    }
  }
}

// This plan's own link for a thread it stores, once the thread lists the card again.
async function linked(
  ctx: PlanRouteContext,
  projectId: string,
  t: CardThread,
  held: CardThread,
  item: Item,
): Promise<void> {
  await insertLinkStatement(ctx.env, projectId, {
    itemId: item.id,
    threadId: t.id,
    home: projectId,
    openComments: held.resolved ? 0 : held.comments.length,
  }).run();
}
