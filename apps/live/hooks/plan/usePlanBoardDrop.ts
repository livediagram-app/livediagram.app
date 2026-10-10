'use client';

// A Plan board's cards on the move (docs/specs/026-plan/plan-board.md "Moving cards"): the drag that
// picks its own cards up, the drop that files a card in one of its cells, and the board as a target
// for cards dragged over from another board (plan-board-targets.ts). A card dropped on the canvas
// leaves a Plan card there.
import { useEffect, useRef, useState } from 'react';
import type { ShapeElement } from '@livediagram/document';
import {
  ARCHIVED_FIELD,
  boardAddTypes,
  boardShowsType,
  isArchived,
  placeWidget,
  typeIn,
  widgetsOf,
  type BoardProjection,
  type BoardWidgetKind,
  type Item,
  type PlanBoardSetup,
  newItemId,
} from '@livediagram/items';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { boardMoveFor, cellStatus, laneMove } from '@/components/plan/plan-board-moves';
import { moveStatusRefusal } from './status-refusal';
import { useLatest } from '@/hooks/ui/useLatest';
import {
  registerPlanBoardTarget,
  sameIncoming,
  type PlanIncoming,
  type WidgetPlaced,
} from './plan-board-targets';

// How long a widget the board already has flashes when it is placed again.
export const WIDGET_FLASH_MS = 1400;
import { BOARD_WIDGET_INFO } from '@/components/plan/board-widget-catalogue';
import { trackSetup } from '@/components/plan/track-board-setup';
import { track } from '@/lib/telemetry';
import { usePlanCardDrag, type PlanDropSlot } from './usePlanCardDrag';

