// A GitHub rule's moves (docs/specs/026-plan/github-pull-requests.md "GitHub rules"; blueprint "Part 3"
// `github-moves.ts`): each linked card to the rule's column, keeping every rule a manual move keeps, by GitHub. A card
// gone, in the Trash, archived, already there, or of a type that leaves the column's status out stays put. Each move
// lands at its rev (read again on a lost race), reaches the room as an `items` op and the card's history as GitHub's,
// and raises the plan's Automations as any move does.
import {
  GITHUB_PERSON,
  ITEM_WRITE_RETRIES,
  applyMove,
  isArchived,
  isTrashed,
  itemStatus,
  planOutline,
  statusExcluded,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import { listItems, readItem, updateItemAtRev } from '../../db/items';
import { appendItemHistory } from '../../db/item-history';
import { planTabs } from '../../routes/plan-route';
import type { PlanEnv } from '../../types';

export type MoveDeps = {
  env: PlanEnv;
  planId: string;
  // Hands landed cards to the room.
  relay: (items: Item[], rev: number) => void;
};

type Outcome = 'moved' | 'stays' | 'busy';

// `board` holds the plan's cards as last read, for the move's place at the column's end: read once for every move a
// delivery makes, and again only after a lost race.
async function moveOne(
  deps: MoveDeps,
  types: readonly ItemTypeDef[],
  board: Map<string, Item>,
  cardId: string,
  target: string,
  now: number,
): Promise<Outcome> {
  const { env, planId } = deps;
  for (let attempt = 1; attempt <= ITEM_WRITE_RETRIES; attempt += 1) {
    if (attempt > 1) for (const i of await listItems(env, planId)) board.set(i.id, i);
    const before = await readItem(env, planId, cardId);
    if (!before || isTrashed(before) || isArchived(before) || itemStatus(before) === target)
      return 'stays';
    const next = applyMove(before, { status: target }, board.values(), { now, by: GITHUB_PERSON });
    if (statusExcluded(types, next, before, false)) return 'stays';
    const rev = await updateItemAtRev(env, planId, next, before.rev);
    if (rev === null) continue;
    board.set(next.id, next);
    deps.relay([next], rev);
    await appendItemHistory(env, planId, [{ before, after: next }], 'github', { role: 'system' });
    return 'moved';
  }
  return 'busy';
}

/** The cards moved to `target`, a status a board of the plan names; one that no board names any longer moves none. */
export async function moveForRule(
  deps: MoveDeps,
  types: readonly ItemTypeDef[],
  target: string,
  cardIds: readonly string[],
  now: number,
): Promise<number> {
  if (cardIds.length === 0) return 0;
  const { statuses } = planOutline(await planTabs({ env: deps.env }, deps.planId, null), null);
  if (!statuses.some((s) => s.status === target)) {
    console.info('[github] rule.unplaced', { cards: cardIds.length });
    return 0;
  }
  const board = new Map((await listItems(deps.env, deps.planId)).map((i) => [i.id, i]));
  const counts = { moved: 0, stays: 0, busy: 0 };
  for (const id of cardIds) counts[await moveOne(deps, types, board, id, target, now)] += 1;
  console.info('[github] moved', counts);
  return counts.moved;
}
