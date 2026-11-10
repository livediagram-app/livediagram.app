// How the Plan board moves and is laid out (docs/specs/026-plan/plan-board.md, blueprint plan-board.md), for
// PlanBoardView, in the order the board has always called them: the column's wheel, focus following a moved card or
// a column's chevron, which columns are shut, cards and columns gliding to where they now sit, a busy board's runs,
// dragging a column head, edge scrolling, the board's look, a phone's column swipe, a slot board's width, and the
// column hover, spotlight and fan-in.
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { BoardProjection, PlanBoardSetup } from '@liveplanner/items';
import type { ShapeElement } from '@liveplanner/project';
import { useObservedSize } from '@liveworkspace/workbench/hooks/canvas/useObservedSize';
import type { SlotSettingsValue } from '@/components/plan/dashboard/slot-menu';
import type { useBoardCollapsed } from '@/hooks/plan/useBoardCollapsed';
import { useEdgeAutoScroll } from '@/hooks/plan/useEdgeAutoScroll';
import { usePhoneColumnSwipe } from '@/hooks/plan/usePhoneColumnSwipe';
import { usePlanCardFlip } from '@/hooks/plan/usePlanCardFlip';
import type { usePlanBoardDrop } from '@/hooks/plan/usePlanBoardDrop';
import { focusPlanCard, useCardRunReveal } from '@/hooks/plan/useCardRunReveal';
import { COLUMN_TOGGLE_ATTR } from './CollapsedColumn';
import { useColumnMoveFlip } from './column-move-flip';
import type { PlanContextValue } from './PlanContext';
import { boardLook } from './phone-board';
import { COLLAPSED_COLUMN_PX } from './plan-board-columns';
import { NONE_SHUT } from './plan-board-view-consts';
import { useCardFanIn } from './useCardFanIn';
import { useCardSpotlight } from './useCardSpotlight';
import { useColumnHover } from './useColumnHover';
import { useColumnReorder } from './useColumnReorder';

type Drop = ReturnType<typeof usePlanBoardDrop>;

