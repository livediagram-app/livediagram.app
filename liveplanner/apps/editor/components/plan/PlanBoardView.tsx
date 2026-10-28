'use client';

// The Plan board's body on the canvas (docs/specs/026-plan/plan-board.md, blueprint plan-board.md):
// its set-up projected over the project's items into columns, rows and cards. In Plan mode cards
// take the pointer and the keyboard; in the other modes the board is an element like any other and a
// double-click opens a card. Everything the board changes goes through PlanContext.
import { planFontStyle } from '@/lib/plan-font';
import { useSlotSettings } from '@/components/plan/dashboard/slot-menu';
import { useInDashboard } from '@/components/plan/dashboard/dashboard-context';
import { isCardVotableInVote } from '@liveplanner/project';
import { useCardVote } from './CardVoteContext';
import { useViewportStoreIfAny } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { frameBoardColumn } from '@/hooks/plan/frame-board-column';
import { markPanThrough } from '@liveworkspace/workbench/hooks/canvas/pan-through';
import { mayCreateCardType } from './may-create-card-type';
import { useSelectionOf } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cornerRadiusPx, type ShapeElement } from '@liveplanner/project';
import {
  CARD_FIELDS,
  ITEM_TYPES,
  itemStatus,
  cardIsFaceDown,
  normaliseBoardSetup,
  projectBoard,
  type Item,
  type QuickFilter,
  boardAddTypes,
  newItemId,
  isTrashed,
  boardSortFieldOf,
  isDoneColumn,
} from '@liveplanner/items';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { track } from '@/lib/telemetry';
import { usePlanBoardDrop } from '@/hooks/plan/usePlanBoardDrop';
import { useBoardCsv } from '@/hooks/plan/useBoardCsv';
import { cellStatus, laneMove } from './plan-board-moves';
import { DropGap, LaneRow, PlanBoardCard, PlanDragGhost } from './PlanBoardCells';
import {
  cardsMovingRefused,
  cardsStayedMessage,
  moveStatusRefusal,
  typeStatusRefusal,
} from '@/hooks/plan/status-refusal';
import { PlanColumnHeader } from './PlanColumnHeader';
import { boardRowTemplate } from './plan-board-rows';
import { SetupBoardHost } from './SetupBoardHost';
import { pickableStatuses } from './column-status-picks';
import { boardItems } from '@liveplanner/plan-art';
import { trackSetup } from './track-board-setup';
import { PHONE_COLUMN_WIDTH, boardColumnTemplate } from './plan-board-columns';
import { boardLook, centreTappedColumn, shownQuick } from './phone-board';
import { useEdgeAutoScroll } from '@/hooks/plan/useEdgeAutoScroll';
import { PlanCardMenuHost } from './PlanCardMenu';
import { BoardSettingsButton } from './BoardSettingsButton';
import { SlotBoardCog } from './SlotBoardCog';
import { usePlanCardFlip } from '@/hooks/plan/usePlanCardFlip';
import { COLUMN_ATTR, useColumnMoveFlip } from './column-move-flip';
import { usePlan } from './PlanContext';
import { PlanBoardHeader } from './PlanBoardHeader';
import { ExampleCardsNotice } from './ExampleCardsNotice';
import { AddCardButton } from './AddCardButton';
import { planBoardKey } from './plan-board-keys';
import { planBandTint, planOwnColours, planPalette } from './plan-palette';
import { useBoardMaximised } from '@/hooks/plan/useBoardMaximised';
import { MaximisePlanButton, MaximisableSlot } from './MaximisedPlanLayer';
import { FocusElementButton } from './FocusElementButton';

// A board's corner radius when it has none of its own (Quick Style's Corners sets one).
const PLAN_BOARD_RADIUS_PX = 12;

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

// The board body keeps its presses (cards, cells, buttons) from the canvas, except a finger on empty board,
// which pans the canvas as it would anywhere else, never moving the board: only its header does that
// (docs/specs/026-plan/plan-board.md "On a phone").
function keepBoardPress(e: React.PointerEvent<HTMLElement>): void {
  if (e.pointerType === 'touch') {
    const t = e.target as HTMLElement;
    if (!t.closest('[data-plan-card], button, input, select, textarea, [role="button"]')) {
      markPanThrough(e);
      return;
    }
  }
  e.stopPropagation();
}
const NO_ITEMS: ReadonlyMap<string, Item> = new Map();
const NO_STATUSES: ReadonlyMap<string, string> = new Map();

