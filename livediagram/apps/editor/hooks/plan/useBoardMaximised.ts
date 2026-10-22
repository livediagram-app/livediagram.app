'use client';

// How a board is drawn over the canvas (docs/specs/026-plan/plan-board.md "Maximised board", "Fill Tab"): maximised
// for this person (the module store), or filling its tab for everyone (its set-up's Fill Tab, the first such board on
// the tab). Filling wins: it ends a maximise this person had on the board, and a filled board has no Maximise/Restore
// and no Escape to restore.
import { useEffect } from 'react';
import { releasePlanElement, useMaximisedPlanId } from './maximised-plan';
import { useFillsTab } from './plan-cover-store';
import { useMaximisedPlanLifetime } from '@/components/plan/MaximisedPlanLayer';

export function useBoardMaximised(
  id: string,
  interactive: boolean,
): { maximised: boolean; filled: boolean } {
  const storeMaximised = useMaximisedPlanId() === id;
  const filled = useFillsTab(id);
  useEffect(() => {
    if (filled && storeMaximised) releasePlanElement(id);
  }, [filled, storeMaximised, id]);
  useMaximisedPlanLifetime(id, storeMaximised && !filled, interactive);
  return { maximised: storeMaximised && !filled, filled };
}
