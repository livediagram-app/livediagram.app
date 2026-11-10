'use client';

// A Plan board's grid (PlanBoardView.tsx): its column heads, a phone's snap points, and a row per lane of cells, each
// a column's cards in that lane with its Add card (docs/specs/026-plan/plan-board.md "What the board shows").
import { isDoneColumn, type LaneHead, type ProjectedColumn } from '@liveplanner/items';
import { DropGap, LaneRow } from './PlanBoardCells';
import { PlanBoardCellCards } from './PlanBoardCellCards';
import { boardRowTemplate } from './plan-board-rows';
import { PHONE_COLUMN_WIDTH } from './plan-board-columns';
import { CollapsedColumnCell } from './CollapsedColumn';
import { COLUMN_ATTR } from './column-move-flip';
import { columnBackgroundMenu } from './column-settings-request';
import { CellAddRow } from './CellAddRow';
import { AddCardButton } from './AddCardButton';
import { columnPartStyle } from './column-part';
import { planBoardColumnHeads } from './PlanBoardColumnHeads';
import type { PlanBoardViewValues } from './plan-board-view-values';

export function planBoardGrid(v: PlanBoardViewValues) {
  const {
    gridRef,
    slotBoard,
    columnTemplate,
    lanes,
    withLanes,
    collapsed,
    look,
    projection,
    collapse,
    setup,
    palette,
  } = v;
  return (
    <div
      ref={gridRef}
      // pt-3: the column heads rest 12 px clear of the board's header (plan-board.md "Column heads stand
      // clear"), a gap that scrolls away so a stuck head sits flush at the top ("Column heads stick flush").
      className={`relative grid min-h-full ${slotBoard ? 'gap-2' : 'gap-3 pt-3'}`}
      style={{
        gridTemplateColumns: columnTemplate,
        gridTemplateRows: boardRowTemplate(
          lanes.map((l) => l.key),
          withLanes,
          collapsed,
        ),
      }}
    >
      {planBoardColumnHeads(v)}
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
            onToggle={() => collapse.toggleLane(lane.key)}
          >
            {shut
              ? null
              : projection.columns.map((col) => planBoardLaneCell(v, lane, laneIndex, col))}
          </LaneRow>
        );
      })}
    </div>
  );
}

// One lane's cell of a column: a collapsed column's strip, or the column's cards in the lane and its Add card.
function planBoardLaneCell(
  v: PlanBoardViewValues,
  lane: LaneHead,
  laneIndex: number,
  col: ProjectedColumn,
) {
  const {
    shutColumns,
    held,
    withLanes,
    firstOpenLane,
    toneOf,
    toggleColumn,
    adding,
    empty,
    canEditCards,
    projection,
    setup,
    shipColumnId,
    addTypes,
    simplified,
    setUpHere,
    loading,
    palette,
    cellBase,
    busy,
    mayAdd,
    addInHead,
    closeAdding,
    addInto,
  } = v;
  const cell = col.lanes.find((l) => l.laneKey === lane.key)?.items ?? [];
  if (shutColumns.has(col.column.id)) {
    const over = held && held.slot.status === col.column.status && held.slot.laneKey === lane.key;
    return (
      <CollapsedColumnCell
        key={`${col.column.id}-strip`}
        column={col.column}
        status={col.column.status}
        laneKey={lane.key}
        laneLabel={withLanes ? lane.label : undefined}
        count={withLanes ? cell.length : col.count}
        limit={withLanes ? undefined : col.column.wipLimit}
        overLimit={!withLanes && col.overLimit}
        named={!withLanes || laneIndex === firstOpenLane}
        palette={toneOf(col.column.id).palette}
        held={over ? (held.refused ? 'refused' : 'over') : null}
        onExpand={() => toggleColumn(col.column.id)}
      />
    );
  }
  const slotHere =
    held && held.slot.status === col.column.status && held.slot.laneKey === lane.key
      ? held.slot
      : null;
  const isAdding = adding?.status === col.column.status && adding.laneKey === lane.key;
  const firstEmpty = empty && canEditCards && laneIndex === 0 && col === projection.columns[0];
  const done = isDoneColumn(setup, col.column);
  // Where the Practice Sprint's cards ship (plan-tour.md "Boards: Practice Sprint").
  const ships = col.column.id === shipColumnId;
  // Every type the board takes may be added in any cell: a type's left-out statuses only
  // stop a card moving there (docs/specs/026-plan/item-types.md "An item type").
  const cellTypes = addTypes;
  return (
    <div
      key={col.column.id}
      {...{ [COLUMN_ATTR]: col.column.id }}
      data-plan-status={col.column.status}
      data-plan-lane={lane.key}
      className={`plan-col flex flex-col rounded-[var(--plan-col-r,8px)] ${
        simplified ? 'min-h-12 gap-1.5 px-1.5 pb-1.5' : 'min-h-16 gap-2 px-2 pb-2 pt-1'
      }`}
      style={columnPartStyle(toneOf(col.column.id).palette)}
      // An Editor's right-click on the column's background opens its settings (plan-board.md
      // "A column's own settings"); anyone else's does what it always did.
      onContextMenu={setUpHere ? columnBackgroundMenu(col.column.id) : undefined}
    >
      {/* The cards are the list; the column's Add card button follows it rather than sitting in it,
                                since a list holds only its items. Empty, it takes no room, so the button sits where it
                                always did. */}
      <div
        role="list"
        aria-label={`${col.column.name}${withLanes && lane.label ? `, ${lane.label}` : ''}, ${cell.length} ${cell.length === 1 ? 'item' : 'items'}`}
        className={`flex flex-col ${simplified ? 'gap-1.5' : 'gap-2'} empty:hidden`}
      >
        {loading
          ? [0, 1].map((k) => (
              <div
                key={k}
                className="h-16 animate-pulse rounded-[var(--plan-card-r,12px)] motion-reduce:animate-none"
                style={{ backgroundColor: palette.card, opacity: 0.6 }}
              />
            ))
          : null}
        <PlanBoardCellCards
          cards={cell}
          base={cellBase}
          done={done}
          ships={ships}
          busy={busy}
          simplified={simplified}
          gapBefore={slotHere && slotHere.beforeId !== held?.itemId ? slotHere.beforeId : null}
          gapHeight={held?.height}
        />
        {slotHere && slotHere.beforeId === null ? (
          <DropGap height={held!.height} palette={palette} refused={held?.refused} />
        ) : null}
      </div>
      {mayAdd && !addInHead ? (
        // It folds away while a drop gap shows here (plan-board.md "Add card steps aside").
        <CellAddRow folded={!!slotHere} gap={simplified ? 6 : 8}>
          <AddCardButton
            palette={palette}
            types={cellTypes}
            label={firstEmpty ? 'Add your first card' : 'Add card'}
            open={isAdding}
            onClosed={closeAdding}
            onAdd={addInto(col.column.status, lane, cell)}
          />
        </CellAddRow>
      ) : null}
    </div>
  );
}
