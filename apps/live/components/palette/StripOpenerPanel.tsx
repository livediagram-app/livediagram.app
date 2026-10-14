'use client';

import type { PendingDraw } from '@/lib/draw-mode';
import { setPaletteDragPreview } from '@/lib/palette-drag-preview';
import { tileDisplayName, type PaletteTileDef } from './palette-tile-defs';
import { tileHandler, visibleTiles, type PaletteTileActions } from './PaletteTileGrid';
import { tileDragStart } from './palette-tile-drag';

// What a category opener (palette-openers: Facilitate's Ask, Tools, Record, React) opens on the Toolbar strip
// (docs/specs/007-editor/editor-modes.md "Popular"): the category named, then its tiles as cards, two to a row, each
// its glyph large on a soft plate, its name and what it is for. A card places or arms its element as its tile does,
// and drags onto the canvas the same way; using one closes the popover (the strip's tile actions do).

export function StripOpenerPanel({
  label,
  description,
  tiles,
  actions,
  pendingDraw,
}: {
  label: string;
  description: string;
  tiles: readonly PaletteTileDef[];
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="px-1.5 pt-0.5">
        <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">{label}</h3>
        <p className="text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-1">
        {visibleTiles([...tiles], actions.hasImage).map((def) => (
          <li key={def.id} className="flex">
            <OpenerCard def={def} actions={actions} pendingDraw={pendingDraw} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function OpenerCard({
  def,
  actions,
  pendingDraw,
}: {
  def: PaletteTileDef;
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null;
}) {
  const drag = tileDragStart(def.action);
  const name = tileDisplayName(def);
  return (
    <button
      type="button"
      aria-label={def.label}
      onClick={tileHandler(def, actions, pendingDraw)}
      draggable={drag !== undefined || undefined}
      onDragStart={drag}
      // The drag's canvas preview goes with the drag, dropped or not, as a tile's does (PaletteIconButton).
      onDragEnd={() => setPaletteDragPreview(null)}
      className="group flex w-full items-start gap-2.5 rounded-xl p-2 text-left ring-1 ring-transparent transition hover:bg-slate-50 hover:ring-slate-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 dark:hover:bg-slate-800/70 dark:hover:ring-slate-700"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition group-hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/25 dark:group-hover:bg-brand-500/25 [&_svg]:h-5 [&_svg]:w-5"
      >
        {def.icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 pt-0.5">
        <span className="text-[13px] font-semibold leading-tight text-slate-800 dark:text-slate-100">
          {name}
        </span>
        <span className="text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">
          {def.blurb ?? def.description}
        </span>
      </span>
    </button>
  );
}