export function PlanBoardView({
  element,
  fontFamily,
}: {
  element: ShapeElement;
  // The tab's (or the element's own) font (docs/specs/026-plan/plan-board.md "Theme and style").
  fontFamily?: string;
}) {
  const plan = usePlan();
  const surface = useCanvasSurface();
  // The board's theme and style colours (docs/specs/026-plan/plan-board.md "Theme and style").
  const palette = planPalette(surface, planOwnColours(element));
  const radius = `${cornerRadiusPx(element.borderRadius, element.width, element.height, PLAN_BOARD_RADIUS_PX)}px`;
  const types = plan?.types ?? ITEM_TYPES;
  const setup = useMemo(() => normaliseBoardSetup(element.planBoard), [element.planBoard]);
  // Its Board tab's Import CSV… and Download CSV (docs/specs/026-plan/plan-board.md "CSV").
  useBoardCsv(element.id, setup);
  const [quick, setQuick] = useState<QuickFilter>({});
  // A phone draws the board its own way (phone-board.ts): no widgets, so no quick filter either.
  const phone = useIsMobileViewport();
  const applied = shownQuick(quick, phone);
  const [adding, setAdding] = useState<{ status: string; laneKey: string } | null>(null);
  const closeAdding = useCallback(() => setAdding(null), []);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const boardRef = useRef<HTMLDivElement>(null);
  // A card's right-click menu (PlanCardMenu): the card and where it was asked for.
  const [menu, setMenu] = useState<{ itemId: string; at: { x: number; y: number } } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const focusNextRef = useRef<string | null>(null);
  const items = plan?.items ?? NO_ITEMS;
  const statusNames = plan?.statusNames;
  const projection = useMemo(
    () => (setup ? projectBoard(setup, items, applied, types, statusNames) : null),
    [setup, items, applied, types, statusNames],
  );
  // The statuses a column can be made for: the boards', any a card is in and the card types' Default States
  // (docs/specs/026-plan/plan-board.md "The column picker").
  const pickable = useMemo(
    () => pickableStatuses(statusNames ?? NO_STATUSES, items.values(), types),
    [statusNames, items, types],
  );
  // What the header's widgets count: the items the board shows, before the quick filter.
  const shownItems = useMemo(
    () => (setup ? boardItems(projectBoard(setup, items, undefined, types, statusNames)) : []),
    [setup, items, types, statusNames],
  );
  const interactive = !!plan;
  // Selected (alone or with others): the header shows its move handle.
  const selected = useSelectionOf(
    (s) => s.selectedId === element.id || s.multiSelectedIds.has(element.id),
  );
  const canEdit = !!plan?.canEdit;
  // Cards move, open for editing and are added by an Editor or a Participant (docs/specs/013-workspace/share-roles.md).
  const canEditCards = !!plan?.canEditCards;
  // Maximised, for this person only (docs/specs/026-plan/plan-board.md "Maximised board").
  // Or filling its tab, for everyone ("Fill Tab"): no Maximise/Restore then, and Escape leaves it be.
  const { maximised, filled } = useBoardMaximised(element.id, interactive);
  // In a Dashboard slot the board is simplified, for working its cards (docs/specs/026-plan/plan-tabs.md "A board in a
  // slot is simplified"): its set-up (title, widgets, columns, Reveal, new card types, Board Settings, the Form strip)
  // changes on its tab. Maximised from the slot it is the whole board again, and simplified once restored.
  const simplified = useInDashboard() && !maximised;
  const setUpHere = canEdit && !simplified;
  const slot = useSlotSettings();
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

  const { drag, incoming } = usePlanBoardDrop({
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

  // A press on a card in Plan mode without edit rights still opens it.
  const onCardPress = (id: string, e: React.PointerEvent<HTMLElement>) => {
    if (!interactive) return;
    if (canEditCards) drag.onCardPointerDown(id, e, look.holdToDrag);
    else {
      stop(e);
      plan?.openItem(id);
    }
  };

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
  }, []);

  useEffect(() => {
    const id = focusNextRef.current;
    if (!id) return;
    focusNextRef.current = null;
    boardRef.current?.querySelector<HTMLElement>(`[data-plan-card="${CSS.escape(id)}"]`)?.focus();
  });

  // Cards glide to where they now sit when the board's arrangement changes (usePlanCardFlip): the signature is each
  // cell's cards in order, so a move, a reorder or a collaborator's change re-measures, and nothing else does.
  const flipSignature = useMemo(
    () =>
      projection
        ? projection.columns
            .map((c) =>
              c.lanes.map((l) => `${l.laneKey}:${l.items.map((i) => i.id).join(',')}`).join(';'),
            )
            .join('|') + `|${collapsed.size}`
        : '',
    [projection, collapsed],
  );
  // A column moved left or right glides there (column-move-flip.ts), its cards riding along rather than gliding too.
  const gridRef = useRef<HTMLDivElement>(null);
  const columnMove = useColumnMoveFlip(gridRef, setup?.columns.map((c) => c.id).join('|') ?? '');
  usePlanCardFlip(bodyRef, flipSignature, drag.drag?.itemId ?? null, columnMove.isMoving);
  // Maximised (or filling its tab, or a phone's Dashboard slot, one column a screen), a card dragged near the columns'
  // left or right edge scrolls them sideways.
  useEdgeAutoScroll(
    bodyRef,
    (maximised || filled || (phone && !!slot)) && (!!drag.drag || !!incoming),
  );

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
  const withLanes = projection.swimlanes;
  const self = plan?.self ?? null;
  const loading = plan?.status === 'loading';
  const empty = !loading && projection.total === 0;
  // Every board shows, and Add card offers, every card type (docs/specs/026-plan/plan-board.md).
  const addTypes = boardAddTypes(setup, types);
  // The Add a Card menu's Add New Card Type: a new type with only this board's statuses, added to it once saved
  // (docs/specs/026-plan/plan-board.md "Add New Card Type"), for an Editor while the catalogue has room.
  const createType =
    plan && setUpHere && mayCreateCardType(plan)
      ? () =>
          plan.createTypeForBoard(
            element.id,
            setup.columns.map((c) => c.status),
          )
      : undefined;

  const columnName = (s: string) => setup.columns.find((c) => c.status === s)?.name ?? s;

  const onCardKey = (item: Item, e: React.KeyboardEvent<HTMLElement>) => {
    if (!plan) return;
    // A sorted board's first field, named when Shift+Up/Down cannot reorder.
    const first = setup.sortBy?.[0]?.field;
    const sortedBy = first ? (boardSortFieldOf(first, plan.types)?.label ?? first) : undefined;
    const action = planBoardKey(projection, item.id, e.key, e.shiftKey, canEditCards, sortedBy);
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    if (action.kind === 'focus') {
      boardRef.current
        ?.querySelector<HTMLElement>(`[data-plan-card="${CSS.escape(action.itemId)}"]`)
        ?.focus();
    } else if (action.kind === 'open') plan.openItem(item.id);
    else if (action.kind === 'trash') {
      // Focus goes on to a neighbour rather than falling to the page with the card.
      focusNextRef.current = action.focusAfter;
      plan.trashItem(item.id);
      plan.announce(`#${item.key} moved to the Trash`);
    } else if (action.kind === 'add') setAdding({ status: action.status, laneKey: action.laneKey });
    else if (action.kind === 'refuse') plan.announce(action.announce);
    else {
      // A column whose status the card's type leaves out (docs/specs/026-plan/item-types.md "An item type").
      const refused = moveStatusRefusal(plan.types, item, action.move, columnName);
      if (refused) {
        plan.announce(refused);
        return;
      }
      focusNextRef.current = item.id;
      plan.moveItem(item.id, action.move);
      plan.announce(action.announce);
    }
  };

  const dragging = drag.drag;
  // A slot per column, two or three for a wider one (docs/specs/026-plan/plan-board.md "The board set-up"); five
  // slots across while it covers the canvas, then it scrolls sideways.
  const look = boardLook(
    {
      phone,
      covering: maximised || filled,
      inSlot: !!slot,
      interactive,
      dragging: !!dragging || !!incoming,
    },
    setup.cardSize,
  );
  const columnTemplate = boardColumnTemplate(setup.columns, look.columns);

  const board = (
    <div
      ref={boardRef}
      data-plan-board={element.id}
      role="region"
      aria-label={setup.title}
      // `isolate`: the sticky column heads stack inside the board, never over another element.
      className="absolute inset-0 isolate flex flex-col overflow-hidden border"
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
        color: palette.text,
        borderRadius: radius,
        ...planFontStyle(fontFamily),
      }}
    >
      <PlanBoardHeader
        setup={setup}
        projection={projection}
        items={shownItems}
        types={types}
        palette={palette}
        selected={selected}
        movable={!maximised && !filled}
        canRename={setUpHere && interactive}
        onOpenItem={(id) => plan?.openItem(id)}
        onSetup={(next, part) => {
          plan?.updateBoard(element.id, next);
          trackSetup(part);
        }}
        showWidgets={look.widgets}
        onWidgets={(next) => {
          plan?.updateBoard(element.id, { ...setup, widgets: next });
          trackSetup('Widgets');
        }}
        quick={quick}
        onQuick={setQuick}
        canFilterMine={self?.id ?? null}
        canEdit={setUpHere}
        simplified={simplified}
        loadFailed={plan?.status === 'error'}
        onRetry={() => plan?.retry()}
        onReveal={() => {
          plan?.updateBoard(element.id, { ...setup, hideWriting: false });
          plan?.announce('Every card turned face up');
          track('Plan', 'Revealed', 'Board');
        }}
        onMoveUnplaced={(item, status) => {
          if (!plan) return;
          const refused = typeStatusRefusal(plan.types, item.type, status, columnName);
          if (refused) plan.announce(refused);
          else plan.moveItem(item.id, { status, before: null });
        }}
        end={
          interactive ? (
            <>
              {/* Focus glides the view to fit the board; not while it fills the view. */}
              {maximised || filled ? null : (
                <FocusElementButton bounds={element} kind="Board" palette={palette} />
              )}
              {filled ? null : (
                <MaximisePlanButton id={element.id} maximised={maximised} palette={palette} />
              )}
              {/* The cog last, at the header's far right: the board's one menu (its element menu). In a Dashboard
                  slot, the slot's own cog (slot-menu.ts), the board set up on its tab; maximised from the slot, an
                  Editor's Board Settings with the slot's section after the board's. */}
              {slot ? (
                setUpHere ? (
                  <SlotBoardCog element={element} palette={palette} slot={slot} />
                ) : (
                  slot.cog
                )
              ) : canEdit ? (
                <BoardSettingsButton element={element} palette={palette} />
              ) : null}
            </>
          ) : null
        }
      />
      {/* A template's example cards: Clear Example Cards or Keep Them, for an Editor (ExampleCardsNotice). */}
      {interactive && plan ? (
        <ExampleCardsNotice shown={shownItems} plan={plan} palette={palette} />
      ) : null}
      <div
        ref={bodyRef}
        // A scroll container resets touch-action, so without touch-none a finger on a card starts a native
        // scroll and the browser cancels the drag; the canvas pans across empty board instead. Maximised, filling
        // its tab or in a Dashboard slot, nothing under the board pans, so a finger on empty board scrolls the board
        // (and past its end, the Dashboard's page); each card is touch-none on its own, so a finger on one still
        // picks it up. On a phone its columns snap
        // centred, one at a time (phone-board.ts), and a tap on a column's empty space glides it to the centre.
        className={`min-h-0 flex-1 overflow-auto px-3 ${look.endClearance || 'pb-3'} ${look.container ? '@container' : ''} ${look.touch} ${look.overscroll} ${
          look.snap ? 'snap-x snap-mandatory' : ''
        }`}
        onPointerDown={interactive ? keepBoardPress : undefined}
        onClick={
          interactive && look.columns === 'phone'
            ? (e) => {
                if (bodyRef.current)
                  centreTappedColumn(e.target as Element, bodyRef.current, COLUMN_ATTR);
              }
            : undefined
        }
      >
        {/* Not set up yet: the placeholder; and Setup Board's dialog, for this person only, when open (new, or Board
            Setup's Setup Board run again over a set-up board). */}
        <SetupBoardHost
          elementId={element.id}
          setup={setup}
          palette={palette}
          canEdit={canEdit}
          pickable={pickable}
        />
        {setup.columns.length === 0 ? null : (
          <div
            ref={gridRef}
            className="relative grid min-h-full gap-3"
            style={{
              gridTemplateColumns: columnTemplate,
              gridTemplateRows: boardRowTemplate(
                lanes.map((l) => l.key),
                withLanes,
                collapsed,
              ),
            }}
          >
            {projection.columns.map((col) => (
              <PlanColumnHeader
                key={col.column.id}
                col={col}
                setup={setup}
                palette={palette}
                canEdit={setUpHere}
                onChange={(next, part) => {
                  if (part === 'ColumnReordered') columnMove.beforeMove(col.column.id);
                  plan?.updateBoard(element.id, next);
                  trackSetup(part);
                }}
                onMoveCards={(from, to) => {
                  if (!plan) return;
                  const moving = [...items.values()].filter((it) => itemStatus(it) === from);
                  const stay = cardsMovingRefused(moving, plan.types, to);
                  for (const it of moving)
                    if (!stay.has(it.id)) plan.moveItem(it.id, { status: to, before: null });
                  // One announcement for the cards whose type leaves the status out, never one each.
                  if (stay.size) plan.announce(cardsStayedMessage(stay.size, columnName(to)));
                }}
                onFrame={frameColumn ?? undefined}
                onDeleteStatus={(status) => plan?.removeStatusColumns(status, element.id)}
                onTrashCards={(status) => {
                  if (!plan) return;
                  // Every card in the state, whatever board shows it (the column's removal moves them all).
                  const went = plan.trashItems(
                    [...plan.items.values()]
                      .filter((it) => itemStatus(it) === status && !isTrashed(it))
                      .map((it) => it.id),
                  );
                  if (went)
                    plan.announce(`${went === 1 ? 'Card' : `${went} cards`} moved to the Trash`);
                }}
              />
            ))}
            {/* One column a screen, each column's snap point: a marker over its full height, out of the grid's
                flow, rather than its sticky header, so scrolling down moves no snap point and nothing re-snaps
                mid-scroll (docs/specs/026-plan/plan-board.md "On a phone"). */}
            {look.columns === 'phone'
              ? projection.columns.map((col, i) => (
                  <div
                    key={`snap-${col.column.id}`}
                    aria-hidden
                    data-plan-snap
                    className="pointer-events-none absolute inset-y-0 left-0 snap-center snap-always"
                    // Its own width: an absolute item's right edge would reach only the grid's own box, not its
                    // column's, since the columns run past it.
                    style={{ gridColumn: i + 1, gridRow: '1 / -1', width: PHONE_COLUMN_WIDTH }}
                  />
                ))
              : null}
            {lanes.map((lane, laneIndex) => {
              const shut = collapsed.has(lane.key);
              return (
                <LaneRow
                  key={lane.key || `none-${laneIndex}`}
                  lane={lane}
                  withLanes={withLanes}
                  span={setup.columns.length}
                  palette={palette}
                  shut={shut}
                  onToggle={() =>
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(lane.key)) next.delete(lane.key);
                      else next.add(lane.key);
                      return next;
                    })
                  }
                >
                  {shut
                    ? null
                    : projection.columns.map((col) => {
                        const cell = col.lanes.find((l) => l.laneKey === lane.key)?.items ?? [];
                        // The gap a card would land in: one dragged on this board, or one held
                        // over it from another board.
                        const held =
                          dragging && !dragging.outside && dragging.slot
                            ? {
                                slot: dragging.slot,
                                height: dragging.height,
                                itemId: dragging.itemId,
                                ...(dragging.refused ? { refused: dragging.refused } : {}),
                              }
                            : incoming;
                        const slotHere =
                          held &&
                          held.slot.status === col.column.status &&
                          held.slot.laneKey === lane.key
                            ? held.slot
                            : null;
                        const isAdding =
                          adding?.status === col.column.status && adding.laneKey === lane.key;
                        const firstEmpty =
                          empty && canEditCards && laneIndex === 0 && col === projection.columns[0];
                        const done = isDoneColumn(setup, col.column);
                        // Every type the board takes may be added in any cell: a type's left-out statuses only
                        // stop a card moving there (docs/specs/026-plan/item-types.md "An item type").
                        const cellTypes = addTypes;
                        return (
                          <div
                            key={col.column.id}
                            {...{ [COLUMN_ATTR]: col.column.id }}
                            data-plan-status={col.column.status}
                            data-plan-lane={lane.key}
                            className="flex min-h-16 flex-col gap-2 rounded-b-lg px-2 pb-2 pt-1"
                            style={{ backgroundColor: palette.column }}
                          >
                            {/* The cards are the list; the column's Add card button follows it rather than sitting in it,
                                since a list holds only its items. Empty, it takes no room, so the button sits where it
                                always did. */}
                            <div
                              role="list"
                              aria-label={`${col.column.name}${withLanes && lane.label ? `, ${lane.label}` : ''}, ${cell.length} ${cell.length === 1 ? 'item' : 'items'}`}
                              className="flex flex-col gap-2 empty:hidden"
                            >
                              {loading
                                ? [0, 1].map((k) => (
                                    <div
                                      key={k}
                                      className="h-16 animate-pulse rounded-lg motion-reduce:animate-none"
                                      style={{ backgroundColor: palette.card, opacity: 0.6 }}
                                    />
                                  ))
                                : null}
                              {cell.map((item) => (
                                <PlanBoardCard
                                  key={item.id}
                                  item={item}
                                  palette={palette}
                                  placeholderBefore={
                                    slotHere?.beforeId === item.id && held?.itemId !== item.id
                                      ? held?.height
                                      : undefined
                                  }
                                  lifted={dragging?.itemId === item.id}
                                  done={done}
                                  // What a card shows is its type's Display (docs/specs/026-plan/item-types.md "Card display").
                                  setupFields={CARD_FIELDS}
                                  cardSize={look.cardSize}
                                  touch={look.cardTouch}
                                  faceDown={cardIsFaceDown(item, setup, self?.id ?? '')}
                                  presence={plan?.presence.get(item.id)}
                                  interactive={interactive}
                                  onPress={onCardPress}
                                  onOpen={() => plan?.openItem(item.id)}
                                  onKey={onCardKey}
                                  onMenu={(it, at) => setMenu({ itemId: it.id, at })}
                                  cardVote={cardVote}
                                  {...(interactive && canEditCards
                                    ? {
                                        onLongPress: (it: Item, at: { x: number; y: number }) => {
                                          // The held press opens the menu instead of becoming a drag or a click.
                                          drag.cancelPress();
                                          setMenu({ itemId: it.id, at });
                                        },
                                      }
                                    : {})}
                                />
                              ))}
                              {slotHere && slotHere.beforeId === null ? (
                                <DropGap
                                  height={held!.height}
                                  palette={palette}
                                  refused={held?.refused}
                                />
                              ) : null}
                            </div>
                            {canEditCards &&
                            !loading &&
                            !setup.archive &&
                            (cellTypes.length || createType) ? (
                              <AddCardButton
                                palette={palette}
                                types={cellTypes}
                                label={firstEmpty ? 'Add your first card' : 'Add card'}
                                open={isAdding}
                                onClosed={closeAdding}
                                onCreateType={createType}
                                onAdd={({ type, fields }) => {
                                  // Opened at once to be named (plan-board.md "Open an item").
                                  const id = newItemId();
                                  void plan?.addItem({
                                    id,
                                    type,
                                    fields: {
                                      ...fields,
                                      ...(withLanes ? laneMove(lane).set : {}),
                                    },
                                    status: cellStatus(setup, col.column.status, lane),
                                    after: cell[cell.length - 1]?.id ?? null,
                                  });
                                  plan?.openNewItem(id);
                                }}
                              />
                            ) : null}
                          </div>
                        );
                      })}
                </LaneRow>
              );
            })}
          </div>
        )}
      </div>
      {menu && plan ? (
        <PlanCardMenuHost
          menu={menu}
          plan={plan}
          setup={setup}
          // A Participant works on cards (duplicates, moves, flags) and never retires them, as in the item panel.
          canEdit={canEditCards}
          canRetire={canEdit}
          onClose={() => setMenu(null)}
        />
      ) : null}
      {dragging && items.get(dragging.itemId) ? (
        <PlanDragGhost
          drag={dragging}
          pointer={drag.pointer}
          size={look.cardSize}
          item={items.get(dragging.itemId)!}
          palette={palette}
          fields={CARD_FIELDS}
        />
      ) : null}
    </div>
  );
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
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: radius,
        borderWidth: 1,
        borderStyle: 'solid',
      }}
    >
      {board}
    </MaximisableSlot>
  );
}
