// The limit on mass card removals (docs/specs/012-collaboration/realtime-conflict-resolution.md "Mass card removals";
// blueprint item-store.md "Mass removals"): how many cards one caller's run of deletes and Trash moves may take off a
// board before the server holds it. Pure: the api's guard judges with it, and the editor can ask the same question
// before it sends a bulk removal.
import { isArchived, isTrashed } from './board-model';
import { itemStatus, type Item } from './item';
import type { PlanBoardOutline } from './plan-outline';

// Spec "The limit": the share of a board's cards a run may take, its cap, and the floor under which a run is never
// held. Safe ranges 0.1..0.5, 20..200 and 5..25.
export const REMOVAL_GUARD_SHARE = 0.2;
export const REMOVAL_GUARD_MAX = 50;
export const REMOVAL_GUARD_FLOOR = 10;
// Spec "Emptying a board": a board this size or larger is never emptied in one run. Safe range 2..5.
export const REMOVAL_GUARD_EMPTY_MIN = 3;
// Spec "A run": removals less than this far apart are one run. Safe range 10 s..5 min.
export const REMOVAL_GUARD_WINDOW_MS = 60_000;

// A board as the guard counts it: the cards it showed as the run began.
export type RemovalBoard = { id: string; name: string; cards: ReadonlySet<string> };

export type RemovalVerdict = {
  reason: 'over-threshold' | 'empties-board';
  board: string;
  // How many of the board's cards the run would have removed, and how many it may.
  count: number;
  had: number;
  limit: number;
};

/** How many of a board's `had` cards one run may remove. */
export function removalLimit(had: number): number {
  return Math.max(
    REMOVAL_GUARD_FLOOR,
    Math.min(Math.floor(had * REMOVAL_GUARD_SHARE), REMOVAL_GUARD_MAX),
  );
}

// Whether a board shows the card: a live card (not archived, not in the Trash) of a type it takes, in one of its
// columns (an All Cards board, any live card).
function shows(board: PlanBoardOutline, statuses: ReadonlySet<string>, item: Item): boolean {
  if (isTrashed(item) || isArchived(item)) return false;
  if (board.types && !board.types.includes(item.type)) return false;
  if (board.kind === 'all-cards') return true;
  const status = itemStatus(item);
  return status !== undefined && statuses.has(status);
}

/** The plan's boards with the cards each shows; an Archive board counts none. O(boards x cards). */
export function removalBoardsOf(
  boards: readonly PlanBoardOutline[],
  items: readonly Item[],
): RemovalBoard[] {
  const out: RemovalBoard[] = [];
  for (const board of boards) {
    if (board.kind === 'archive') continue;
    const statuses = new Set(board.columns.map((c) => c.status));
    const cards = new Set<string>();
    for (const item of items) if (shows(board, statuses, item)) cards.add(item.id);
    out.push({ id: board.elementId, name: board.title || board.tabName, cards });
  }
  return out;
}

/** The first board the run's removals (`removed`, every card it would have taken) go past the limit on, or null. */
export function judgeRemoval(
  boards: readonly RemovalBoard[],
  removed: ReadonlySet<string>,
): RemovalVerdict | null {
  for (const board of boards) {
    const had = board.cards.size;
    if (had === 0) continue;
    let count = 0;
    for (const id of removed) if (board.cards.has(id)) count += 1;
    const limit = removalLimit(had);
    if (count >= had && had >= REMOVAL_GUARD_EMPTY_MIN)
      return { reason: 'empties-board', board: board.name, count, had, limit };
    if (count > limit) return { reason: 'over-threshold', board: board.name, count, had, limit };
  }
  return null;
}

/** What a held removal says, so a script or an agent can tell the person why. */
export function removalHeldMessage(v: RemovalVerdict): string {
  const what =
    v.reason === 'empties-board'
      ? `This would remove every card on ${v.board}`
      : `This would remove ${v.count} of the ${v.had} cards on ${v.board} at once`;
  return `${what}, so it was held. Confirm it in liveplanner to go ahead.`;
}
