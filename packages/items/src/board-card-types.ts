// Which card types the boards on a tab take (docs/specs/026-plan/plan-mode.md "The palette"): a palette card tile
// no board would take is greyed out. A board takes the types its Card Types show (every type when it names none);
// an Archive board takes none.
import type { PlanBoardSetup } from './board';

export type CardTypesTaken =
  // No board on the tab at all.
  | { kind: 'none' }
  // Some board takes every type.
  | { kind: 'all' }
  // The boards take these types only (possibly none, when every board is an Archive board).
  | { kind: 'some'; types: ReadonlySet<string> };

export const NO_BOARD_CARD_REASON = 'Add a board first in order to use cards';

export function cardTypesTakenOnTab(
  setups: readonly (Pick<PlanBoardSetup, 'addTypes' | 'archive'> | null | undefined)[],
): CardTypesTaken {
  const boards = setups.filter((s): s is Pick<PlanBoardSetup, 'addTypes' | 'archive'> => !!s);
  if (boards.length === 0) return { kind: 'none' };
  const types = new Set<string>();
  for (const b of boards) {
    if (b.archive) continue;
    if (!b.addTypes) return { kind: 'all' };
    for (const t of b.addTypes) types.add(t);
  }
  return { kind: 'some', types };
}

// Why a card tile of `type` (named `label`) is greyed out, or null when some board on the tab takes it.
export function cardTileRefusal(taken: CardTypesTaken, type: string, label: string): string | null {
  if (taken.kind === 'none') return NO_BOARD_CARD_REASON;
  if (taken.kind === 'all' || taken.types.has(type)) return null;
  return `No board on this tab takes ${label} cards`;
}

// The same reading, as a stable key: the store publishes a new value only when this changes.
export function cardTypesTakenKey(taken: CardTypesTaken): string {
  return taken.kind === 'some' ? `some:${[...taken.types].sort().join(',')}` : taken.kind;
}
