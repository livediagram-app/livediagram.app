'use client';

// A Plan board's cards on the move (docs/specs/025-plan/plan-board.md "Moving cards"): the drag that
// picks its own cards up, the drop that files a card in one of its cells, and the board as a target
// for cards dragged over from another board (plan-board-targets.ts). A card dropped on the canvas
// leaves a Plan card there.
import { useEffect, useState } from 'react';
import type { ShapeElement } from '@livediagram/document';
import {
  isArchived,
  placeWidget,
  typeIn,
  widgetsOf,
  type BoardProjection,
  type BoardWidgetKind,
  type Item,
  type PlanBoardSetup,
} from '@livediagram/items';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { boardMoveFor, cellStatus, laneMove } from '@/components/plan/plan-board-moves';
import { useLatest } from '@/hooks/ui/useLatest';
import {
  registerPlanBoardTarget,
  type PlanIncoming,
  type WidgetPlaced,
} from './plan-board-targets';

// How long a widget the board already has flashes when it is placed again.
export const WIDGET_FLASH_MS = 1400;
import { BOARD_WIDGET_INFO } from '@/components/plan/board-widget-catalogue';
import { trackSetup } from '@/components/plan/track-board-setup';
import { track } from '@/lib/telemetry';
import { usePlanCardDrag, type PlanDropSlot } from './usePlanCardDrag';

export function usePlanBoardDrop(opts: {
  element: ShapeElement;
  boardRef: React.RefObject<HTMLElement | null>;
  plan: PlanContextValue | undefined;
  setup: PlanBoardSetup | null;
  projection: BoardProjection | null;
  items: ReadonlyMap<string, Item>;
  interactive: boolean;
  canEdit: boolean;
}) {
  const { element, boardRef, plan, setup, projection, items, interactive, canEdit } = opts;
  // A card dragged here from another board, and the slot it would land in.
  const [incoming, setIncoming] = useState<PlanIncoming | null>(null);

  const drop = (itemId: string, slot: PlanDropSlot) => {
    if (!plan || !setup || !projection) return;
    const item = items.get(itemId);
    // An Archive board (docs/specs/025-plan/items.md "Archive"): a card dropped on it is archived, its
    // status kept for when it comes back; its own cards stay in their order.
    if (setup.archive) {
      if (!item || isArchived(item)) return;
      plan.patchItem(itemId, { set: { archived: true } });
      plan.announce('Card archived');
      track('Plan', 'Moved', 'Archive');
      return;
    }
    const move = boardMoveFor(setup, projection, item, itemId, slot);
    if (!move) return;
    plan.moveItem(itemId, move);
    // Off an Archive board onto another: it comes back.
    if (item && isArchived(item)) {
      plan.patchItem(itemId, { clear: ['archived'] });
      track('Plan', 'Restored', 'Card');
    }
    const column = setup.columns.find((c) => c.status === slot.status);
    plan.announce(`Moved to ${column?.name ?? slot.status}`);
  };

  const drag = usePlanCardDrag({
    boardRef,
    boardId: element.id,
    enabled: interactive && canEdit,
    onClick: (id) => plan?.openItem(id),
    onDrop: drop,
    onDropOutside: (id, clientX, clientY) => {
      const rect = boardRef.current?.getBoundingClientRect();
      if (!rect || !plan) return;
      const scale = element.width / rect.width;
      plan.placeCardOut(
        id,
        element.x + (clientX - rect.left) * scale,
        element.y + (clientY - rect.top) * scale,
      );
      plan.announce('Card placed on the canvas');
    },
    onRefused: (message) => plan?.announce(message),
    onDragging: (id) => plan?.setDragging(id),
  });

  // The handlers read this render's board; the registration lasts as long as the board's element.
  const target = useLatest({
    accepts: (itemId: string) => {
      const item = items.get(itemId);
      return !!setup && !!item && canEdit;
    },
    refusal: () =>
      setup?.archive ? 'An Archive board takes cards moved to it' : 'This board can’t be changed',
    drop,
    // Every board shows every card type (docs/specs/025-plan/plan-board.md).
    // An Archive board takes cards moved to it, never a new one.
    acceptsType: (_type: string) => !!setup && canEdit && !setup.archive,
    // A palette card: a new item of the type at the slot, its row's field set. Not opened: the card is
    // there to see, and a click opens it.
    addCard: (type: string, slot: PlanDropSlot) => {
      if (!plan || !setup || !projection) return;
      const def = typeIn(plan.types, type);
      const lane = projection.lanes.find((l) => l.key === slot.laneKey);
      const set = setup.swimlaneBy !== 'none' ? laneMove(lane) : {};
      plan.addItem({
        type: def.id,
        fields: { title: def.newTitle, ...(set.set ?? {}) },
        status: cellStatus(setup, slot.status, lane),
        after: null,
        before: slot.beforeId,
      });
      const column = setup.columns.find((c) => c.status === slot.status);
      plan.announce(`${def.label} added to ${column?.name ?? slot.status}`);
    },
    canEditWidgets: () => !!setup && canEdit,
    // A palette widget placed in the header (docs/specs/025-plan/board-widgets.md): one board edit.
    placeWidget: (kind: BoardWidgetKind, slot: number, opts?: { tap?: boolean }): WidgetPlaced => {
      if (!plan || !setup || !canEdit) return 'refused';
      const label = BOARD_WIDGET_INFO[kind].label;
      const before = widgetsOf(setup);
      const had = before.includes(kind);
      // A board holds each widget once: the one it has flashes, so it is found rather than missed.
      if (had) setFlashWidget((prev) => ({ kind, at: (prev?.at ?? 0) + 1 }));
      if (had && opts?.tap) return 'already';
      const next = placeWidget(before, kind, slot);
      if (next.join() === before.join()) return 'already';
      plan.updateBoard(element.id, { ...setup, widgets: next });
      trackSetup('Widgets');
      plan.announce(had ? `${label} moved` : `${label} added to the board`);
      return had ? 'moved' : 'added';
    },
  });
  const [widgetSlot, setWidgetSlot] = useState<number | null>(null);
  // The widget a placement found already there, flashed for a moment.
  const [flashWidget, setFlashWidget] = useState<{ kind: BoardWidgetKind; at: number } | null>(
    null,
  );
  useEffect(() => {
    if (!flashWidget) return;
    const t = window.setTimeout(() => setFlashWidget(null), WIDGET_FLASH_MS);
    return () => window.clearTimeout(t);
  }, [flashWidget]);
  useEffect(
    () =>
      registerPlanBoardTarget(element.id, {
        accepts: (id) => target.current.accepts(id),
        refusal: () => target.current.refusal(),
        drop: (id, slot) => target.current.drop(id, slot),
        hover: setIncoming,
        acceptsType: (type) => target.current.acceptsType(type),
        addCard: (type, slot) => target.current.addCard(type, slot),
        canEditWidgets: () => target.current.canEditWidgets(),
        widgetHover: setWidgetSlot,
        placeWidget: (kind, slot, opts) => target.current.placeWidget(kind, slot, opts),
      }),
    [element.id, target],
  );

  return { drag, incoming, drop, widgetSlot, flashWidget: flashWidget?.kind ?? null };
}
