'use client';

// The Plan board's body on the canvas (docs/specs/026-plan/plan-board.md, blueprint plan-board.md):
// its set-up projected over the document's items into columns, rows and cards. In Plan mode cards
// take the pointer and the keyboard; in the other modes the board is an element like any other and a
// double-click opens a card. Everything the board changes goes through PlanContext.
import { isCardVotableInVote } from '@livediagram/document';
import { useCardVote } from './CardVoteContext';
import { useViewportStoreIfAny } from '@/hooks/canvas/useViewportStore';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { frameBoardColumn } from '@/hooks/plan/frame-board-column';
import { markPanThrough } from '@/hooks/canvas/pan-through';
import { useSelectionOf } from '@/hooks/canvas/useSelectionStore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cornerRadiusPx, type ShapeElement } from '@livediagram/document';
import {
  CARD_FIELDS,
  ITEM_TYPES,
  itemStatus,
  cardIsFaceDown,
  normaliseBoardSetup,
  projectBoard,
  votesSpent,
  type Item,
  type QuickFilter,
  boardAddTypes,
  newItemId,
  isTrashed,
} from '@livediagram/items';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { track } from '@/lib/telemetry';
import { usePlanBoardDrop } from '@/hooks/plan/usePlanBoardDrop';
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
import { PlanFirstColumn } from './PlanFirstColumn';
import { addStatusColumn, addStatusColumns, pickableStatuses } from './column-status-picks';
import { addFirstColumn } from './board-setup-edits';
import { boardItems } from './widgets/widget-stats';
import { trackSetup } from './track-board-setup';
import { PlanCardMenuHost } from './PlanCardMenu';
import { BoardMoreMenu } from './BoardMoreMenu';
import { BoardSettingsButton } from './BoardSettingsButton';
import { usePlanCardFlip } from '@/hooks/plan/usePlanCardFlip';
import { usePlan } from './PlanContext';
import { PlanBoardHeader } from './PlanBoardHeader';
import { myVotes } from './PlanCardFace';
import { AddCardButton } from './AddCardButton';
import { planBoardKey } from './plan-board-keys';
import { planOwnColours, planPalette } from './plan-palette';
import { useMaximisedPlanId } from '@/hooks/plan/maximised-plan';
import {
  MaximisePlanButton,
  MaximisableSlot,
  useMaximisedPlanLifetime,
} from './MaximisedPlanLayer';

// A board's corner radius when it has none of its own (Quick Style's Corners sets one).
const PLAN_BOARD_RADIUS_PX = 12;

// Each column is at least this wide (blueprint DEFAULTS D7); a narrower board scrolls sideways.
export { PLAN_COLUMN_MIN_PX } from '@livediagram/items';
import { PLAN_COLUMN_MIN_PX } from '@livediagram/items';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

