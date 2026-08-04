'use client';

import { useRef, useState } from 'react';

import type { PaletteTileDef } from './palette-tile-defs';
import { tileDisplayName } from './palette-tile-defs';

// Reorder mode for the Favourites grid (spec/78): drag the saved tiles into
// the order you want, then Save.
//
// A separate grid from PaletteTileGrid rather than a flag on it, because in
// this mode a tile means the opposite of what it normally means. Normally
// pressing one ADDS an element and dragging one drops that element on the
// canvas; here pressing does nothing and dragging moves the tile itself. Two
// gestures with the same target and opposite effects should not share a
// component with a boolean between them.
//
// Pointer events, not HTML5 drag-and-drop. The palette's other drags are
// HTML5 (they cross into the canvas, which needs the dataTransfer payload),
// but this one never leaves the panel, and HTML5 dnd does not fire for touch
// at all — the palette is on phones too, and a reorder you cannot perform
// with a finger is half a feature.

// How far the pointer must travel before a press becomes a drag, so a tap that
// jitters by a pixel doesn't shuffle the grid.
const DRAG_SLOP_PX = 4;

/** Move `from` to `to`, returning a new array. Out-of-range indices no-op. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) next.splice(to, 0, moved);
  return next;
}

export function PaletteFavouritesReorder({
  tiles,
  onReorder,
}: {
  /** The saved favourites, in their current order. */
  tiles: PaletteTileDef[];
  /** Called with the new order as the drag moves, so the grid previews live. */
  onReorder: (nextIds: string[]) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Whether the press has become a drag. Mirrored in state as well as the ref
  // because the LOGIC needs it synchronously (mid-pointermove, before React
  // has re-rendered) and the STYLING needs it to trigger a render — a drag
  // that never crosses a slot boundary re-renders for no other reason, so a
  // ref alone left the tile looking un-picked-up.
  const [moving, setMoving] = useState(false);
  // Where the press started, to tell a drag from a tap.
  const origin = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

  const indexUnder = (x: number, y: number): number => {
    const el = document.elementFromPoint(x, y);
    const slot = el?.closest('[data-fav-slot]');
    const raw = slot?.getAttribute('data-fav-slot');
    return raw === null || raw === undefined ? -1 : Number(raw);
  };

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    // Primary button / touch only: a right-click here is the panel's own
    // context menu, not the start of a drag.
    if (e.button !== 0) return;
    origin.current = { x: e.clientX, y: e.clientY };
    dragging.current = false;
    setMoving(false);
    setDraggingId(id);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingId || !origin.current) return;
    if (!dragging.current) {
      const dx = e.clientX - origin.current.x;
      const dy = e.clientY - origin.current.y;
      if (Math.hypot(dx, dy) < DRAG_SLOP_PX) return;
      dragging.current = true;
      setMoving(true);
    }
    const from = tiles.findIndex((t) => t.id === draggingId);
    // elementFromPoint, not the event target: pointer capture keeps every
    // move event on the tile the drag started from, so the target alone can
    // never tell us which slot the finger is currently over.
    const to = indexUnder(e.clientX, e.clientY);
    if (from < 0 || to < 0 || to === from) return;
    onReorder(moveItem(tiles, from, to).map((t) => t.id));
  };

  const end = (e: React.PointerEvent) => {
    if (draggingId) e.currentTarget.releasePointerCapture?.(e.pointerId);
    setDraggingId(null);
    setMoving(false);
    dragging.current = false;
    origin.current = null;
  };

  return (
    <div className="grid grid-cols-3 justify-items-center gap-1 overflow-x-hidden py-px">
      {tiles.map((def, i) => {
        const isDragging = draggingId === def.id && moving;
        return (
          <div
            key={def.id}
            data-fav-slot={i}
            // The drop target is the SLOT, not the tile: a grid cell is wider
            // than the tile inside it, and a drag that only registers over the
            // artwork feels like it keeps missing.
            className="w-full"
          >
            <button
              type="button"
              // Announced as what it does here, not as what the tile creates.
              aria-label={`Move ${tileDisplayName(def)}. Position ${i + 1} of ${tiles.length}.`}
              onPointerDown={(e) => onPointerDown(e, def.id)}
              onPointerMove={onPointerMove}
              onPointerUp={end}
              onPointerCancel={end}
              // Without this a touch-drag scrolls the panel instead of moving
              // the tile, and the pointermove stream stops at the first scroll.
              style={{ touchAction: 'none' }}
              className={`flex w-full cursor-grab flex-col items-center justify-start gap-1 rounded-md border px-0.5 py-1.5 transition select-none ${
                isDragging
                  ? 'border-brand-400 bg-brand-50 opacity-60 dark:border-brand-500/60 dark:bg-brand-500/15'
                  : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/50 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-brand-500/50'
              }`}
            >
              <span className="pointer-events-none flex h-5 items-center justify-center text-slate-600 dark:text-slate-300">
                {def.icon}
              </span>
              <span className="pointer-events-none w-full truncate text-center text-[9px] leading-none text-slate-500 dark:text-slate-400">
                {tileDisplayName(def)}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
