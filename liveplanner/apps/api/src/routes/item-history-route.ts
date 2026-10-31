// A card's history (docs/specs/026-plan/items.md "History", blueprint item-store.md "History"): GET
// /items/:itemId/history for anyone who may read the card, and the tag each card write's entry carries. The entries
// are grouped and redacted here: an author's id reaches only the author (`mine`), as a comment's does.

import type { ItemHistoryResponse } from '@liveplanner/api-schema';
import {
  groupHistory,
  historyForReader,
  itemPersonId,
  type ItemHistoryTag,
} from '@liveplanner/items';
import { readItem } from '../db';
import { readItemHistory } from '../db/item-history';
import { json, methodNotAllowed } from '../responses';
import type { PlanRouteContext } from './context';
import { itemCaller, itemNotFound } from './item-route-kit';

// How a write's entry is tagged: an undo or redo (the body's `undo`, or a create that restores a card) before an
// agent's (an API token's), so an agent's undo, were it ever sent, reads as the undo it is.
export function historyTagOf(ctx: PlanRouteContext, undo: boolean): ItemHistoryTag | undefined {
  if (undo) return 'undo';
  return ctx.token !== null ? 'ai' : undefined;
}

export async function itemHistory(
  ctx: PlanRouteContext,
  projectId: string,
  itemId: string,
): Promise<Response> {
  if (ctx.request.method !== 'GET') return methodNotAllowed();
  const caller = await itemCaller(ctx, projectId, 'read');
  if (caller instanceof Response) return caller;
  if (caller.scope && !caller.scope.has(itemId)) return itemNotFound();
  if (!(await readItem(ctx.env, projectId, itemId))) return itemNotFound();
  const stored = await readItemHistory(ctx.env, projectId, itemId, Date.now());
  const entries = historyForReader(groupHistory(stored), await itemPersonId(caller.owner));
  console.info('[items] history.read', { projectId, entries: entries.length });
  const answer: ItemHistoryResponse = { entries };
  return json(answer);
}
