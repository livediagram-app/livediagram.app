'use client';

// Tidies what an older Plan tour left behind (docs/specs/026-plan/plan-tour.md): the tour once placed an example
// board or Sheet and example cards, recording them, and a tour cut short (a reload, a closed window) left them on the
// project. On the next visit to that project its board or Sheet goes once the project has loaded, its cards once
// the item store has, with no history (tickTabs, writeQuiet), so Undo never brings them back. The tour today runs on
// the person's own board or Sheet and places nothing.
import { useEffect, useRef, useState } from 'react';
import type { Tab } from '@liveplanner/project';
import { useLatest } from '@/hooks/ui/useLatest';
import { debugLog } from '@/lib/debug-log';
import { readLeftover, writeLeftover } from '@/lib/plan-tour';
import type { PlanItems } from './usePlanItems';

// How long a leftover sheet waits before asking the sheets again, while no Sheet has drawn to take it: a check a
// couple of seconds apart costs nothing, and the sheet goes soon after the first Sheet draws.
export const LEFTOVER_SHEET_RETRY_MS = 2000;

export function usePlanTourLeftovers(opts: {
  projectId: string | null;
  hydrated: boolean;
  tickTabs: (map: (tabs: Tab[]) => Tab[]) => void;
  planItems: Pick<PlanItems, 'items' | 'status' | 'writeQuiet'>;
  // Deletes sheets with their elements (the sheets bridge); false before any Sheet has drawn to take it.
  releaseSheets: (sheetIds: readonly string[]) => boolean;
}): void {
  const liveRef = useLatest(opts);
  const sweptBoardRef = useRef(false);
  const sweptItemsRef = useRef(false);
  const warnedRef = useRef(false);
  // Bumped to try a leftover sheet again (no Sheet had drawn to take it).
  const [attempt, setAttempt] = useState(0);
  const { hydrated, projectId } = opts;
  const itemsReady = opts.planItems.status === 'ready';
  useEffect(() => {
    if (
      !hydrated ||
      !projectId ||
      (sweptBoardRef.current && (sweptItemsRef.current || !itemsReady))
    )
      return;
    const leftover = readLeftover();
    if (!leftover || leftover.projectId !== projectId) {
      sweptBoardRef.current = true;
      sweptItemsRef.current = true;
      return;
    }
    const live = liveRef.current;
    let retry: number | undefined;
    if (!sweptBoardRef.current) {
      const { elementId, sheetId } = leftover;
      // A sheet goes with its element, never the element alone (that would orphan the sheet): until a Sheet has drawn
      // to take it, both stay, and the record with them, and it is tried again shortly.
      if (sheetId && !live.releaseSheets([sheetId])) {
        if (!warnedRef.current) {
          warnedRef.current = true;
          console.warn('[plan-tour] content.failed', { step: 'sheet' });
        }
        retry = window.setTimeout(() => setAttempt((n) => n + 1), LEFTOVER_SHEET_RETRY_MS);
      } else {
        sweptBoardRef.current = true;
        live.tickTabs((tabs) =>
          tabs.some((t) => t.elements.some((el) => el.id === elementId))
            ? tabs.map((t) =>
                t.elements.some((el) => el.id === elementId)
                  ? { ...t, elements: t.elements.filter((el) => el.id !== elementId) }
                  : t,
              )
            : tabs,
        );
      }
    }
    if (itemsReady && !sweptItemsRef.current) {
      sweptItemsRef.current = true;
      const { items, writeQuiet } = live.planItems;
      const present = leftover.itemIds.filter((id) => items.has(id));
      for (const id of present) void writeQuiet({ kind: 'delete', id });
      debugLog('[plan-tour] content.swept', { items: present.length });
    }
    // The record goes once everything it names has.
    if (sweptBoardRef.current && sweptItemsRef.current) writeLeftover(null);
    return () => window.clearTimeout(retry);
  }, [hydrated, itemsReady, projectId, liveRef, attempt]);
}
