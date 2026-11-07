'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { uiUnscaleStyle } from '@liveworkspace/workbench/lib/ui-scale';
import { tileDisplayName, type PaletteTileDef } from './palette-tile-defs';
import { visibleTiles, tileHandler, type PaletteTileActions } from './PaletteTileGrid';
import { CardList, InfoFooter } from './category-flyout-items';
import { FlyoutHeader, onFlyoutArrowKey } from './CategoryFlyout';

// The category flyout's side panel (docs/specs/007-editor/toolbar-layout.md "The category bar"): what a tile
// with presets (Card, Badge) or an opener holds, in a second popover beside the flyout, lined up with the tile that
// opened it, so the flyout stays open behind it as a submenu's parent does. It opens on the side of the tile's own
// column (sidePlacement); on a phone it lies over the flyout. Its presets place and drag as any tile.

const PRESETS_HINT = 'Start from a preset, then change any of it.';
// Its design width, and the gap it keeps from the flyout.
export const SIDE_PX = 304;
const SIDE_GAP_PX = 8;

// `top` lines it up with its tile; `flyoutTop` is the flyout's own top, where a phone's panel starts so it covers the
// whole flyout (none of its headings peeking out above).
export type SideOpen = { def: PaletteTileDef; top: number; right: number; flyoutTop?: number };

// How far clear of the canvas region's bottom (the tab bar below it) the panel keeps.
const FLOOR_GAP_PX = 8;

/** The lowest the panel may reach, in window px: the canvas region's bottom (above the tab bar), else the window's. */
export function sideFloor(panel: HTMLElement): number {
  const region = panel.ownerDocument.querySelector('[data-canvas-root]')?.getBoundingClientRect();
  const bottom = region && region.height > 0 ? region.bottom : window.innerHeight;
  return Math.min(bottom, window.innerHeight) - FLOOR_GAP_PX;
}