// The board body keeps its presses (cards, cells, buttons) from the canvas, except a finger on empty board,
// which pans the canvas as it would anywhere else, never moving the board: only its header does that
// (docs/specs/026-plan/plan-board.md "On a phone").
export function keepBoardPress(e: React.PointerEvent<HTMLElement>): void {
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
  const [quick, setQuick] = useState<QuickFilter>({});
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
    () => (setup ? projectBoard(setup, items, quick, types, statusNames) : null),
    [setup, items, quick, types, statusNames],
  );
  // The statuses a column can be made for: the boards' and any a card is in (docs/specs/026-plan/plan-board.md "The
  // column picker").
  const pickable = useMemo(
    () => pickableStatuses(statusNames ?? NO_STATUSES, items.values()),
    [statusNames, items],
  );
  // What the header's widgets count: the items the board shows, before the quick filter.
  const shownItems = useMemo(
    () => (setup ? boardItems(projectBoard(setup, items, undefined, types, statusNames)) : []),
    [setup, items, types, statusNames],
  );
  const interactive = !!plan?.planInput;
  // Selected (alone or with others): the header shows its move handle.
  const selected = useSelectionOf(
    (s) => s.selectedId === element.id || s.multiSelectedIds.has(element.id),
  );
  const canEdit = !!plan?.canEdit;
  // Maximised, for this person only (docs/specs/026-plan/plan-board.md "Maximised board").
  const maximised = useMaximisedPlanId() === element.id;
  // The tab's session vote, when this board's cards take dots in it (its layer, under a layer-scoped vote).
  const tabCardVote = useCardVote();
  const cardVote =
    tabCardVote && isCardVotableInVote(element, tabCardVote.vote, tabCardVote.layers, false)
      ? tabCardVote
      : null;
  // On a phone a tap on a column's header frames that column on screen, as a tap on a page does in Illustrate.
  const viewport = useViewportStoreIfAny();
  const phone = useIsMobileViewport();
  const frameColumn =
    phone && interactive && !maximised && viewport
      ? (header: HTMLElement) => {
          const board = header.closest<HTMLElement>('[data-plan-board]');
          if (board) frameBoardColumn(header, board, element, viewport);
        }
      : null;
  useMaximisedPlanLifetime(element.id, maximised, interactive);

  const { drag, incoming, widgetSlot, flashWidget } = usePlanBoardDrop({
    element,
    boardRef,
    plan,
    setup,
    projection,
    items,
    interactive,
    canEdit,
  });

  // A press on a card in Plan mode without edit rights still opens it.
  const onCardPress = (id: string, e: React.PointerEvent<HTMLElement>) => {
    if (!interactive) return;
    if (canEdit) drag.onCardPointerDown(id, e);
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
  usePlanCardFlip(bodyRef, flipSignature, drag.drag?.itemId ?? null);

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
  const spent = self ? votesSpent(projection, self.id) : 0;
  const votesLeft =
    setup.voting.on && setup.voting.budget !== undefined
      ? Math.max(0, setup.voting.budget - spent)
      : null;
  const loading = plan?.status === 'loading';
  const empty = !loading && projection.total === 0;
  // Every board shows, and Add card offers, every card type (docs/specs/026-plan/plan-board.md).
  const addTypes = boardAddTypes(setup, types);

  const columnName = (s: string) => setup.columns.find((c) => c.status === s)?.name ?? s;

  const onCardKey = (item: Item, e: React.KeyboardEvent<HTMLElement>) => {
    if (!plan) return;
    const action = planBoardKey(projection, item.id, e.key, e.shiftKey, canEdit);
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    if (action.kind === 'focus') {
      boardRef.current
        ?.querySelector<HTMLElement>(`[data-plan-card="${CSS.escape(action.itemId)}"]`)
        ?.focus();
    } else if (action.kind === 'open') plan.openItem(item.id);
    else if (action.kind === 'trash') {
      plan.trashItem(item.id);
      plan.announce(`#${item.key} moved to the Trash`);
    } else if (action.kind === 'add') setAdding({ status: action.status, laneKey: action.laneKey });
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
  // A slot per column, two or three for a wider one (docs/specs/026-plan/plan-board.md "The board set-up").
  const columnTemplate = setup.columns
    .map((c) => `minmax(${PLAN_COLUMN_MIN_PX * (c.width ?? 1)}px, ${c.width ?? 1}fr)`)
    .join(' ');

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
        ...(fontFamily ? { fontFamily } : {}),
      }}
    >
      <PlanBoardHeader
        setup={setup}
        projection={projection}
        items={shownItems}
        types={types}
        palette={palette}
        widgetDropAt={widgetSlot}
        flashWidget={flashWidget}
        selected={selected}
        canRename={canEdit && interactive}
        onOpenItem={(id) => plan?.openItem(id)}
        onSetup={(next, part) => {
          plan?.updateBoard(element.id, next);
          trackSetup(part);
        }}
        onWidgets={(next) => {
          plan?.updateBoard(element.id, { ...setup, widgets: next });
          trackSetup('Widgets');
        }}
        quick={quick}
        onQuick={setQuick}
        canFilterMine={self?.id ?? null}
        canEdit={canEdit}
        votesLeft={votesLeft}
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
              {/* The board's settings, the same as its element menu's Board and Cards, for an editor. */}
              <BoardMoreMenu boardId={element.id} title={setup.title} />
              {canEdit ? <BoardSettingsButton element={element} palette={palette} /> : null}
              <MaximisePlanButton id={element.id} maximised={maximised} palette={palette} />
            </>
          ) : null
        }
      />
      <div
        ref={bodyRef}
        // A scroll container resets touch-action, so without touch-none a finger on a card starts a native
        // scroll and the browser cancels the drag; the canvas pans across empty board instead. Maximised, the
        // board covers the canvas, so a finger on empty board scrolls the board itself; each card is touch-none
        // on its own, so a finger on one still picks it up.
        className={`min-h-0 flex-1 overflow-auto px-3 pb-3 ${
          interactive ? (maximised ? 'touch-pan-x touch-pan-y' : 'touch-none') : ''
        }`}
        onPointerDown={interactive ? keepBoardPress : undefined}
      >
        {setup.columns.length === 0 ? (
          <PlanFirstColumn
            palette={palette}
            canEdit={canEdit}
            setup={setup}
            statusNames={pickable}
            onAdd={(name) => {
              const next = addFirstColumn(setup, name, pickable);
              if (!next) return;
              plan?.updateBoard(element.id, next);
              trackSetup('ColumnAdded');
            }}
            onPick={(pick) => {
              const added = addStatusColumn(setup, null, pick);
              if (!added) return;
              plan?.updateBoard(element.id, added.setup);
              trackSetup('ColumnAdded');
            }}
            onPickAll={(picks) => {
              plan?.updateBoard(element.id, addStatusColumns(setup, null, picks));
              trackSetup('ColumnAdded');
            }}
          />
        ) : (
          <div
            className="grid min-h-full gap-3"
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
                canEdit={canEdit}
                onChange={(next, part) => {
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
                          empty && canEdit && laneIndex === 0 && col === projection.columns[0];
                        const done = setup.doneColumnId === col.column.id;
                        // Every type the board takes may be added in any cell: a type's left-out statuses only
                        // stop a card moving there (docs/specs/026-plan/item-types.md "An item type").
                        const cellTypes = addTypes;
                        return (
                          <div
                            key={col.column.id}
                            data-plan-status={col.column.status}
                            data-plan-lane={lane.key}
                            role="list"
                            aria-label={`${col.column.name}${withLanes && lane.label ? `, ${lane.label}` : ''}, ${cell.length} ${cell.length === 1 ? 'item' : 'items'}`}
                            className="flex min-h-16 flex-col gap-2 rounded-b-lg px-2 pb-2 pt-1"
                            style={{ backgroundColor: palette.column }}
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
                                cardSize={setup.cardSize}
                                faceDown={cardIsFaceDown(item, setup, self?.id ?? '')}
                                voting={
                                  setup.voting.on
                                    ? {
                                        mine: myVotes(item, self?.id),
                                        canVote: !!plan?.canVote && !!self,
                                        budgetLeft: votesLeft,
                                        onVote: (d) => plan?.vote(item.id, d),
                                      }
                                    : undefined
                                }
                                presence={plan?.presence.get(item.id)}
                                interactive={interactive}
                                onPress={onCardPress}
                                onOpen={() => plan?.openItem(item.id)}
                                onKey={onCardKey}
                                onMenu={(it, at) => setMenu({ itemId: it.id, at })}
                                cardVote={cardVote}
                                {...(interactive && canEdit
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
                            {canEdit && !loading && !setup.archive && cellTypes.length ? (
                              <AddCardButton
                                palette={palette}
                                types={cellTypes}
                                label={firstEmpty ? 'Add your first card' : 'Add card'}
                                open={isAdding}
                                onClosed={closeAdding}
                                onAdd={({ type, fields }) => {
                                  // Opened at once to be named (plan-board.md "Open an item").
                                  const id = newItemId();
                                  plan?.addItem({
                                    id,
                                    type,
                                    fields: {
                                      ...fields,
                                      ...(withLanes ? laneMove(lane).set : {}),
                                    } as Item['fields'],
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
          canEdit={canEdit}
          onClose={() => setMenu(null)}
        />
      ) : null}
      {dragging && items.get(dragging.itemId) ? (
        <PlanDragGhost
          drag={dragging}
          pointer={drag.pointer}
          size={setup.cardSize}
          item={items.get(dragging.itemId)!}
          palette={palette}
          fields={CARD_FIELDS}
        />
      ) : null}
    </div>
  );
  // One stable tree whether maximised or not (MaximisableSlot), so the board keeps its state both ways; while it
  // fills the screen, the canvas keeps its place, empty.
  return (
    <MaximisableSlot
      id={element.id}
      maximised={maximised}
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
