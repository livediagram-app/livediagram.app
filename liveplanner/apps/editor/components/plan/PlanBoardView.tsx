'use client';

// The Plan board's body on the canvas (docs/specs/026-plan/plan-board.md, blueprint plan-board.md):
// its set-up projected over the project's items into columns, rows and cards. In Plan mode cards
// take the pointer and the keyboard; in the other modes the board is an element like any other and a
// double-click opens a card. Everything the board changes goes through PlanContext.
import { usePlanTextScale } from './PlanTextScaleContext';
import { useSlotSettings } from '@/components/plan/dashboard/slot-menu';
import { useInDashboard } from '@/components/plan/dashboard/dashboard-context';
import { isCardVotableInVote } from '@liveplanner/project';
import { useCardVote } from './CardVoteContext';
import { useViewportStoreIfAny } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { frameBoardColumn } from '@/hooks/plan/frame-board-column';
import { useSelectionOf } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { cornerRadiusPx, planOwnColoursOf, type ShapeElement } from '@liveplanner/project';
import {
  ITEM_TYPES,
  cardIsFaceDown,
  normaliseBoardSetup,
  type Item,
  type LaneHead,
  type QuickFilter,
  boardAddTypes,
  newItemId,
} from '@liveplanner/items';
import { useCanvasBranchColours, useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { usePlanBoardDrop } from '@/hooks/plan/usePlanBoardDrop';
import { useBoardCsv } from '@/hooks/plan/useBoardCsv';
import { cellStatus, laneMove } from './plan-board-moves';
import { boardColumnTemplate } from './plan-board-columns';
import { useBoardCollapsed } from '@/hooks/plan/useBoardCollapsed';
import { centreCardColumn, shownQuick } from './phone-board';
import { COLUMN_ATTR } from './column-move-flip';
import { useRegisterConfigurableBoard } from '@/hooks/plan/board-configure-store';
import { RunRevealContext } from '@/hooks/plan/useCardRunReveal';
import { usePlan } from './PlanContext';
import { slotCardSize, slotColumnTemplate, slotColumnUnit, slotSetup } from './slot-board';
import type { NewCard } from './AddCardPopover';
import { useBoardSelection } from '@/hooks/plan/useBoardSelection';
import { planBandTint, planPalette } from './plan-palette';
import { columnTones } from './column-tones';
import { useBoardMaximised } from '@/hooks/plan/useBoardMaximised';
import { MaximisableSlot } from './MaximisedPlanLayer';
import { practiceShipColumn } from './PracticeMarks';
import {
  NO_COLUMNS,
  NO_ITEMS,
  PLAN_BOARD_RADIUS_PX,
  boardSurface,
  stop,
} from './plan-board-view-consts';
import { boardCardKey } from './plan-board-card-key';
import { PlanBoardFrame } from './PlanBoardFrame';
import type { PlanBoardViewValues } from './plan-board-view-values';
import { usePlanBoardProjection } from './usePlanBoardProjection';
import { usePlanBoardMotion } from './usePlanBoardMotion';
import { usePlanCellBase } from './usePlanCellBase';

export function PlanBoardView({
  element,
  fontFamily,
}: {
  element: ShapeElement;
  // The tab's (or the element's own) font (docs/specs/026-plan/plan-board.md "Theme and style").
  fontFamily?: string;
}) {
  const plan = usePlan();
  // The tab's Text Size (fonts.md "Text size on boards and cards").
  const textScale = usePlanTextScale();
  const surface = useCanvasSurface();
  const branchColours = useCanvasBranchColours();
  // The board's theme and style colours (docs/specs/026-plan/plan-board.md "Theme and style"), kept by value: a
  // render that leaves them alone (a finish, a typeface, a backdrop) hands every card the same palette, so no card
  // redraws for it (plan-board.md "A busy board").
  const { fillColor, strokeColor, textColor, colorPreset } = element;
  const palette = useMemo(
    () =>
      planPalette(surface, planOwnColoursOf({ fillColor, strokeColor, textColor, colorPreset })),
    [surface, fillColor, strokeColor, textColor, colorPreset],
  );
  const radiusPx = cornerRadiusPx(
    element.borderRadius,
    element.width,
    element.height,
    PLAN_BOARD_RADIUS_PX,
  );
  const radius = `${radiusPx}px`;
  // Its columns and cards round with it (plan-board.md "Corners"): a column's parts take the board's corners up to
  // 12 px, a card 4 px less, so a square board has square columns and cards. Professional squares them all
  // (face-finish.css).
  const colR = Math.min(radiusPx, 12);
  const cornerVars = {
    '--plan-col-r': `${colR}px`,
    '--plan-card-r': `${Math.max(colR - 4, 0)}px`,
  } as React.CSSProperties;
  const types = plan?.types ?? ITEM_TYPES;
  // The board's set-up as saved: what Setup Board, the CSV and every set-up change start from.
  const fullSetup = useMemo(() => normaliseBoardSetup(element.planBoard), [element.planBoard]);
  // Its Board tab's CSV import (the Import dialog's CSV row) and Download CSV (docs/specs/026-plan/plan-board.md "CSV").
  useBoardCsv(element.id, fullSetup);
  // Maximised, for this person only (docs/specs/026-plan/plan-board.md "Maximised board").
  // Or filling its tab, for everyone ("Fill Tab"): no Maximise/Restore then, and Escape leaves it be.
  const interactive = !!plan;
  const { maximised, filled } = useBoardMaximised(element.id, interactive);
  // In a Dashboard slot the board is a compact one for working its cards (docs/specs/026-plan/plan-tabs.md "A board in
  // a slot is simplified"): nothing on it sets the board up, its swimlanes are not drawn (slot-board.ts) and no widget
  // narrows it. Maximised from the slot it is the whole board again, and simplified once restored.
  const simplified = useInDashboard() && !maximised;
  // The set-up the board is drawn and worked from: a slot board's without its swimlanes.
  const setup = useMemo(
    () => (fullSetup && simplified ? slotSetup(fullSetup) : fullSetup),
    [fullSetup, simplified],
  );
  // The column the Practice Sprint ships to, only while there are practice cards (PracticeMarks).
  const shipColumnId = useMemo(
    () => (setup && plan?.practiceIds?.size ? practiceShipColumn(setup)?.id : undefined),
    [setup, plan?.practiceIds],
  );
  const [quick, setQuick] = useState<QuickFilter>({});
  // A phone draws the board its own way (phone-board.ts): no widgets, so no quick filter either; nor does a slot board.
  const phone = useIsMobileViewport();
  const applied = shownQuick(quick, phone || simplified);
  const [adding, setAdding] = useState<{ status: string; laneKey: string } | null>(null);
  const closeAdding = useCallback(() => setAdding(null), []);
  // What this person has collapsed here, columns and swimlanes, remembered on this browser (docs/specs/026-plan/
  // plan-board.md "Collapse Column").
  const collapse = useBoardCollapsed(element.id);
  const collapsed = collapse.lanes;
  // The chevron (or the cog's Collapse Column) whose toggle just ran: focus follows it to its counterpart.
  const focusToggleRef = useRef<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  // A card's right-click menu (PlanCardMenu): the card and where it was asked for.
  const [menu, setMenu] = useState<{ itemId: string; at: { x: number; y: number } } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const focusNextRef = useRef<string | null>(null);
  const items = plan?.items ?? NO_ITEMS;
  const statusNames = plan?.statusNames;
  const { projection, busy, pickable, shownItems } = usePlanBoardProjection(
    setup,
    items,
    applied,
    types,
    statusNames,
  );
  // Selected (alone or with others): the header shows its move handle.
  const selected = useSelectionOf(
    (s) => s.selectedId === element.id || s.multiSelectedIds.has(element.id),
  );
  const canEdit = !!plan?.canEdit;
  // Cards move, open for editing and are added by an Editor or a Participant (docs/specs/013-workspace/share-roles.md).
  const canEditCards = !!plan?.canEditCards;
  const setUpHere = canEdit && !simplified;
  const slot = useSlotSettings();
  // A Board tab's board is configured from the cluster's Configure, beside Style, not a cog in its header
  // (plan-board.md "Configure"). The cog stays on a board on an ordinary tab and in a Dashboard slot.
  const configuredFromCluster = filled && interactive && !slot && !!plan?.canEdit;
  useRegisterConfigurableBoard(element.id, configuredFromCluster);
  // The tab's session vote, when this board's cards take dots in it (its layer, under a layer-scoped vote).
  const tabCardVote = useCardVote();
  const cardVote =
    tabCardVote && isCardVotableInVote(element, tabCardVote.vote, tabCardVote.layers, false)
      ? tabCardVote
      : null;
  // On a phone a tap on a column's header frames that column on screen, as a tap on a page does in Pages.
  const viewport = useViewportStoreIfAny();
  const frameColumn =
    phone && interactive && !maximised && !filled && viewport
      ? (header: HTMLElement) => {
          const board = header.closest<HTMLElement>('[data-plan-board]');
          if (board) frameBoardColumn(header, board, element, viewport);
        }
      : null;

  // A tap that opens a card: on a phone board of one column a screen, a card in a neighbouring column brings that
  // column in instead (plan-board.md "On a phone"). Read at the tap, so `look` is this render's by then.
  const openTapped = (id: string) => {
    const body = bodyRef.current;
    if (body && look.columns === 'phone' && centreCardColumn(id, body, COLUMN_ATTR)) return;
    plan?.openItem(id);
  };
  const { drag, incoming } = usePlanBoardDrop({
    onOpen: openTapped,
    element,
    boardRef,
    plan,
    setup,
    projection,
    items,
    interactive,
    canEdit,
    canEditCards,
  });

  // This person's selected cards here (docs/specs/026-plan/plan-board.md "Several cards at once"): an Editor's or a
  // Participant's, in Plan mode, never in a Dashboard slot; a face-down card is never picked.
  const selfId = plan?.self?.id ?? '';
  const selectable = useCallback(
    (id: string) => {
      const it = items.get(id);
      return !!it && !!setup && !cardIsFaceDown(it, setup, selfId);
    },
    [items, setup, selfId],
  );
  const selection = useBoardSelection({
    projection,
    enabled: interactive && canEditCards && !simplified,
    selectable,
    ...(plan ? { announce: plan.announce } : {}),
  });

  // A press on a card in Plan mode without edit rights still opens it. With a selection: Cmd/Ctrl (or any press in
  // select mode) picks the card or lets it go, Shift picks the run from the last card picked in its column, and a press
  // on a selected card carries the whole group; any other press lets the selection go and works the card alone.
  const onCardPress = (id: string, e: React.PointerEvent<HTMLElement>) => {
    if (!interactive) return;
    if (canEditCards && !simplified && e.button === 0) {
      const picking = e.metaKey || e.ctrlKey || selection.mode;
      if (picking || e.shiftKey) {
        stop(e);
        e.preventDefault();
        if (e.shiftKey && !picking) selection.range(id);
        else selection.toggle(id);
        return;
      }
    }
    const group = selection.ids.has(id) && selection.ids.size > 1 ? selection.ordered : undefined;
    if (!group && selection.ids.size) selection.clear();
    if (canEditCards) drag.onCardPointerDown(id, e, look.holdToDrag, group);
    else {
      stop(e);
      openTapped(id);
    }
  };

  const {
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
  } = usePlanBoardMotion({
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
  });
  const columnName = (s: string) => setup?.columns.find((c) => c.status === s)?.name ?? s;

  const onCardKey = (item: Item, e: React.KeyboardEvent<HTMLElement>) =>
    boardCardKey(
      {
        plan,
        setup,
        projection,
        items,
        shutColumns,
        canEdit,
        canEditCards,
        simplified,
        selection,
        columnName,
        focusNextRef,
        boardRef,
        setAdding,
      },
      item,
      e,
    );

  // The card handlers behind callbacks that keep their identity across renders, each reading this render's: a card
  // (PlanBoardCard, memoised) redraws only when what it shows changes, never because its board drew again, so a Tab
  // Style change on a busy board redraws no card it leaves alone (plan-board.md "A busy board").
  const latest = useLatest({ onCardPress, onCardKey, plan, cancelPress: drag.cancelPress });
  const cardHandlers = useMemo(
    () => ({
      onPress: (id: string, e: React.PointerEvent<HTMLElement>) =>
        latest.current.onCardPress(id, e),
      onKey: (item: Item, e: React.KeyboardEvent<HTMLElement>) => latest.current.onCardKey(item, e),
      onOpen: (id: string) => latest.current.plan?.openItem(id),
      onMenu: (it: Item, at: { x: number; y: number }) => setMenu({ itemId: it.id, at }),
      onLongPress: (it: Item, at: { x: number; y: number }) => {
        // The held press opens the menu instead of becoming a drag or a click.
        latest.current.cancelPress();
        setMenu({ itemId: it.id, at });
      },
    }),
    // setMenu is a state setter, the same every render: named so the React Compiler keeps this memo.
    [latest, setMenu],
  );

  // A slot board sizes its columns from its measured width (slot-board.ts), its cards Minimal when they are narrow.
  const slotBoard = look.columns === 'slot';
  const slotUnit = slotBoard
    ? slotColumnUnit(bodySize?.width ?? null, setup?.columns ?? NO_COLUMNS)
    : null;
  const cardSize = slotBoard ? slotCardSize(look.cardSize, slotUnit) : look.cardSize;
  // What every card draws with (PlanBoardCellCards), one identity while none of it changes (usePlanCellBase).
  const cellBase = usePlanCellBase({
    palette,
    cardSize,
    slotBoard,
    cardTouch: look.cardTouch,
    interactive,
    canEditCards,
    cardHandlers,
    cardVote,
    setup,
    selfId: plan?.self?.id ?? '',
    presence: plan?.presence,
    selected: selection.ids,
    liftedId: dragging?.itemId,
    carried,
  });

  if (!setup || !projection) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center rounded-xl border text-[13px]"
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.border,
          color: palette.muted,
        }}
      >
        This board&rsquo;s set-up can&rsquo;t be read.
      </div>
    );
  }

  const lanes = projection.lanes;
  // On a multi-colour theme each column takes the next of its colours (plan-board.md "Columns in the theme's colours").
  const tones = columnTones(setup.columns, branchColours, palette);
  const toneOf = (id: string) => tones.get(id) ?? { palette, bar: undefined };
  // A collapsed column names itself once, in the first open swimlane's part of its strip.
  const firstOpenLane = lanes.findIndex((l) => !collapsed.has(l.key));
  const withLanes = projection.swimlanes;
  const self = plan?.self ?? null;
  const loading = plan?.status === 'loading';
  const empty = !loading && projection.total === 0;
  // Every board shows, and Add card offers, every card type (docs/specs/026-plan/plan-board.md).
  const addTypes = boardAddTypes(setup, types);

  const columnTemplate = slotBoard
    ? slotColumnTemplate(bodySize?.width ?? null, setup.columns)
    : boardColumnTemplate(setup.columns, look.columns, shutColumns);
  // A slot board's column + (its head's, the cards' Add card row otherwise; rows keep their own rows' buttons, an All
  // Cards board's rows by status being the one kind a slot board keeps).
  const addInHead = simplified && !withLanes;
  // Add card is offered: someone who may add, once loaded, on a board that takes new cards and some type to add.
  const mayAdd = canEditCards && !loading && !setup.archive && addTypes.length > 0;
  // A new card at the foot of a cell, opened at once to be named (plan-board.md "Open an item").
  const addInto =
    (status: string, lane: LaneHead | undefined, cell: readonly Item[]) =>
    ({ type, fields }: NewCard) => {
      const id = newItemId();
      void plan?.addItem({
        id,
        type,
        fields: { ...fields, ...(withLanes ? laneMove(lane).set : {}) },
        status: cellStatus(setup, status, lane),
        after: cell[cell.length - 1]?.id ?? null,
      });
      plan?.openNewItem(id);
    };

  // Collapse or expand a column, gliding (column-move-flip.ts), focus following to the other chevron.
  const toggleColumn = (columnId: string) => {
    columnMove.beforeResize(columnId);
    focusToggleRef.current = columnId;
    collapse.toggleColumn(columnId, new Set(setup.columns.map((c) => c.id)));
  };
  // The gap a card would land in: one dragged on this board, or one held over it from another board.
  const held =
    dragging && !dragging.outside && dragging.slot
      ? {
          slot: dragging.slot,
          height: dragging.height,
          itemId: dragging.itemId,
          ...(dragging.refused ? { refused: dragging.refused } : {}),
        }
      : incoming;

  // What the board's parts draw with (plan-board-view-values.ts): this render's values.
  const v: PlanBoardViewValues = {
    element,
    plan,
    setup,
    projection,
    palette,
    types,
    items,
    statusNames,
    shownItems,
    addTypes,
    self,
    slot,
    look,
    interactive,
    simplified,
    selected,
    maximised,
    filled,
    phone,
    canEdit,
    canEditCards,
    setUpHere,
    configuredFromCluster,
    quick,
    setQuick,
    columnName,
    gridRef,
    slotBoard,
    columnTemplate,
    lanes,
    withLanes,
    collapse,
    collapsed,
    shutColumns,
    canCollapse,
    firstOpenLane,
    frameColumn,
    addInHead,
    mayAdd,
    adding,
    closeAdding,
    addInto,
    toneOf,
    toggleColumn,
    reorder,
    held,
    empty,
    loading,
    shipColumnId,
    cellBase,
    busy,
    boardRef,
    bodyRef,
    cardSize,
    radius,
    cornerVars,
    fontFamily,
    textScale,
    selection,
    menu,
    setMenu,
    drag,
    dragging,
    fullSetup,
    pickable,
  };

  const board = <PlanBoardFrame v={v} />;
  // One stable tree whether maximised or not (MaximisableSlot), so the board keeps its state both ways; while it
  // fills the canvas area (maximised or filling its tab), the canvas keeps its place, empty.
  return (
    <MaximisableSlot
      id={element.id}
      maximised={maximised}
      tint={planBandTint(element)}
      blend={{ surface: palette.surface, line: palette.border }}
      fill={filled}
      placeholder={{
        backgroundColor: boardSurface(palette.surface),
        borderColor: palette.border,
        borderRadius: radius,
        borderWidth: 1,
        borderStyle: 'solid',
      }}
    >
      <RunRevealContext value={runReveal}>{board}</RunRevealContext>
    </MaximisableSlot>
  );
}
