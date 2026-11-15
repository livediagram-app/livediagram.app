// The board's set-up as its cards are drawn and counted from (docs/specs/026-plan/board-widgets.md "The board's
// filter"; blueprint "Performance and limits"): the set-up WITHOUT its filter, one object while nothing else in it
// changes. The filter is kept on the set-up, so a filter change (a teammate's arrives as a whole new set-up, parsed off
// the wire) made every projection, every widget count and every card's shared props anew; read through this, only the
// filtered projection is. Matched by value (a JSON key of a few columns and fields), so a set-up equal in all but its
// filter keeps its identity whichever object it arrived in. Never write it back: it has no filter (the full set-up
// is what every set-up change starts from).
import { useMemo } from 'react';
import type { PlanBoardSetup } from '@liveplanner/items';

export function drawnSetupKey(setup: PlanBoardSetup | null): string | null {
  if (!setup) return null;
  const { filter: _filter, ...rest } = setup;
  return JSON.stringify(rest);
}

export function useDrawnSetup(setup: PlanBoardSetup | null): PlanBoardSetup | null {
  const key = drawnSetupKey(setup);
  // A normalised set-up is plain JSON (strings, numbers, booleans, arrays of them), so it round-trips whole.
  return useMemo(() => (key === null ? null : (JSON.parse(key) as PlanBoardSetup)), [key]);
}
