'use client';

// The Plan board's body on the canvas (docs/specs/025-plan/plan-board.md, blueprint plan-board.md):
// its set-up projected over the document's items into columns, rows and cards. In Plan mode cards
// take the pointer and the keyboard; in the other modes the board is an element like any other and a
// double-click opens a card. Everything the board changes goes through PlanContext.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ShapeElement } from '@livediagram/document';
import {
  cardIsFaceDown,
  itemAccessibleName,
  normaliseBoardSetup,
  projectBoard,
  votesSpent,
  type Item,
  type ItemMove,
  type LaneHead,
  type QuickFilter,
} from '@livediagram/items';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { track } from '@/lib/telemetry';
import { usePlanCardDrag, type PlanDropSlot } from '@/hooks/plan/usePlanCardDrag';
import { usePlan } from './PlanContext';
import { PlanBoardHeader } from './PlanBoardHeader';
import { PlanCardFace, myVotes } from './PlanCardFace';
import { PlanQuickAdd } from './PlanQuickAdd';
import { planBoardKey } from './plan-board-keys';
import { initialsOf, planPalette, type PlanPalette } from './plan-palette';

// Each column is at least this wide (blueprint DEFAULTS D7); a narrower board scrolls sideways.
export const PLAN_COLUMN_MIN_PX = 220;

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
const NO_ITEMS: ReadonlyMap<string, Item> = new Map();

function laneMove(lane: LaneHead | undefined): Pick<ItemMove, 'set' | 'clear' | 'type'> {
  if (!lane || !lane.field) return {};
  if (lane.field === 'type') return typeof lane.value === 'string' ? { type: lane.value } : {};
  return lane.value === null ? { clear: [lane.field] } : { set: { [lane.field]: lane.value } };
}

