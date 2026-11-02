'use client';

// A board's selection (docs/specs/026-plan/plan-board.md "Several cards at once"; blueprint plan-board.md): the cards
// this person picked here, kept to the ones the board still draws, in reading order. Disabled (a Viewer, a board in a
// Dashboard slot, outside Plan mode) it holds nothing and every action does nothing.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BoardProjection } from '@liveplanner/items';
import { track } from '@/lib/telemetry';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import {
  NO_SELECTION,
  selectRange,
  selectionCountLabel,
  selectionOrder,
  selectionShown,
  toggleCard,
  type BoardSelection,
} from '@/components/plan/board-selection';

export type BoardSelectionApi = {
  ids: ReadonlySet<string>;
  // The selected cards in board reading order (what a group's move lands in).
  ordered: readonly string[];
  mode: boolean;
  toggle: (id: string) => void;
  range: (id: string) => void;
  // Select in a card's menu: select mode, with this card picked.
  start: (id: string) => void;
  clear: () => void;
};

export function useBoardSelection(opts: {
  projection: BoardProjection | null;
  enabled: boolean;
  // Whether a card may be picked (a face-down card may not).
  selectable: (id: string) => boolean;
  announce?: (message: string) => void;
}): BoardSelectionApi {
  const { projection, enabled, selectable, announce } = opts;
  const [raw, setRaw] = useState<BoardSelection>(NO_SELECTION);
  const sel = useMemo(
    () => (!enabled ? NO_SELECTION : projection ? selectionShown(projection, raw) : raw),
    [enabled, projection, raw],
  );
  const ordered = useMemo(
    () => (projection ? selectionOrder(projection, sel.ids) : []),
    [projection, sel.ids],
  );
  // What was pruned (a card gone, the board disabled) is let go of, so it does not come back: adjusted while rendering
  // (selectionShown answers the same object when nothing went, so this settles in one pass).
  if (sel !== raw) setRaw(sel);

  // The selection as last drawn, so a change reads it without re-making the actions each render.
  const selRef = useLatest(sel);
  const change = useCallback(
    (next: (s: BoardSelection) => BoardSelection) => {
      const s = selRef.current;
      const n = next(s);
      setRaw(n);
      if (n.ids.size === s.ids.size) return;
      if (s.ids.size === 0) track('Plan', 'Selected', 'Cards');
      announce?.(n.ids.size ? selectionCountLabel(n.ids.size) : 'Selection cleared');
    },
    [announce, selRef],
  );
  const toggle = useCallback(
    (id: string) => {
      if (enabled && selectable(id)) change((s) => toggleCard(s, id));
    },
    [enabled, selectable, change],
  );
  const range = useCallback(
    (id: string) => {
      if (!enabled || !projection || !selectable(id)) return;
      change((s) => {
        const next = selectRange(projection, s, id);
        return { ...next, ids: new Set([...next.ids].filter(selectable)) };
      });
    },
    [enabled, projection, selectable, change],
  );
  const start = useCallback(
    (id: string) => {
      if (!enabled || !selectable(id)) return;
      change((s) => ({ ids: new Set([...s.ids, id]), anchor: id, mode: true }));
    },
    [enabled, selectable, change],
  );
  const clear = useCallback(() => change(() => NO_SELECTION), [change]);

  // Escape clears the selection while there is one; a menu or dialog that took the key first keeps it.
  const has = sel.ids.size > 0;
  useEffect(() => {
    if (!has) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      clear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [has, clear]);

  return { ids: sel.ids, ordered, mode: sel.mode, toggle, range, start, clear };
}
