'use client';

// The Plan board's body on the canvas (docs/specs/025-plan/plan-board.md, blueprint plan-board.md):
// its set-up projected over the document's items into columns, rows and cards. In Plan mode cards
// take the pointer and the keyboard; in the other modes the board is an element like any other and a
// double-click opens a card. Everything the board changes goes through PlanContext.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cornerRadiusPx, type ShapeElement } from '@livediagram/document';
import {
  ITEM_TYPES,
  itemStatus,
  cardIsFaceDown,
  normaliseBoardSetup,
  projectBoard,
  votesSpent,
  type Item,
  type QuickFilter,
  type BoardScope,
} from '@livediagram/items';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { track } from '@/lib/telemetry';
import { usePlanBoardDrop } from '@/hooks/plan/usePlanBoardDrop';
import { laneMove } from './plan-board-moves';
import { LaneRow, PlanBoardCard, PlanDragGhost } from './PlanBoardCells';
import { PlanColumnHeader } from './PlanColumnHeader';
import { trackSetup } from './track-board-setup';
import { PlanCardMenuHost } from './PlanCardMenu';
import { usePlan } from './PlanContext';
import { PlanBoardHeader } from './PlanBoardHeader';
import { myVotes } from './PlanCardFace';
import { AddCardButton } from './AddCardButton';
import { planBoardKey } from './plan-board-keys';
import { planOwnColours, planPalette } from './plan-palette';

// A board's corner radius when it has none of its own (Quick Style's Corners sets one).
const PLAN_BOARD_RADIUS_PX = 12;

// Each column is at least this wide (blueprint DEFAULTS D7); a narrower board scrolls sideways.
export const PLAN_COLUMN_MIN_PX = 220;

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
const NO_ITEMS: ReadonlyMap<string, Item> = new Map();

export function PlanBoardView({
  element,
  fontFamily,
}: {
  element: ShapeElement;
  // The tab's (or the element's own) font (docs/specs/025-plan/plan-board.md "Theme and style").
  fontFamily?: string;
}) {
  const plan = usePlan();
  const surface = useCanvasSurface();
  // The board's theme and style colours (docs/specs/025-plan/plan-board.md "Theme and style").
  const palette = planPalette(surface, planOwnColours(element));
  const radius = `${cornerRadiusPx(element.borderRadius, element.width, element.height, PLAN_BOARD_RADIUS_PX)}px`;
  const types = plan?.types ?? ITEM_TYPES;
  // A scope naming a type the catalogue no longer has drops it (docs/specs/025-plan/item-types.md
  // "Editing a type"); a scope left with none shows every type.
  const setup = useMemo(() => {
    const read = normaliseBoardSetup(element.planBoard);
    const scoped = read?.scope.types?.filter((t) => types.some((x) => x.id === t));
    if (!read || !read.scope.types || scoped?.length === read.scope.types.length) return read;
    const scope: BoardScope = scoped?.length
      ? { ...read.scope, types: scoped }
      : read.scope.label
        ? { label: read.scope.label }
        : {};
    return { ...read, scope };
  }, [element.planBoard, types]);
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
  const projection = useMemo(
    () => (setup ? projectBoard(setup, items, quick, types) : null),
    [setup, items, quick, types],
  );
  const interactive = !!plan?.planInput;
  const canEdit = !!plan?.canEdit;

  const { drag, incoming } = usePlanBoardDrop({
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
  const withLanes = setup.swimlaneBy !== 'none';
  const self = plan?.self ?? null;
  const spent = self ? votesSpent(projection, self.id) : 0;
  const votesLeft =
    setup.voting.on && setup.voting.budget !== undefined
      ? Math.max(0, setup.voting.budget - spent)
      : null;
  const loading = plan?.status === 'loading';
  const empty = !loading && projection.total === 0;
  const defaultType = setup.scope.types?.[0] ?? 'task';
  // The types Add card offers: the ones this board shows (docs/specs/025-plan/plan-board.md).
  const scopeTypes = setup.scope.types;
  const addTypes = scopeTypes?.length ? types.filter((t) => scopeTypes.includes(t.id)) : types;

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
    else if (action.kind === 'delete') {
      plan.deleteItem(item.id);
      plan.announce(`#${item.key} deleted`);
    } else if (action.kind === 'add') setAdding({ status: action.status, laneKey: action.laneKey });
    else {
      focusNextRef.current = item.id;
      plan.moveItem(item.id, action.move);
      plan.announce(action.announce);
    }
  };

  const dragging = drag.drag;
  const columnTemplate = `repeat(${setup.columns.length}, minmax(${PLAN_COLUMN_MIN_PX}px, 1fr))`;

  return (
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
        palette={palette}
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
        onMoveUnplaced={(item, status) => plan?.moveItem(item.id, { status, before: null })}
      />
      <div
        ref={bodyRef}
        className="min-h-0 flex-1 overflow-auto px-3 pb-3"
        onPointerDown={interactive ? stop : undefined}
      >
        <div className="grid gap-3" style={{ gridTemplateColumns: columnTemplate }}>
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
                for (const it of items.values())
                  if (itemStatus(it) === from) plan?.moveItem(it.id, { status: to, before: null });
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
                              setupFields={setup.cardFields}
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
                            />
                          ))}
                          {slotHere && slotHere.beforeId === null ? (
                            <div
                              className="rounded-lg border-2 border-dashed"
                              style={{ height: held!.height, borderColor: palette.focus }}
                              aria-hidden
                            />
                          ) : null}
                          {canEdit && !loading ? (
                            <AddCardButton
                              palette={palette}
                              types={addTypes}
                              people={plan?.people ?? []}
                              defaultType={defaultType}
                              label={firstEmpty ? 'Add your first card' : 'Add card'}
                              open={isAdding}
                              onClosed={closeAdding}
                              onAdd={({ type, fields }) =>
                                plan?.addItem({
                                  type,
                                  fields: {
                                    ...fields,
                                    ...(withLanes ? laneMove(lane).set : {}),
                                  } as Item['fields'],
                                  status: col.column.status,
                                  after: cell[cell.length - 1]?.id ?? null,
                                })
                              }
                            />
                          ) : null}
                        </div>
                      );
                    })}
              </LaneRow>
            );
          })}
        </div>
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
          item={items.get(dragging.itemId)!}
          palette={palette}
          fields={setup.cardFields}
        />
      ) : null}
    </div>
  );
}
