'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { uiUnscaleStyle } from '@/lib/ui-scale';
import { tileDisplayName, type PaletteTileDef } from './palette-tile-defs';
import { visibleTiles, tileHandler, type PaletteTileActions } from './PaletteTileGrid';
import { CardList, InfoFooter } from './category-flyout-items';
import { FlyoutHeader, onFlyoutArrowKey } from './CategoryFlyout';

// The category flyout's side panel (docs/specs/007-editor/toolbar-layout.md "Diagram's category bar"): what a tile
// with presets (Card, Badge) or an opener holds, in a second popover beside the flyout, lined up with the tile that
// opened it, so the flyout stays open behind it as a submenu's parent does. It opens on the side of the tile's own
// column (sidePlacement); on a phone it lies over the flyout. Its presets place and drag as any tile.

const PRESETS_HINT = 'Start from a preset, then change any of it.';
// Its design width, and the gap it keeps from the flyout.
export const SIDE_PX = 304;
const SIDE_GAP_PX = 8;

export type SideOpen = { def: PaletteTileDef; top: number; right: number };

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
  return { def, top, right };
}

export function CategoryFlyoutSide({
  side,
  isMobile,
  scale,
  actions,
  pendingDraw,
  openBody,
  hoverHandlers,
}: {
  side: SideOpen;
  isMobile: boolean;
  scale: number;
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null;
  // An opener's body: the category it stands for, at its group.
  openBody: (categoryId: string, group: string | null) => ReactNode;
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
  // Lined up with its tile, unless that runs it off the bottom of the window: then it rises just enough to fit
  // (8px clear), never above the strip's top. Measured once it has laid out, before it paints.
  const [lift, setLift] = useState(0);
  useLayoutEffect(() => {
    const box = panelRef.current?.getBoundingClientRect();
    if (!box) return;
    const over = box.bottom - (window.innerHeight - 8);
    setLift(over > 0 ? Math.min(over, side.top) : 0);
  }, [side.top]);
  const a = def.action;
  const variants = def.variants?.length ? visibleTiles([...def.variants], actions.hasImage) : null;
  return (
    <div
      data-category-flyout-side=""
      data-floating-panel=""
      ref={panelRef}
      role="dialog"
      aria-label={tileDisplayName(def)}
      {...hoverHandlers}
      style={
        isMobile
          ? { top: side.top - lift }
          : { ...uiUnscaleStyle(scale), top: side.top - lift, right: side.right }
      }
      className={`absolute ${isMobile ? 'inset-x-3' : 'w-[19rem]'} max-h-[calc(100dvh-10rem)] origin-top-left animate-dropdown-down overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/50`}
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
          <div className="px-2 py-2.5">{openBody(a.category, a.group ?? null)}</div>
        ) : null}
      </div>
      {variants ? <InfoFooter def={hovered} /> : null}
    </div>
  );
}
