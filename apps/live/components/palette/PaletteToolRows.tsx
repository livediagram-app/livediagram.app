// The Tools tab's LIST layout: one row per tool — glyph, name, and a short
// line saying what it is (docs/specs/008-canvas/canvas-and-palette.md).
//
// Why a list and not the 3-column grid every other category uses: a palette is
// ~256px wide, and three columns leaves about 70px per tile, which is a caption
// and nothing else. That works for Shapes and Icons, where the picture IS the
// explanation — a circle looks like a circle. It doesn't work for Tools, where
// half the entries are behaviours whose glyph can't say what they do: nothing
// about a ring tells you it teleports, and "Reveal" could be anything.
//
// So the Tools tab trades density for legibility. It shows fewer rows per
// screen, which the drill-in categories already made affordable: you arrive
// here having chosen a group of three to eight tools, not facing all 28.

import { useEffect, useRef } from 'react';
import { setPaletteDragPreview } from '@/lib/palette-drag-preview';
import type { PendingDraw } from '@/lib/draw-mode';
import type { PaletteTileDef } from './palette-tile-defs';
import { tileCaption } from './tile-caption';
import { tileDragStart } from './palette-tile-drag';
import { tileActive, tileHandler, visibleTiles, type PaletteTileActions } from './PaletteTileGrid';

export function PaletteToolRow({
  def,
  actions,
  pendingDraw,
  id,
  highlighted = false,
  onPress,
  anchor,
  expanded,
}: {
  def: PaletteTileDef;
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null | undefined;
  id?: string;
  // The keyboard-walked row (docs/specs/010-palette/palette-top-level-categories.md). Distinct from `armed`, which means a
  // draw gesture is queued: this is only "the arrow keys are pointing here".
  highlighted?: boolean;
  // A press of the row's own (a marker held, pressed again, opens its flyout), else the tile's.
  onPress?: () => void;
  // The row as a flyout's opener: its `data-dock-item`, and whether the flyout is open.
  anchor?: string;
  expanded?: boolean;
}) {
  const armed = tileActive(def, pendingDraw);
  const rowRef = useRef<HTMLButtonElement>(null);
  // Keep the walked row on screen when the list scrolls. `nearest` rather
  // than centring, so a short list doesn't jump on every keystroke.
  useEffect(() => {
    if (highlighted) rowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  const onClick = onPress ?? tileHandler(def, actions, pendingDraw);
  const dragStart = tileDragStart(def.action);
  return (
    <button
      ref={rowRef}
      id={id}
      type="button"
      role="option"
      aria-selected={highlighted}
      onClick={onClick}
      // Rows drag onto the canvas exactly like the tile they stand for: shapes, sticky notes, icons and
      // stickers alike, including the rows a search turns up (the Toolbar strip's More popover).
      draggable={dragStart !== undefined}
      onDragStart={dragStart}
      // Clearing the preview is NOT optional: it is what removes the canvas
      // ghost. Without it every dragged row left its placemarker behind after
      // the element landed, on the drop AND on a cancelled drag.
      onDragEnd={() => setPaletteDragPreview(null)}
      aria-label={def.label}
      aria-pressed={armed}
      data-dock-item={anchor}
      aria-expanded={expanded}
      className={`flex w-full items-center gap-2.5 rounded-lg border py-1.5 pl-2 pr-2 text-left transition ${
        armed
          ? 'border-brand-300 bg-brand-50 dark:border-brand-500 dark:bg-brand-950/40'
          : highlighted
            ? 'border-brand-300 bg-brand-50/70 dark:border-brand-500 dark:bg-brand-950/30'
            : 'border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/60'
      }`}
    >
      {/* The glyph keeps its own tile chip so the column of icons still scans
          as a column, and an armed tool is obvious at a glance. */}
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-600 dark:text-slate-300 ${
          armed ? 'bg-brand-100 dark:bg-brand-900/60' : 'bg-slate-100 dark:bg-slate-800'
        }`}
      >
        {def.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">
          {tileCaption(def.label, def.caption)}
        </span>
        {def.blurb ? (
          // Two lines at most: past that a "short description" is a paragraph,
          // and the hover card already carries the fuller version.
          <span className="line-clamp-2 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
            {def.blurb}
          </span>
        ) : null}
      </span>
      {def.shortcut ? (
        <kbd className="inline-flex items-center shrink-0 rounded-[3px] border border-slate-300 bg-white px-1 text-[9px] font-semibold leading-4 text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
          <span className="text-optical-line text-optical-caps [--optical-tracking:0em]">
            {def.shortcut}
          </span>
        </kbd>
      ) : null}
    </button>
  );
}

export function PaletteToolRows({
  tiles,
  actions,
  pendingDraw,
  activeIndex,
  optionIdPrefix,
}: {
  tiles: PaletteTileDef[];
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null | undefined;
  // Index of the keyboard-walked row, or -1 / undefined for none. Set by a
  // search box that owns the arrow keys (docs/specs/010-palette/palette-top-level-categories.md) — the list itself takes no
  // focus, so the caller drives it.
  activeIndex?: number;
  // Prefix for the per-row DOM ids the caller points aria-activedescendant at.
  optionIdPrefix?: string;
}) {
  const defs = visibleTiles(tiles, actions.hasImage);
  return (
    <div className="flex flex-col gap-0.5" role={optionIdPrefix ? 'listbox' : undefined}>
      {defs.map((def, i) => (
        <PaletteToolRow
          key={def.id}
          def={def}
          actions={actions}
          pendingDraw={pendingDraw}
          id={optionIdPrefix ? `${optionIdPrefix}-${i}` : undefined}
          highlighted={activeIndex === i}
        />
      ))}
    </div>
  );
}
