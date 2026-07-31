'use client';

import { useState } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { ChevronIcon } from '@/components/primitives/ChevronIcon';
import { PaletteToolRows } from './PaletteToolRows';
import type { PaletteTileDef } from './palette-tile-defs';
import type { PaletteTileActions } from './PaletteTileGrid';

// A collapsible group of tiles inside a palette category: one row that opens
// in place to reveal its members.
//
// Used by Media's Embed group (spec/121) and Components' Web Elements group.
// The problem is the same in both: a handful of tiles that belong together and
// would otherwise crowd out the category's other elements. Always-visible rows
// bury the rest; a single umbrella tile hides what is inside (somebody wanting
// a Figma embed had no way to know they could); and a drill-in — the
// Icons / Technology pattern — spends a whole screen and a breadcrumb to show
// five rows. Opening in place keeps the category's other elements visible
// right above.

export function PaletteTileGroup({
  title,
  blurb,
  icon,
  tiles,
  actions,
  pendingDraw,
}: {
  title: string;
  // One line under the title. Takes the tile count so a group says how much
  // is behind it without the caller counting.
  blurb: (count: number) => string;
  icon: React.ReactNode;
  tiles: PaletteTileDef[];
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null | undefined;
}) {
  // Closed by default: Media's own two elements should be what you see first.
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left transition ${
          open
            ? 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60'
            : 'border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/60'
        }`}
      >
        {/* The same glyph chip the rows below use, so the group reads as one
            of them rather than as panel chrome. */}
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">
            {title}
          </span>
          <span className="line-clamp-2 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
            {blurb(tiles.length)}
          </span>
        </span>
        <span className="shrink-0 text-slate-400">
          <ChevronIcon open={open} />
        </span>
      </button>
      {open ? (
        // Indented so the members read as belonging to the row above rather
        // than as more of the category's own elements.
        <div className="mt-0.5 pl-4">
          <PaletteToolRows tiles={tiles} actions={actions} pendingDraw={pendingDraw} />
        </div>
      ) : null}
    </div>
  );
}
