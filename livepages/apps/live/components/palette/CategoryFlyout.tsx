'use client';

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { EditorMode } from '@livepages/document';
import { CountBadge } from '@livepages/ui';
import type { PendingDraw } from '@/lib/draw-mode';
import type { PaletteTileDef } from './palette-tile-defs';
import { tileHandler, visibleTiles, type PaletteTileActions } from './PaletteTileGrid';
import {
  flyoutCardColumns,
  flyoutColumns,
  flyoutGroups,
  flyoutKeyTarget,
  flyoutLayout,
  flyoutTagline,
} from './category-flyout-groups';
import { CardList, InfoFooter, opensSide, TileGrid } from './category-flyout-items';
import { BrowseLayoutContext } from './PaletteCategoryBrowser';

// The category bar's flyout (docs/specs/007-editor/toolbar-layout.md "The category bar"): one category's
// tiles under its name, in its named groups, as a grid of pictures (Shapes) or cards with a blurb (Build). A footer
// says what the pointed-at tile does and its key. A tile with presets (Card, Badge) or an opener opens a side panel
// beside the flyout (CategoryFlyoutSide), which the host draws, so this one stays open. A catalogue (Icons,
// Technology) shows its own browse instead, under the same header.

export type FlyoutCategory = {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  // Null for a catalogue, whose body is `content`.
  tiles: readonly PaletteTileDef[] | null;
  content: ReactNode;
};

/** Arrow keys walk the flyout's items by position (category-flyout-groups), across its groups. */
export function onFlyoutArrowKey(e: KeyboardEvent<HTMLElement>, body: HTMLElement | null): void {
  const items = [...(body?.querySelectorAll<HTMLElement>('[data-flyout-item]') ?? [])];
  const index = items.indexOf(document.activeElement as HTMLElement);
  if (index < 0) return;
  const points = items.map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  const next = flyoutKeyTarget(e.key, index, points);
  if (next === null) return;
  e.preventDefault();
  items[next]?.focus();
}

export function CategoryFlyout({
  category,
  mode,
  actions,
  pendingDraw,
  focusFirst,
  sideOpenId,
  onSide,
  onItemHover,
}: {
  category: FlyoutCategory;
  // The mode, for a line it words its own way.
  mode?: EditorMode;
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null;
  // Opened from the keyboard: the first tile takes focus, so the arrows carry on from there.
  focusFirst: boolean;
  // The tile whose side panel is open.
  sideOpenId: string | null;
  // A side-panel tile was pressed (`el` is the tile, which the panel lines up with).
  onSide: (def: PaletteTileDef, el: HTMLElement) => void;
  // The pointer or focus reached a tile (the host opens or closes the side panel on a beat).
  onItemHover: (def: PaletteTileDef | null, el: HTMLElement | null) => void;
}) {
  // The tile under the pointer or the focus, which the footer describes.
  const [hovered, setHovered] = useState<PaletteTileDef | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const tiles = category.tiles ? visibleTiles([...category.tiles], actions.hasImage) : null;

  // Keyboard entry focuses the first tile, so the arrows carry on from there.
  useLayoutEffect(() => {
    if (focusFirst) bodyRef.current?.querySelector<HTMLElement>('[data-flyout-item]')?.focus();
  }, [focusFirst]);

  const pressTile = (def: PaletteTileDef, el: HTMLElement) => {
    if (opensSide(def)) onSide(def, el);
    else tileHandler(def, actions, pendingDraw)();
  };
  const hover = (def: PaletteTileDef | null, el: HTMLElement | null) => {
    setHovered(def);
    onItemHover(def, el);
  };
  const itemProps = { actions, pendingDraw, onPress: pressTile, onHover: hover, sideOpenId };

  return (
    <div data-tour-id="palette-category-menu" className="flex flex-col">
      <FlyoutHeader
        icon={category.icon}
        title={category.label}
        tagline={flyoutTagline(category.id, category.description, mode)}
        count={tiles?.length}
      />
      {/* Keyed on the category, so a switch fades the new body in and replays the tiles' cascade. */}
      <div
        key={category.id}
        ref={bodyRef}
        onKeyDown={(e) => onFlyoutArrowKey(e, bodyRef.current)}
        className="animate-fade-in"
      >
        {tiles ? (
          <div className="flex flex-col gap-3 p-3">
            {flyoutGroups(category.id, tiles).map((group, gi) => (
              <section key={group.id} aria-label={group.title ?? category.label}>
                {group.title ? (
                  <h4 className="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {group.title}
                    <span aria-hidden className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                  </h4>
                ) : null}
                {flyoutLayout(category.id) === 'grid' ? (
                  <TileGrid
                    tiles={group.tiles}
                    offset={gi * 4}
                    columns={flyoutColumns(category.id)}
                    {...itemProps}
                  />
                ) : (
                  <CardList
                    tiles={group.tiles}
                    columns={flyoutCardColumns(tiles.length)}
                    {...itemProps}
                  />
                )}
              </section>
            ))}
          </div>
        ) : (
          // A catalogue browses as two panes (PaletteCategoryRail), edge to edge.
          <BrowseLayoutContext.Provider value="rail">
            {category.content}
          </BrowseLayoutContext.Provider>
        )}
      </div>
      {tiles ? <InfoFooter def={hovered} /> : null}
    </div>
  );
}

/** A flyout's or side panel's header: the glyph on a soft plate, the name, its line, and how many it holds. */
export function FlyoutHeader({
  icon,
  title,
  tagline,
  count,
}: {
  icon: ReactNode;
  title: ReactNode;
  tagline: string;
  count?: number | undefined;
}) {
  return (
    <header className="flex items-center gap-3 border-b border-slate-100 px-3.5 pb-3 pt-3.5 dark:border-slate-800">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 ring-1 ring-brand-200/70 dark:from-brand-500/20 dark:to-brand-500/10 dark:text-brand-200 dark:ring-brand-500/30 [&_svg]:h-[18px] [&_svg]:w-[18px]"
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="truncate text-[14px] font-semibold leading-tight text-slate-900 dark:text-slate-50">
          {title}
        </h3>
        <p className="truncate text-[12px] leading-snug text-slate-500 dark:text-slate-400">
          {tagline}
        </p>
      </div>
      {count ? <CountBadge count={count} className="shrink-0" /> : null}
    </header>
  );
}