// "A, B and C".
function listOf(names: readonly string[]): string {
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function usePlanBoardDrop(opts: {
  element: ShapeElement;
  boardRef: React.RefObject<HTMLElement | null>;
  plan: PlanContextValue | undefined;
  setup: PlanBoardSetup | null;
  projection: BoardProjection | null;
  items: ReadonlyMap<string, Item>;
  interactive: boolean;
  // The board's structure (its widgets).
  canEdit: boolean;
  // Moving and dropping cards (docs/specs/013-workspace/share-roles.md): an Editor's and a Participant's.
  // Absent: as canEdit.
  canEditCards?: boolean;
}) {
  const { element, boardRef, plan, setup, projection, items, interactive, canEdit } = opts;
  const canEditCards = opts.canEditCards ?? canEdit;
  // A card dragged here from another board, and the slot it would land in.
  const [incoming, setIncoming] = useState<PlanIncoming | null>(null);
  // The gap last asked for: a hover drawing the same one is dropped before it reaches React, so a card held
  // over a slot does not re-render the board on every pointermove (a same-value setState can still render once).
  const lastIncoming = useRef<PlanIncoming | null>(null);

  const drop = (itemId: string, slot: PlanDropSlot) => {
    if (!plan || !setup || !projection) return;
    const item = items.get(itemId);
    // An Archive board (docs/specs/026-plan/items.md "Archive"): a card dropped on it is archived, its
    // status kept for when it comes back; its own cards stay in their order.
    if (setup.archive) {
      if (!item || isArchived(item)) return;
      plan.patchItem(itemId, { set: { archived: true } });
      plan.announce('Card archived');
      track('Plan', 'Moved', 'Archive');
      return;
    }
    const lands = boardMoveFor(setup, projection, item, itemId, slot);
    if (!lands) return;
    // Off an Archive board onto another: it comes back, in the move itself (one write, one undo step).
    const restored = !!item && isArchived(item);
    const move = restored ? { ...lands, clear: [...(lands.clear ?? []), ARCHIVED_FIELD] } : lands;
    plan.moveItem(itemId, move);
    if (restored) track('Plan', 'Restored', 'Card');
    const column = setup.columns.find((c) => c.status === slot.status);
    plan.announce(`Moved to ${column?.name ?? slot.status}`);
  };

  const drag = usePlanCardDrag({
    boardRef,
    boardId: element.id,
    enabled: interactive && canEditCards,
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
    onTrash: (id) => {
      if (!plan?.canEdit) return;
      plan.trashItem(id);
      plan.announce('Card moved to the Trash');
    },
    onDragging: (id) => plan?.setDragging(id),
    item: (id) => items.get(id),
  });

  // The handlers read this render's board; the registration lasts as long as the board's element.
  const target = useLatest({
    // A card it would hide (a type it does not show) is refused, as a palette card of that type is.
    accepts: (itemId: string) => {
      const item = items.get(itemId);
      return !!setup && !!item && canEditCards && boardShowsType(setup, item.type, plan?.types);
    },
    refusal: () => {
      if (setup?.archive) return 'An Archive board takes cards moved to it';
      if (setup?.addTypes && plan) {
        const names = boardAddTypes(setup, plan.types).map((t) => t.label);
        return names.length
          ? `This board shows ${listOf(names)} cards`
          : 'This board shows no cards';
      }
      return 'This board can’t be changed';
    },
    drop,
    // An Archive board takes cards moved to it, never a new one; any other board takes the types it shows
    // (docs/specs/026-plan/plan-board.md "Card types a board shows").
    acceptsType: (type: string) =>
      !!setup && canEditCards && !setup.archive && boardShowsType(setup, type, plan?.types),
    // A palette card: a new item of the type at the slot, its row's field set, opened at once to be named
    // (docs/specs/026-plan/plan-mode.md "The palette").
    addCard: (type: string, slot: PlanDropSlot) => {
      if (!plan || !setup || !projection) return;
      const def = typeIn(plan.types, type);
      const lane = projection.lanes.find((l) => l.key === slot.laneKey);
      const set = projection.swimlanes ? laneMove(lane) : {};
      const id = newItemId();
      plan.addItem({
        id,
        type: def.id,
        fields: { title: def.newTitle, ...(set.set ?? {}) },
        status: cellStatus(setup, slot.status, lane),
        after: null,
        before: slot.beforeId,
      });
      plan.openNewItem(id);
      const column = setup.columns.find((c) => c.status === slot.status);
      plan.announce(`${def.label} added to ${column?.name ?? slot.status}`);
    },
    // The card's own status is never refused (it may be reordered there or change lanes); a swimlane by type
    // checks the lane's type, the one the card would have.
    refuseAt: (item: Pick<Item, 'type' | 'fields'>, slot: PlanDropSlot) => {
      if (!plan || !setup || !projection || setup.archive) return null;
      const lane = projection.lanes.find((l) => l.key === slot.laneKey);
      const laneType = projection.swimlanes ? laneMove(lane, item).type : undefined;
      return moveStatusRefusal(
        plan.types,
        item,
        { status: cellStatus(setup, slot.status, lane), ...(laneType ? { type: laneType } : {}) },
        (s) => setup.columns.find((c) => c.status === s)?.name ?? plan.statusNames.get(s) ?? s,
      );
    },
    canEditWidgets: () => !!setup && canEdit,
    // A palette widget placed in the header (docs/specs/026-plan/board-widgets.md): one board edit.
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
        hover: (next) => {
          if (sameIncoming(lastIncoming.current, next)) return;
          lastIncoming.current = next;
          setIncoming(next);
        },
        acceptsType: (type) => target.current.acceptsType(type),
        addCard: (type, slot) => target.current.addCard(type, slot),
        refuseAt: (type, slot) => target.current.refuseAt(type, slot),
        canEditWidgets: () => target.current.canEditWidgets(),
        widgetHover: setWidgetSlot,
        placeWidget: (kind, slot, opts) => target.current.placeWidget(kind, slot, opts),
      }),
    [element.id, target],
  );

  return { drag, incoming, drop, widgetSlot, flashWidget: flashWidget?.kind ?? null };
}
