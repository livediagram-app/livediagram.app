'use client';

// A Plan board's header (docs/specs/026-plan/board-widgets.md "The header"): the title, the board's
// widgets, then Reveal and Retry when they apply, Maximise Board, and the list of items not on the board. The header's
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
import { lucideGripVertical } from '@livediagram/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';
import { BoardWidgetView, type WidgetContext } from './widgets/BoardWidgetView';
import { BoardWidgetZone } from './widgets/BoardWidgetZone';
import { BoardTitle } from './BoardTitle';
import { typeStatusRefusal } from '@/hooks/plan/status-refusal';
import type { PlanPalette } from './plan-palette';

// The shared six-dot grip (the article zone bar's), a board's move handle.
const GripIcon = lucideGlyph(lucideGripVertical, 16);

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
  canRename = false,
  onWidgets,
  onSetup,
  onOpenItem,
  onRetry,
  onReveal,
  onMoveUnplaced,
  end,
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
  // A double-click on the title (or the header's empty space) renames the board: someone who may edit, in Plan
  // mode (docs/specs/026-plan/plan-board.md "What the board shows").
  canRename?: boolean;
  onWidgets: (next: BoardWidgetKind[]) => void;
  // A set-up change a widget makes (Set Done Column), with its telemetry part.
  onSetup: (next: PlanBoardSetup, part: string) => void;
  onOpenItem: (itemId: string) => void;
  onRetry: () => void;
  onReveal: () => void;
  onMoveUnplaced: (item: Item, status: string) => void;
  // What ends the header at its top right: Maximise Board / Restore Board (MaximisedPlanLayer).
  end?: React.ReactNode;
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
  const [renaming, setRenaming] = useState(false);
  const button =
    'h-7 shrink-0 rounded-md border px-2 text-[12px] font-medium transition enabled:cursor-pointer disabled:opacity-50';
  return (
    <div
      data-board-header
      className="relative flex h-[52px] shrink-0 items-center gap-3 px-4"
      style={{ color: palette.text }}
      onDoubleClick={(e) => {
        if (!canRename || renaming) return;
        // The title, or the header's own empty space; never a widget or a button.
        const t = e.target as HTMLElement;
        if (t !== e.currentTarget && !t.closest('[data-board-title]')) return;
        e.stopPropagation();
        setRenaming(true);
      }}
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
          <GripIcon />
        </span>
      ) : null}
      <span data-board-title className="contents">
        <BoardTitle
          title={setup.title}
          editing={renaming}
          selected={selected}
          palette={palette}
          onRename={(title) => onSetup({ ...setup, title }, 'Title')}
          onDone={() => setRenaming(false)}
        />
      </span>
      {/* No press guard here: a press on the zone's empty space selects and moves the board like the
          rest of the header; each widget keeps its own presses. */}
      <div className="flex min-w-0 flex-1 items-center">
        <BoardWidgetZone
          widgets={widgets}
          canEdit={canEdit}
          selected={selected}
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
      {end}
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
          {projection.unplaced.map((item) => {
            // Only the columns whose status the card's type uses (docs/specs/026-plan/item-types.md).
            const open = setup.columns.filter(
              (c) => typeStatusRefusal(types, item.type, c.status, () => c.name) === null,
            );
            return (
              <div key={item.id} className="flex items-center gap-2 rounded px-1 py-1 text-[12px]">
                <span className="min-w-0 flex-1 truncate">
                  #{item.key} {itemTitle(item)}
                </span>
                {canEdit && open.length > 0 ? (
                  <select
                    aria-label={`Move #${item.key} to`}
                    className="rounded border bg-transparent px-1 text-[12px]"
                    style={{ borderColor: palette.border, color: palette.text }}
                    value=""
                    onChange={(e) => e.target.value && onMoveUnplaced(item, e.target.value)}
                  >
                    <option value="">Move to</option>
                    {open.map((c) => (
                      <option key={c.id} value={c.status}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