export function usePlanBoardMotion({
  element,
  plan,
  setup,
  projection,
  collapse,
  busy,
  interactive,
  phone,
  simplified,
  maximised,
  filled,
  slot,
  setUpHere,
  drag,
  incoming,
  bodyRef,
  boardRef,
  focusNextRef,
  focusToggleRef,
}: {
  element: ShapeElement;
  plan: PlanContextValue | undefined;
  setup: PlanBoardSetup | null;
  projection: BoardProjection | null;
  collapse: ReturnType<typeof useBoardCollapsed>;
  busy: boolean;
  interactive: boolean;
  phone: boolean;
  simplified: boolean;
  maximised: boolean;
  filled: boolean;
  slot: SlotSettingsValue | null;
  setUpHere: boolean;
  drag: Drop['drag'];
  incoming: Drop['incoming'];
  bodyRef: RefObject<HTMLDivElement | null>;
  boardRef: RefObject<HTMLDivElement | null>;
  focusNextRef: RefObject<string | null>;
  focusToggleRef: RefObject<string | null>;
}) {
  const collapsed = collapse.lanes;
  // The column's wheel scrolls the board, not the canvas, while there is room to scroll.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      const canY = body.scrollHeight > body.clientHeight;
      const canX = body.scrollWidth > body.clientWidth;
      if ((canY && Math.abs(e.deltaY) >= Math.abs(e.deltaX)) || (canX && e.deltaX !== 0)) {
        e.stopPropagation();
      }
    };
    body.addEventListener('wheel', onWheel, { passive: true });
    return () => body.removeEventListener('wheel', onWheel);
    // The board's own ref, the same object every render: the listener goes on once, as it always has.
  }, [bodyRef]);

  useEffect(() => {
    const id = focusNextRef.current;
    if (!id) return;
    focusNextRef.current = null;
    // A far run's card is built first (useCardRunReveal).
    focusPlanCard(boardRef.current, id);
  });
  useEffect(() => {
    const id = focusToggleRef.current;
    if (!id) return;
    focusToggleRef.current = null;
    boardRef.current
      ?.querySelector<HTMLElement>(`[${COLUMN_TOGGLE_ATTR}="${CSS.escape(id)}"]`)
      ?.focus({ preventScroll: true });
  });
  // Columns collapse for this person on a board they work in Plan mode, but not on a phone nor in a Dashboard slot's
  // compact board, which draw every column open.
  const canCollapse = interactive && !phone && !simplified;
  const shutColumns = canCollapse ? collapse.columns : NONE_SHUT;
  const shutKey = [...shutColumns].join(',');

  // Cards glide to where they now sit when the board's arrangement changes (usePlanCardFlip): the signature is each
  // cell's cards in order, so a move, a reorder or a collaborator's change re-measures, and nothing else does.
  const flipSignature = useMemo(
    () =>
      projection
        ? projection.columns
            .map((c) =>
              c.lanes.map((l) => `${l.laneKey}:${l.items.map((i) => i.id).join(',')}`).join(';'),
            )
            .join('|') + `|${[...collapsed].join(',')}|${shutKey}`
        : '',
    [projection, collapsed, shutKey],
  );
  // A column moved left or right glides there (column-move-flip.ts), its cards riding along rather than gliding too.
  const gridRef = useRef<HTMLDivElement>(null);
  // Its order and which columns are strips: a column collapsed or expanded glides too.
  const columnMove = useColumnMoveFlip(
    gridRef,
    `${setup?.columns.map((c) => c.id).join('|') ?? ''}/${shutKey}`,
    COLLAPSED_COLUMN_PX,
  );
  const rememberCards = usePlanCardFlip(
    bodyRef,
    flipSignature,
    drag.drag?.itemId ?? null,
    columnMove.isMoving,
  );
  // A busy board builds only its runs near the view (useCardRunReveal, PlanCardRun): it built all 2,000 cards.
  const runReveal = useCardRunReveal(busy, rememberCards);
  // An Editor reorders the columns by dragging a head, or Alt+Shift+Arrows on one, on a desktop (plan-board.md "Drag a
  // column"); never on a phone nor a slot board (setUpHere is false there).
  const reorder = useColumnReorder({
    setup,
    write: (next) => plan?.updateBoard(element.id, next),
    announce: (message) => plan?.announce(message),
    enabled: setUpHere && interactive && !phone,
    grid: gridRef,
    scroller: bodyRef,
    board: boardRef,
    glide: columnMove,
  });
  // Maximised (or filling its tab, or in a Dashboard slot, whose columns scroll sideways when it is narrow), a card
  // dragged near the columns' left or right edge scrolls them sideways.
  useEdgeAutoScroll(bodyRef, (maximised || filled || simplified) && (!!drag.drag || !!incoming));
  const dragging = drag.drag;
  // The cards a group drag carries, for a look-up per card drawn (one Set per drag, not a scan per card).
  const carried = useMemo(() => new Set(dragging?.group ?? []), [dragging?.group]);
  // A slot per column, two or three for a wider one (docs/specs/026-plan/plan-board.md "The board set-up"); five
  // slots across while it covers the canvas, then it scrolls sideways.
  const look = boardLook(
    {
      phone,
      covering: maximised || filled,
      inSlot: !!slot,
      interactive,
      dragging: !!dragging || !!incoming,
      simple: simplified,
    },
    setup?.cardSize,
  );
  // On a phone board that shows one column a screen, a column changes only on a swipe meant for it (phone-swipe.ts).
  usePhoneColumnSwipe(bodyRef, look.swipe, !!dragging || !!incoming);
  // A slot board's width, read only there (and not on a phone, whose cards are Minimal anyway): its cards turn Minimal
  // when its columns are narrow (slot-board.ts slotCardSize).
  const bodySize = useObservedSize(bodyRef, simplified && !phone);

  // The column under the pointer shifts its colour slightly (plan-board.md "Column hover").
  useColumnHover(gridRef, interactive && !simplified, setup?.columns.length ?? 0);
  useCardSpotlight(gridRef, interactive);
  // Cards fan in once the board first has them (plan-board.md "Cards fan in").
  useCardFanIn(
    gridRef,
    !!setup && !!projection && plan?.status !== 'loading',
    projection?.columns.reduce((n, c) => n + c.count, 0) ?? 0,
  );
  return {
    canCollapse,
    shutColumns,
    gridRef,
    columnMove,
    runReveal,
    reorder,
    dragging,
    carried,
    look,
    bodySize,
  };
}
