// The Tools tab's LIST layout: one row per tool — glyph, name, and a short
// line saying what it is (spec/09).
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
import { SHAPE_DEFAULT_SIZE, type ShapeKind } from '@livediagram/diagram';
import { PALETTE_DND_MIME } from '@/lib/icons';
import { setPaletteDragPreview, suppressNativeDragImage } from '@/lib/palette-drag-preview';
import type { PendingDraw } from '@/lib/draw-mode';
import type { PaletteTileDef } from './palette-tile-defs';
import { tileCaption } from './tile-caption';
import { tileHandler, tileActive, visibleTiles, type PaletteTileActions } from './PaletteTileGrid';

function PaletteToolRow({
  def,
  actions,
  pendingDraw,
  id,
  highlighted = false,
}: {
  def: PaletteTileDef;
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null | undefined;
  id?: string;
  // The keyboard-walked row (spec/110). Distinct from `armed`, which means a
  // draw gesture is queued: this is only "the arrow keys are pointing here".
  highlighted?: boolean;
}) {
  const armed = tileActive(def, pendingDraw);
  const rowRef = useRef<HTMLButtonElement>(null);
  // Keep the walked row on screen when the list scrolls. `nearest` rather
  // than centring, so a short list doesn't jump on every keystroke.
  useEffect(() => {
    if (highlighted) rowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);
  return (
    <button
      ref={rowRef}
      id={id}
      type="button"
      role="option"
      aria-selected={highlighted}
      onClick={tileHandler(def, actions)}
      // Rows drag onto the canvas exactly like the grid tiles do. They did
      // not, and since the categories moved to rows that was most of the
      // palette: Behaviour, Collaborate, Build, Write, Draw, Data.
      draggable={def.action.type === 'shape'}
      onDragStart={
        def.action.type === 'shape'
          ? (e) => {
              const a = def.action as {
                kind: ShapeKind;
                session?: string;
                reaction?: string;
                mode?: string;
                estimateScale?: string;
              };
              const choice = a.session ?? a.reaction ?? a.mode ?? a.estimateScale;
              e.dataTransfer.setData(PALETTE_DND_MIME, choice ? `${a.kind}|${choice}` : a.kind);
              e.dataTransfer.effectAllowed = 'copy';
              const { width, height } = SHAPE_DEFAULT_SIZE[a.kind];
              setPaletteDragPreview({ kind: a.kind, width, height });
              // The browser's own drag image is suppressed in favour of the
              // canvas ghost, exactly as the grid tiles do it.
              suppressNativeDragImage(e);
            }
          : undefined
      }
      // Clearing the preview is NOT optional: it is what removes the canvas
      // ghost. Without it every dragged row left its placemarker behind after
      // the element landed, on the drop AND on a cancelled drag.
      onDragEnd={() => setPaletteDragPreview(null)}
      aria-label={def.label}
      aria-pressed={armed}
      className={`flex w-full items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left transition ${
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
          // and the tooltip already carries the fuller version.
          <span className="line-clamp-2 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
            {def.blurb}
          </span>
        ) : null}
      </span>
      {def.shortcut ? (
        <kbd className="shrink-0 rounded-[3px] border border-slate-300 bg-white px-1 text-[9px] font-semibold uppercase leading-4 text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
          {def.shortcut}
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
  // search box that owns the arrow keys (spec/110) — the list itself takes no
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
