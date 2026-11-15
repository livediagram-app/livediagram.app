'use client';

// The board's filter as this viewer works it (docs/specs/026-plan/board-widgets.md "The board's filter"; blueprint
// board-widgets.md): the filter kept on the board, resolved for this viewer and today, and the one way to change it.
// Typing waits for a pause (BOARD_FILTER_TYPING_MS) before it is written, shown meanwhile from a local draft; anything
// else is written at once; a board that goes from the screen mid-word writes it then. Without `canChange` (a Viewer)
// it only reads.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BOARD_FILTER_TYPING_MS,
  boardFilterFrom,
  resolveBoardFilter,
  type BoardFilter,
  type QuickFilter,
} from '@liveplanner/items';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';

// Whether `next` differs from `now` only in its words: the change typing makes.
function onlyWords(now: QuickFilter, next: QuickFilter): boolean {
  const { text: _a, ...a } = now;
  const { text: _b, ...b } = next;
  return JSON.stringify(a) === JSON.stringify(b) && now.text !== next.text;
}

export function useBoardFilter({
  stored,
  mine,
  today,
  soonDays,
  finished,
  canChange,
  write,
}: {
  // The filter kept on the board set-up.
  stored: BoardFilter | undefined;
  // This viewer's person id (Only Mine), or null.
  mine: string | null;
  // Today's day number, and the Due Soon window's days.
  today: number;
  soonDays: number;
  // The board's done statuses (a Due Soon window leaves them out).
  finished: readonly string[];
  // An Editor's or a Participant's: a Viewer's board only reads.
  canChange: boolean;
  write: (filter: BoardFilter | undefined) => void;
}): { quick: QuickFilter; setQuick: (q: QuickFilter) => void; showAll: () => void } {
  // Resolved only when the filter, the viewer, the day or the done statuses change (the caller keeps `stored` and
  // `finished` by reference until they do), so the board's projection is not redone each render.
  const resolved = useMemo(
    () => resolveBoardFilter(stored, { mine, today, soonDays, finished: [...finished] }),
    [stored, mine, today, soonDays, finished],
  );
  // The words being typed, before they are written.
  const [draft, setDraft] = useState<QuickFilter | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<QuickFilter | null>(null);
  const writeRef = useLatest(write);

  const flush = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    const q = pending.current;
    pending.current = null;
    if (q) writeRef.current(boardFilterFrom(q));
    setDraft(null);
  }, [writeRef]);

  const quick = draft ?? resolved;
  const quickRef = useLatest(quick);
  const setQuick = useCallback(
    (next: QuickFilter) => {
      if (!canChange) return;
      if (onlyWords(quickRef.current, next)) {
        pending.current = next;
        setDraft(next);
        if (timer.current !== null) clearTimeout(timer.current);
        timer.current = setTimeout(flush, BOARD_FILTER_TYPING_MS);
        return;
      }
      pending.current = next;
      flush();
    },
    [canChange, quickRef, flush],
  );
  // Show All (FilterEmptyHint): a press, not typing, so the board's filter goes at once even when only words are left.
  const showAll = useCallback(() => {
    if (!canChange) return;
    pending.current = {};
    flush();
  }, [canChange, flush]);

  // A board that leaves the screen (a tab switch, a reload's unload) writes the words still waiting.
  useEffect(() => {
    // The refs themselves (stable for the board's life), read when it leaves.
    const waiting = timer;
    const words = pending;
    return () => {
      if (waiting.current === null) return;
      clearTimeout(waiting.current);
      waiting.current = null;
      const q = words.current;
      words.current = null;
      // oxlint-disable-next-line react-hooks/exhaustive-deps -- the latest write on purpose: the board's current one
      if (q) writeRef.current(boardFilterFrom(q));
    };
  }, [writeRef]);

  return { quick, setQuick, showAll };
}