/** The scale a computed `transform` draws at (`matrix(a, …)`'s `a`): 1 for none, or one this cannot read. */
export function animationScale(transform: string): number {
  const a = /^matrix\(\s*([-\d.e]+)/.exec(transform)?.[1];
  const scale = a ? Number(a) : 1;
  return scale > 0 ? scale : 1;
}

/**
 * How far the panel rises to fit: its bottom where it would hang unlifted (`naturalBottom`), against `floor`, never
 * more than `maxLift` (the strip's top). 0 when it fits.
 */
export function sideLift(naturalBottom: number, floor: number, maxLift: number): number {
  const over = naturalBottom - floor;
  return over > 0 ? Math.min(over, Math.max(0, maxLift)) : 0;
}

/** Where the panel hangs for a tile, as offsets into the strip's root (screen px, as the flyout's `right` is). */
export function sidePlacement(tile: HTMLElement, def: PaletteTileDef): SideOpen | null {
  const root = tile.closest('[data-toolbar-palette]')?.getBoundingClientRect();
  const flyout = tile.closest('[data-category-flyout]')?.getBoundingClientRect();
  if (!root || !flyout) return null;
  const box = tile.getBoundingClientRect();
  // Its header lines up with the tile's top, kept inside the window.
  const top = Math.max(0, box.top - root.top - 4);
  // Beside the tile's own column, never across the flyout from it: a right-column tile opens to the flyout's right,
  // a left-column one to its left, where the window has room; without it, against the tile itself, over the
  // flyout's other column, as a submenu does.
  const SIDE_ROOM = SIDE_PX + SIDE_GAP_PX + 8;
  const leftColumn = box.left + box.width / 2 < flyout.left + flyout.width / 2;
  let left: number;
  if (!leftColumn && window.innerWidth - flyout.right >= SIDE_ROOM)
    left = flyout.right + SIDE_GAP_PX;
  else if (leftColumn && flyout.left >= SIDE_ROOM) left = flyout.left - SIDE_GAP_PX - SIDE_PX;
  else if (leftColumn) left = box.right + SIDE_GAP_PX;
  else left = box.left - SIDE_GAP_PX - SIDE_PX;
  const right = root.right - left - SIDE_PX;
  return { def, top, right, flyoutTop: Math.max(0, flyout.top - root.top) };
}

export function CategoryFlyoutSide({
  side,
  isMobile,
  scale,
  actions,
  pendingDraw,
  openBody,
  seeThrough = false,
  hoverHandlers,
}: {
  side: SideOpen;
  isMobile: boolean;
  scale: number;
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null;
  // An opener's body: the category it stands for, at its group.
  openBody: (categoryId: string, group: string | null) => ReactNode;
  // A tile is being dragged out: hidden at once (no fade, so it never lies over the fading flyout as a second layer of
  // see-through text), and a drop on it lands on the canvas beneath (`data-drop-through`).
  seeThrough?: boolean;
  hoverHandlers: {
    onPointerEnter: (e: React.PointerEvent) => void;
    onPointerLeave: (e: React.PointerEvent) => void;
    onDragStart: () => void;
    onDragEnd: () => void;
  };
}) {
  const { def } = side;
  const [hovered, setHovered] = useState<PaletteTileDef | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Lined up with its tile, unless that runs it below the canvas region (under the tab bar): then it rises just enough
  // to fit (8px clear), never above the strip's top. Measured before it paints, again once its opening animation has
  // settled (mid-animation it is scaled down, so it reads short), and whenever its size or the window's changes.
  const [lift, setLift] = useState(0);
  // Where it hangs from: its tile's top, or on a phone the flyout's own top (it lies over the whole flyout).
  const anchor = isMobile ? (side.flyoutTop ?? side.top) : side.top;
  const liftRef = useRef(0);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const measure = () => {
      // Its settled height (the opening animation scales it from its top left), from where its top stands now less
      // the lift it has.
      const box = panel.getBoundingClientRect();
      const height = box.height / animationScale(getComputedStyle(panel).transform);
      const next = sideLift(box.top + liftRef.current + height, sideFloor(panel), anchor);
      liftRef.current = next;
      setLift(next);
    };
    measure();
    panel.addEventListener('animationend', measure);
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(panel);
    return () => {
      panel.removeEventListener('animationend', measure);
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [anchor]);
  const a = def.action;
  const variants = def.variants?.length ? visibleTiles([...def.variants], actions.hasImage) : null;
  return (
    <div
      data-category-flyout-side=""
      {...(seeThrough ? { 'data-drop-through': '' } : {})}
      data-floating-panel=""
      ref={panelRef}
      role="dialog"
      aria-label={tileDisplayName(def)}
      {...hoverHandlers}
      style={
        isMobile
          ? { top: anchor - lift }
          : { ...uiUnscaleStyle(scale), top: side.top - lift, right: side.right }
      }
      className={`absolute ${isMobile ? 'inset-x-3' : 'w-[19rem]'} max-h-[calc(100dvh-10rem)] origin-top-left animate-dropdown-down ${seeThrough ? 'opacity-0' : 'transition-opacity duration-short'} overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/50`}
    >
      <FlyoutHeader
        icon={def.icon}
        title={tileDisplayName(def)}
        tagline={variants ? (def.variantsHint ?? PRESETS_HINT) : `Browse ${def.label}.`}
        count={variants?.length}
      />
      <div ref={bodyRef} onKeyDown={(e) => onFlyoutArrowKey(e, bodyRef.current)}>
        {variants ? (
          <div className="p-2">
            <CardList
              tiles={variants}
              columns={1}
              actions={actions}
              pendingDraw={pendingDraw}
              onPress={(t) => tileHandler(t, actions, pendingDraw)()}
              onHover={(t) => setHovered(t)}
            />
          </div>
        ) : a.type === 'open' ? (
          <div className="px-2 py-2.5">{openBody(a.category, null)}</div>
        ) : null}
      </div>
      {variants ? <InfoFooter def={hovered} /> : null}
    </div>
  );
}
