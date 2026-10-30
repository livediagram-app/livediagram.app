'use client';

// A Plan board's header (docs/specs/026-plan/board-widgets.md "The header"): the title, the board's
// widgets, then Reveal and Retry when they apply, Maximise Board, and the list of items not on the board. The header's
// own background is the board's handle: a press there moves the board, its controls do not.
import { FormBoardStrip } from '@/components/forms/FormBoardStrip';
import { useRef, useState } from 'react';
import { useToday } from '@/hooks/ui/useToday';
import { useKeepOnScreen } from '@/hooks/plan/useKeepOnScreen';
import {
  itemTitle,
  widgetsOf,
  type BoardProjection,
  type BoardWidgetKind,
  type Item,
  type ItemTypeDef,
  type PlanBoardSetup,
  type QuickFilter,
} from '@liveplanner/items';
import { lucideGripVertical } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveplanner/ui';
import { BoardWidgetView, type WidgetContext } from './widgets/BoardWidgetView';
import { BoardWidgetZone } from './widgets/BoardWidgetZone';
import { BoardTitle } from './BoardTitle';
import { useInHeaderBand, useMenuNameSlot } from './menu-name-slot';
import { createPortal } from 'react-dom';
import { typeStatusRefusal } from '@/hooks/plan/status-refusal';
import type { PlanPalette } from './plan-palette';
import { BAND_CONTROLS_CLASS, BAND_HEADER_END, bandControlsProps } from './band-controls';

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
  simplified = false,
  loadFailed,
  selected = false,
  movable = true,
  canRename = false,
  showWidgets = true,
  onWidgets,
  onSetup,
  onOpenItem,
  onRetry,
  onReveal,
  onMoveUnplaced,
  chips,
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
  // A board simplified in a Dashboard slot (plan-tabs.md "A board in a slot is simplified"): no Form strip.
  simplified?: boolean;
  loadFailed: boolean;
  // The board is selected: the header shows its move handle.
  selected?: boolean;
  // The board can be moved: not while it is maximised or fills its tab, so no handle then.
  movable?: boolean;
  // A double-click on the title (or the header's empty space) renames the board: someone who may edit, in Plan
  // mode (docs/specs/026-plan/plan-board.md "What the board shows").
  canRename?: boolean;
  // The widgets are shown: not on a phone, whose header has no room for them (phone-board.ts).
  showWidgets?: boolean;
  onWidgets: (next: BoardWidgetKind[]) => void;
  // A set-up change a widget makes (Set Done Column), with its telemetry part.
  onSetup: (next: PlanBoardSetup, part: string) => void;
  onOpenItem: (itemId: string) => void;
  onRetry: () => void;
  onReveal: () => void;
  onMoveUnplaced: (item: Item, status: string) => void;
  // The card type chips after the title (BoardCardTypeChips). In a header band they lead the header itself, just after
  // the menu box, so they give way to the widgets and controls rather than widening the box.
  chips?: React.ReactNode;
  // What ends the header at its top right: Maximise Board / Restore Board (MaximisedPlanLayer).
  end?: React.ReactNode;
}) {
  const [trayOpen, setTrayOpen] = useState(false);
  // The widgets count by the day (due, overdue, stale): today, moving on at midnight (useToday).
  const today = useToday();
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
    trayOpen,
    onToggleTray: () => setTrayOpen((o) => !o),
    now: today,
    canEdit,
    onSetup,
    onOpenItem,
  };
  const [renaming, setRenaming] = useState(false);
  // In a header band, the title and widgets ride in the menu box (menu-name-slot).
  const nameSlot = useMenuNameSlot();
  const [bandMarker, inBand] = useInHeaderBand();
  const inBox = inBand && !!nameSlot;
  // The board's widgets: in the header on a canvas; in a header band, in the controls card before the cog. A form
  // sending its responses here leads them (FormBoardStrip), with no one adding it.
  const widgetZone = (
    <>
      {simplified ? null : <FormBoardStrip palette={palette} />}
      <BoardWidgetZone
        widgets={widgets}
        canEdit={canEdit}
        selected={selected}
        // In a header band the board is maximised or fills its tab, where no selection shows: an empty zone keeps its +.
        offerAdd={inBox}
        palette={palette}
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
    </>
  );

  // The header's buttons stay on screen when the board runs past the canvas's right edge (a phone, zoomed in).
  const headerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useKeepOnScreen(endRef, headerRef);
  const button =
    'h-7 shrink-0 rounded-md border px-2 text-[12px] font-medium transition enabled:cursor-pointer disabled:opacity-50';
  return (
    <div
      ref={headerRef}
      data-board-header
      // Maximised with a header band (MaximisedPlanLayer's --plan-band-*), it is as tall as the top row and starts
      // after the menu; elsewhere 52 px and 16 px in.
      className={`relative flex h-[var(--plan-band-h,52px)] shrink-0 items-center gap-3 pl-[var(--plan-band-left,1rem)] pr-4 ${BAND_HEADER_END} [[data-header-band]_&]:border-b`}
      // In a header band, a hairline under it as a Sheet's and a view's headers have.
      style={{ color: palette.text, borderColor: palette.border }}
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
      {selected && movable ? (
        <span
          data-board-grip
          className="-ml-2 flex h-7 w-5 shrink-0 cursor-move items-center justify-center rounded"
          style={{ color: palette.muted }}
          aria-hidden
        >
          <GripIcon />
        </span>
      ) : null}
      {/* Title and widgets: in a header band they ride in the menu box together (menu-name-slot), the widgets after
          the name behind a hairline, so the header's top row is one card; on the canvas they sit in the header. */}
      <span ref={bandMarker} hidden />
      {inBox && nameSlot
        ? createPortal(
            <>
              <span data-board-title className="contents">
                <BoardTitle
                  title={setup.title}
                  editing={renaming}
                  selected={selected}
                  palette={palette}
                  inBox
                  onStart={canRename ? () => setRenaming(true) : undefined}
                  onRename={(t) => onSetup({ ...setup, title: t }, 'Title')}
                  onDone={() => setRenaming(false)}
                />
              </span>
            </>,
            nameSlot,
          )
        : null}
      <div className="flex min-w-0 max-w-[var(--plan-band-mid,none)] flex-1 items-center gap-3">
        {inBox ? (
          chips
        ) : (
          <>
            <span data-board-title className="contents">
              <BoardTitle
                title={setup.title}
                editing={renaming}
                selected={selected}
                palette={palette}
                inBox={false}
                capped={showWidgets && (widgets.length > 0 || canEdit)}
                onRename={(t) => onSetup({ ...setup, title: t }, 'Title')}
                onDone={() => setRenaming(false)}
              />
            </span>
            {chips}
            {/* No press guard here: a press on the zone's empty space selects and moves the board like the
                rest of the header; each widget keeps its own presses. */}
            <div className="flex min-w-0 flex-1 items-center">
              {showWidgets ? widgetZone : null}
            </div>
          </>
        )}
      </div>
      {/* In a header band, a card like the menu box (band-controls.ts). */}
      <div
        {...bandControlsProps()}
        className={`ml-auto flex shrink-0 items-center gap-3 ${BAND_CONTROLS_CLASS}`}
      >
        {inBox && showWidgets && (widgets.length > 0 || canEdit) ? (
          // In a header band the widgets ride here, before the cog, behind a hairline: the top row's right is one card.
          // Someone who may not edit a board with none sees no zone, so no hairline stands alone before the cog.
          <span
            data-widget-zone=""
            className="flex min-w-0 max-w-[min(56vw,46rem)] items-center border-r pr-2"
            style={{ borderColor: palette.border }}
            onPointerDown={stop}
          >
            {widgetZone}
          </span>
        ) : null}
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
        {end ? (
          // Moved left to stay on screen, it takes the board's surface and a shadow, so it reads over the header.
          <div
            ref={endRef}
            className="relative z-10 flex shrink-0 items-center gap-3 rounded-lg data-[shifted]:bg-[var(--keep-bg)] data-[shifted]:shadow-md"
            style={{ ['--keep-bg' as string]: palette.surface }}
          >
            {end}
          </div>
        ) : null}
      </div>
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
