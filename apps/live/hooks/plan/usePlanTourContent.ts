'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { Tab } from '@livediagram/document';
import { itemStatus, type PlanBoardSetup } from '@livediagram/items';
import { useLatest } from '@/hooks/ui/useLatest';
import { debugLog } from '@/lib/debug-log';
import {
  EXAMPLE_MOVE_TO,
  exampleBoard,
  exampleCards,
  exampleStatus,
  readLeftover,
  writeLeftover,
  type PlanTourContent,
} from '@/lib/plan-tour';
import { waitUntil } from '@/lib/wait-until';
import type { PlanItems } from './usePlanItems';

// How long the card steps wait for the item store before they are skipped (DEFAULTS D28).
export const ITEMS_READY_WAIT_MS = 3000;

// The Plan tour's tour content (docs/specs/026-plan/plan-tour.md "Tour content", blueprint plan-tour.md):
// an example board and its example cards, placed, moved and taken away with no history (tickTabs and
// writeQuiet) and no telemetry, so Undo never brings them back and they never count as the person's
// work. What it made is held in a ref and in a leftover record, so a visit after a reload tidies what a
// cut-short tour left behind.
export function usePlanTourContent(opts: {
  documentId: string | null;
  hydrated: boolean;
  editsBlocked: boolean;
  activeId: string;
  tickTabs: (map: (tabs: Tab[]) => Tab[]) => void;
  planItems: Pick<PlanItems, 'items' | 'status' | 'writeQuiet'>;
}) {
  const liveRef = useLatest(opts);
  const contentRef = useRef<PlanTourContent | null>(null);
  const setupRef = useRef<PlanBoardSetup | null>(null);
  const cardsRef = useRef<Promise<boolean> | null>(null);

  const record = useCallback((content: PlanTourContent | null) => {
    contentRef.current = content;
    writeLeftover(content);
  }, []);

  const dropBoard = useCallback(
    (boardId: string) =>
      liveRef.current.tickTabs((tabs) =>
        tabs.some((t) => t.elements.some((el) => el.id === boardId))
          ? tabs.map((t) =>
              t.elements.some((el) => el.id === boardId)
                ? { ...t, elements: t.elements.filter((el) => el.id !== boardId) }
                : t,
            )
          : tabs,
      ),
    [liveRef],
  );

  const dropItems = useCallback(
    (itemIds: readonly string[]) => {
      const { items, writeQuiet } = liveRef.current.planItems;
      const present = itemIds.filter((id) => items.has(id));
      for (const id of present) void writeQuiet({ kind: 'delete', id });
      return present.length;
    },
    [liveRef],
  );

  // Places the example board in the middle of the view, once. Its id, or null while edits are blocked.
  const ensureBoard = useCallback(
    (centre: { x: number; y: number }): string | null => {
      const o = liveRef.current;
      if (contentRef.current) return contentRef.current.boardId;
      if (o.editsBlocked || !o.documentId) return null;
      const board = exampleBoard(centre);
      o.tickTabs((tabs) =>
        tabs.map((t) => (t.id === o.activeId ? { ...t, elements: [...t.elements, board] } : t)),
      );
      setupRef.current = board.planBoard;
      record({ documentId: o.documentId, boardId: board.id, itemIds: [] });
      debugLog('[plan-tour] content.placed', { boardId: board.id });
      return board.id;
    },
    [liveRef, record],
  );

  // Adds the example cards to the example board, once; false when they could not be made.
  const ensureCards = useCallback((): Promise<boolean> => {
    const content = contentRef.current;
    const setup = setupRef.current;
    if (!content || !setup || liveRef.current.editsBlocked) return Promise.resolve(false);
    if (content.itemIds.length > 0) return cardsRef.current ?? Promise.resolve(true);
    const run = (async () => {
      const ready = await waitUntil(
        () => liveRef.current.planItems.status === 'ready',
        ITEMS_READY_WAIT_MS,
      );
      if (!ready || contentRef.current !== content) return false;
      const creates = exampleCards(setup);
      // Recorded before the write, so a reload while it is in flight still tidies it.
      record({ ...content, itemIds: creates.map((c) => c.id!) });
      const ok = await liveRef.current.planItems.writeQuiet({ kind: 'create', creates });
      if (!ok) console.warn('[plan-tour] content.failed', { step: 'cards' });
      return ok;
    })();
    cardsRef.current = run;
    return run;
  }, [liveRef, record]);

  // Moves the first example card to In progress (a no-op once it is there).
  const moveFirstCard = useCallback(async (): Promise<void> => {
    const id = contentRef.current?.itemIds[0];
    const setup = setupRef.current;
    const to = setup ? exampleStatus(setup, EXAMPLE_MOVE_TO) : undefined;
    const item = id ? liveRef.current.planItems.items.get(id) : undefined;
    if (!id || !to || !item || itemStatus(item) === to) return;
    const ok = await liveRef.current.planItems.writeQuiet({
      kind: 'move',
      id,
      move: { status: to, before: null },
    });
    if (!ok) console.warn('[plan-tour] content.failed', { step: 'move' });
  }, [liveRef]);

  // Takes every piece of tour content away, however the tour ended.
  const removeAll = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    setupRef.current = null;
    cardsRef.current = null;
    record(null);
    const items = dropItems(content.itemIds);
    dropBoard(content.boardId);
    debugLog('[plan-tour] content.removed', { items });
  }, [dropBoard, dropItems, record]);

  // A tour cut short on an earlier visit (a reload, a closed window): its board goes once the document
  // has loaded, its cards once the item store has. Never what this visit's tour is showing.
  const sweptBoardRef = useRef(false);
  const sweptItemsRef = useRef(false);
  const { hydrated, documentId } = opts;
  const itemsReady = opts.planItems.status === 'ready';
  useEffect(() => {
    if (
      !hydrated ||
      !documentId ||
      (sweptBoardRef.current && (sweptItemsRef.current || !itemsReady))
    )
      return;
    const leftover = readLeftover();
    if (!leftover || leftover.documentId !== documentId) {
      sweptBoardRef.current = true;
      sweptItemsRef.current = true;
      return;
    }
    if (contentRef.current?.boardId === leftover.boardId) return;
    if (!sweptBoardRef.current) {
      sweptBoardRef.current = true;
      dropBoard(leftover.boardId);
    }
    if (itemsReady && !sweptItemsRef.current) {
      sweptItemsRef.current = true;
      const items = dropItems(leftover.itemIds);
      writeLeftover(null);
      debugLog('[plan-tour] content.swept', { items });
    }
  }, [hydrated, itemsReady, documentId, dropBoard, dropItems]);

  return {
    ensureBoard,
    ensureCards,
    moveFirstCard,
    removeAll,
    boardId: () => contentRef.current?.boardId ?? null,
    firstCardId: () => contentRef.current?.itemIds[0] ?? null,
    // The status the example board gave one of its Kanban columns.
    status: (column: string) =>
      (setupRef.current && exampleStatus(setupRef.current, column)) ?? null,
  };
}
