'use client';

// A Plan board's header (docs/specs/025-plan/board-widgets.md "The header"): the title, the board's
// widgets, then Reveal and Retry when they apply, and the list of items not on the board. The header's
// own background is the board's handle: a press there moves the board, its controls do not.
import { useState } from 'react';
import {
  itemTitle,
  widgetsOf,
  type BoardProjection,
  type BoardWidgetKind,
  type Item,
  type ItemTypeDef,
  type PlanBoardSetup,
  type QuickFilter,
} from '@livediagram/items';
import { BoardWidgetView, type WidgetContext } from './widgets/BoardWidgetView';
import { BoardWidgetZone } from './widgets/BoardWidgetZone';
import { GripArt } from './plan-tile-art';
import type { PlanPalette } from './plan-palette';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function PlanBoardHeader({
  setup,
  projection,
  items,
  types,
  palette,
  quick,
  onQuick,
  canFilterMine,
  canEdit,
  votesLeft,
  loadFailed,
  widgetDropAt,
  flashWidget,
  selected = false,
  onWidgets,
  onSetup,
  onOpenItem,
  onRetry,
  onReveal,
  onMoveUnplaced,
}: {
  setup: PlanBoardSetup;
  projection: BoardProjection;
  // The items the board shows, unfiltered, for the widgets that count them.
  items: readonly Item[];
  types: readonly ItemTypeDef[];
  palette: PlanPalette;
  quick: QuickFilter;
  onQuick: (q: QuickFilter) => void;
  canFilterMine: string | null;
  canEdit: boolean;
  votesLeft: number | null;
  loadFailed: boolean;
  // Where a widget dragged from the palette would land in the zone.
  widgetDropAt: number | null;
  // A widget placed again that the board already had, flashed so it is found.
  flashWidget: BoardWidgetKind | null;
  // The board is selected: the header shows its move handle.
  selected?: boolean;
  onWidgets: (next: BoardWidgetKind[]) => void;
  // A set-up change a widget makes (Set Done Column), with its telemetry part.
  onSetup: (next: PlanBoardSetup, part: string) => void;
  onOpenItem: (itemId: string) => void;
  onRetry: () => void;
  onReveal: () => void;
  onMoveUnplaced: (item: Item, status: string) => void;
}) {
  const [trayOpen, setTrayOpen] = useState(false);
  const widgets = widgetsOf(setup);
  const ctx: WidgetContext = {
    setup,
    projection,
    items,
    types,
    palette,
    quick,
    onQuick,
    canFilterMine,
    votesLeft,
    trayOpen,
    onToggleTray: () => setTrayOpen((o) => !o),
    now: new Date(),
    canEdit,
    onSetup,
    onOpenItem,
  };
  const button =
    'h-7 shrink-0 rounded-md border px-2 text-[12px] font-medium transition enabled:cursor-pointer disabled:opacity-50';
  return (
    <div
      data-board-header
      className="relative flex h-[52px] shrink-0 items-center gap-3 px-4"
      style={{ color: palette.text }}
    >
      {/* While the board is selected, a grip before the title says where to take hold of it: the
          header moves the board, its columns and cards do not. */}
      {selected ? (
        <span
          data-board-grip
          className="-ml-2 flex h-7 w-5 shrink-0 cursor-move items-center justify-center rounded"
          style={{ color: palette.muted }}
          aria-hidden
        >
          <GripArt size={16} />
        </span>
      ) : null}
      <div
        className={`min-w-0 max-w-[40%] shrink-0 truncate text-[17px] font-bold leading-tight ${
          selected ? 'cursor-move' : ''
        }`}
      >
        {setup.title}
      </div>
      {/* No press guard here: a press on the zone's empty space selects and moves the board like the
          rest of the header; each widget keeps its own presses. */}
      <div className="flex min-w-0 flex-1 items-center">
        <BoardWidgetZone
          widgets={widgets}
          canEdit={canEdit}
          palette={palette}
          dropAt={widgetDropAt}
          flash={flashWidget}
          onChange={(next) => {
            // Taking a widget off clears what it narrowed.
            const kept: QuickFilter = { ...quick };
            if (!next.includes('filter')) delete kept.text;
            if (!next.includes('mine')) delete kept.mine;
            if (!next.includes('types')) delete kept.type;
            if (!next.includes('due')) delete kept.due;
            if (!next.includes('priorities')) delete kept.priority;
            if (!next.includes('people') && !next.includes('unassigned')) delete kept.person;
            if (Object.keys(kept).length !== Object.keys(quick).length) onQuick(kept);
            onWidgets(next);
          }}
          render={(kind) => <BoardWidgetView kind={kind} ctx={ctx} />}
        />
      </div>
      {loadFailed || (setup.hideWriting && canEdit) ? (
        <div className="flex shrink-0 items-center gap-2" onPointerDown={stop}>
          {loadFailed ? (
            <button
              type="button"
              className={button}
              style={{ borderColor: palette.warning, color: palette.warning }}
              onClick={onRetry}
            >
              Couldn&rsquo;t load items · Retry
            </button>
          ) : null}
          {setup.hideWriting && canEdit ? (
            <button
              type="button"
              className={button}
              style={{ borderColor: palette.focus, color: palette.focus }}
              onClick={onReveal}
            >
              Reveal
            </button>
          ) : null}
        </div>
      ) : null}
      {trayOpen && projection.unplaced.length > 0 ? (
        <div
          className="absolute right-4 top-12 z-10 max-h-72 w-80 overflow-y-auto rounded-lg border p-2 shadow-lg"
          style={{ backgroundColor: palette.card, borderColor: palette.border }}
          onPointerDown={stop}
          role="dialog"
          aria-label="Items not on this board"
        >
          <div className="mb-1 px-1 text-[11px]" style={{ color: palette.muted }}>
            Their status is none of this board&rsquo;s columns.
          </div>
          {projection.unplaced.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded px-1 py-1 text-[12px]">
              <span className="min-w-0 flex-1 truncate">
                #{item.key} {itemTitle(item)}
              </span>
              {canEdit ? (
                <select
                  aria-label={`Move #${item.key} to`}
                  className="rounded border bg-transparent px-1 text-[12px]"
                  style={{ borderColor: palette.border, color: palette.text }}
                  value=""
                  onChange={(e) => e.target.value && onMoveUnplaced(item, e.target.value)}
                >
                  <option value="">Move to</option>
                  {setup.columns.map((c) => (
                    <option key={c.id} value={c.status}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
