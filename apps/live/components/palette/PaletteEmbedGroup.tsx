'use client';

import { useState } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { ChevronIcon } from '@/components/primitives/ChevronIcon';
import { PaletteToolRows } from './PaletteToolRows';
import type { PaletteTileDef } from './palette-tile-defs';
import type { PaletteTileActions } from './PaletteTileGrid';

// The Embed group in the Media tab (spec/121): one row that opens to reveal
// the five providers.
//
// A collapsible group rather than five rows always on show, and rather than
// one generic "Embed" tile: five rows would make Media mostly embeds and bury
// Image and Avatar, while a single tile hid which services actually work —
// somebody wanting to drop a Figma file had no way to know they could.
//
// A drill-in (the Icons / Technology pattern) would also have worked, but it
// costs a whole screen and a breadcrumb to show five rows; opening in place
// keeps Image and Avatar visible right above.

export function PaletteEmbedGroup({
  tiles,
  actions,
  pendingDraw,
}: {
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
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
            <path d="M2.5 8h19" />
            <path d="M10.5 12.2v3.6l3.2-1.8z" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">
            Embed
          </span>
          <span className="line-clamp-2 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
            {tiles.length} services that play on the canvas
          </span>
        </span>
        <span className="shrink-0 text-slate-400">
          <ChevronIcon open={open} />
        </span>
      </button>
      {open ? (
        // Indented so the providers read as belonging to the row above rather
        // than as more Media elements.
        <div className="mt-0.5 pl-4">
          <PaletteToolRows tiles={tiles} actions={actions} pendingDraw={pendingDraw} />
        </div>
      ) : null}
    </div>
  );
}