export function PlanBoardView({ element }: { element: ShapeElement }) {
  const plan = usePlan();
  const surface = useCanvasSurface();
  const palette = planPalette(surface);
  const setup = useMemo(() => normaliseBoardSetup(element.planBoard), [element.planBoard]);
  const [quick, setQuick] = useState<QuickFilter>({});
  const [adding, setAdding] = useState<{ status: string; laneKey: string } | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const boardRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const focusNextRef = useRef<string | null>(null);
  const items = plan?.items ?? NO_ITEMS;
  const projection = useMemo(
    () => (setup ? projectBoard(setup, items, quick) : null),
    [setup, items, quick],
  );
  const interactive = !!plan?.planInput;
  const canEdit = !!plan?.canEdit;

  const drag = usePlanCardDrag({
    boardRef,
    enabled: interactive && canEdit,
    onClick: (id) => plan?.openItem(id),
    onDrop: (id, slot) => drop(id, slot),
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
    onDragging: (id) => plan?.setDragging(id),
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

  function drop(itemId: string, slot: PlanDropSlot) {
    if (!plan) return;
    const item = items.get(itemId);
    const lane = lanes.find((l) => l.key === slot.laneKey);
    const sameCell =
      item?.fields['status'] === slot.status &&
      (!withLanes || lanesOfItem(itemId) === slot.laneKey);
    if (sameCell && slot.beforeId === nextInCell(itemId)) return;
    plan.moveItem(itemId, {
      status: slot.status,
      before: slot.beforeId,
      ...(withLanes && lanesOfItem(itemId) !== slot.laneKey ? laneMove(lane) : {}),
    });
    const column = setup!.columns.find((c) => c.status === slot.status);
    plan.announce(`Moved to ${column?.name ?? slot.status}`);
  }

  function lanesOfItem(itemId: string): string | undefined {
    for (const c of projection!.columns)
      for (const l of c.lanes) if (l.items.some((i) => i.id === itemId)) return l.laneKey;
    return undefined;
  }

  function nextInCell(itemId: string): string | null {
    for (const c of projection!.columns)
      for (const l of c.lanes) {
        const i = l.items.findIndex((x) => x.id === itemId);
        if (i >= 0) return l.items[i + 1]?.id ?? null;
      }
    return null;
  }

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
      role="region"
      aria-label={setup.title}
      className="absolute inset-0 flex flex-col overflow-hidden rounded-xl border"
      style={{ backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }}
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
        onSetup={() => plan?.openSetup(element.id)}
        onMoveUnplaced={(item, status) => plan?.moveItem(item.id, { status, before: null })}
      />
      <div
        ref={bodyRef}
        className="min-h-0 flex-1 overflow-auto px-3 pb-3"
        onPointerDown={interactive ? stop : undefined}
      >
        <div className="grid gap-3" style={{ gridTemplateColumns: columnTemplate }}>
          {projection.columns.map((col) => (
            <div
              key={col.column.id}
              className="sticky top-0 z-[1] rounded-t-lg px-3 pb-1.5 pt-2"
              style={{ backgroundColor: palette.column }}
            >
              <div
                className="mb-1.5 h-1 rounded-full"
                style={{ backgroundColor: col.column.color ?? palette.border }}
                aria-hidden
              />
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-semibold">{col.column.name}</span>
                <span
                  className="ml-auto rounded-full px-1.5 text-[11px] font-semibold tabular-nums"
                  style={{
                    color: col.overLimit ? palette.warning : palette.muted,
                    backgroundColor: col.overLimit ? palette.warningBg : 'transparent',
                  }}
                  aria-label={
                    col.column.wipLimit
                      ? `${col.count} of a WIP limit of ${col.column.wipLimit}${col.overLimit ? ', over the limit' : ''}`
                      : `${col.count} items`
                  }
                >
                  {col.column.wipLimit ? `${col.count} / ${col.column.wipLimit}` : col.count}
                </span>
              </div>
              {col.overLimit ? (
                <div className="text-[10px] font-medium" style={{ color: palette.warning }}>
                  Over WIP limit
                </div>
              ) : null}
            </div>
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
                      const slotHere =
                        dragging?.slot &&
                        dragging.slot.status === col.column.status &&
                        dragging.slot.laneKey === lane.key
                          ? dragging.slot
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
                                slotHere?.beforeId === item.id && dragging?.itemId !== item.id
                                  ? dragging?.height
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
                            />
                          ))}
                          {slotHere && slotHere.beforeId === null ? (
                            <div
                              className="rounded-lg border-2 border-dashed"
                              style={{ height: dragging!.height, borderColor: palette.focus }}
                              aria-hidden
                            />
                          ) : null}
                          {isAdding || firstEmpty ? (
                            <PlanQuickAdd
                              palette={palette}
                              people={plan?.people ?? []}
                              defaultType={defaultType}
                              autoFocus={isAdding}
                              emptyHint={
                                firstEmpty && !isAdding ? 'Add your first item' : undefined
                              }
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
                              onClose={() => setAdding(null)}
                            />
                          ) : canEdit && !loading ? (
                            <button
                              type="button"
                              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-left text-[12px] font-medium transition enabled:cursor-pointer hover:bg-black/5"
                              style={{ color: palette.muted }}
                              onPointerDown={stop}
                              onClick={(e) => {
                                stop(e);
                                setAdding({ status: col.column.status, laneKey: lane.key });
                              }}
                            >
                              + Add item
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
              </LaneRow>
            );
          })}
        </div>
      </div>
      {dragging && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[1000] rotate-2 opacity-90 shadow-xl motion-reduce:rotate-0"
              style={{
                left: dragging.clientX - dragging.offsetX,
                top: dragging.clientY - dragging.offsetY,
                width: dragging.width,
                height: dragging.height,
              }}
            >
              {items.get(dragging.itemId) ? (
                <PlanCardFace
                  item={items.get(dragging.itemId)!}
                  palette={palette}
                  fields={setup.cardFields}
                />
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

// A row of the board: with swimlanes, a labelled, collapsible band over its cells.
function LaneRow({
  lane,
  withLanes,
  span,
  palette,
  shut,
  onToggle,
  children,
}: {
  lane: LaneHead;
  withLanes: boolean;
  span: number;
  palette: PlanPalette;
  shut: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  if (!withLanes) return <>{children}</>;
  return (
    <>
      <button
        type="button"
        className="flex items-center gap-2 rounded-md px-1 pt-2 text-left text-[12px] font-semibold enabled:cursor-pointer"
        style={{ gridColumn: `span ${span}`, color: palette.muted }}
        aria-expanded={!shut}
        onPointerDown={stop}
        onClick={onToggle}
      >
        <span aria-hidden>{shut ? '▸' : '▾'}</span>
        {lane.person ? (
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{ backgroundColor: lane.person.color }}
            aria-hidden
          >
            {initialsOf(lane.person.name)}
          </span>
        ) : null}
        <span style={{ color: palette.text }}>{lane.label}</span>
      </button>
      {children}
    </>
  );
}

// One card in a cell: a focusable list item that the pointer picks up in Plan mode.
function PlanBoardCard({
  item,
  palette,
  placeholderBefore,
  lifted,
  done,
  setupFields,
  faceDown,
  voting,
  presence,
  interactive,
  onPress,
  onOpen,
  onKey,
}: {
  item: Item;
  palette: PlanPalette;
  placeholderBefore: number | undefined;
  lifted: boolean;
  done: boolean;
  setupFields: Parameters<typeof PlanCardFace>[0]['fields'];
  faceDown: boolean;
  voting: Parameters<typeof PlanCardFace>[0]['voting'];
  presence: Parameters<typeof PlanCardFace>[0]['presence'];
  interactive: boolean;
  onPress: (id: string, e: React.PointerEvent<HTMLElement>) => void;
  onOpen: () => void;
  onKey: (item: Item, e: React.KeyboardEvent<HTMLElement>) => void;
}) {
  return (
    <>
      {placeholderBefore !== undefined ? (
        <div
          className="rounded-lg border-2 border-dashed"
          style={{ height: placeholderBefore, borderColor: palette.focus }}
          aria-hidden
        />
      ) : null}
      <div
        role="listitem"
        tabIndex={0}
        data-plan-card={item.id}
        aria-label={faceDown ? 'Hidden card' : itemAccessibleName(item)}
        className="rounded-lg outline-none transition-opacity focus-visible:ring-2"
        style={{
          opacity: lifted ? 0.35 : 1,
          cursor: interactive ? 'grab' : undefined,
          ['--tw-ring-color' as string]: palette.focus,
        }}
        onPointerDown={(e) => onPress(item.id, e)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        onKeyDown={(e) => onKey(item, e)}
      >
        <PlanCardFace
          item={item}
          palette={palette}
          fields={setupFields}
          faceDown={faceDown}
          muted={done}
          presence={presence}
          voting={faceDown ? undefined : voting}
        />
      </div>
    </>
  );
}
