'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CountBadge } from '@liveworkspace/ui';
import type { FlyoutCategory, FlyoutKit, FlyoutTile } from './category-flyout-kit';
import { CardList, InfoFooter, TileGrid } from './category-flyout-items';
import { onFlyoutArrowKey, sideRowFor } from './category-flyout-keys';

// The category bar's flyout (each editor's docs/specs/007-editor/toolbar-layout.md "The flyout"), every editor's one
// copy: one category's tiles under its name, in its named groups, as a grid of pictures (Shapes) or cards with a
// blurb (Build). A footer says what the pointed-at tile does and its key. A tile that opens a side panel (presets, an
// opener) opens it beside the flyout (CategoryFlyoutSide), which the host draws, so this one stays open. A catalogue
// (Icons, Technology) shows its own browse instead, under the same header. The tiles are the editor's (its kit).

export function CategoryFlyout<T extends FlyoutTile<T>, A, P>({
  category,
  kit,
  actions,
  pendingDraw,
  focusFirst,
  sideOpenId,
  onSide,
  onEnterSide,
  onItemHover,
}: {
  category: FlyoutCategory<T>;
  kit: FlyoutKit<T, A, P>;
  actions: A;
  pendingDraw: P;
  // Opened from the keyboard: the first tile takes focus, so the arrows carry on from there.
  focusFirst: boolean;
  // The tile whose side panel is open.
  sideOpenId: string | null;
  // A side-panel tile was pressed (`el` is the tile, which the panel lines up with).
  onSide: (def: T, el: HTMLElement) => void;
  // ArrowRight on a side-panel tile: its panel opens, if it is not open, and takes the focus.
  onEnterSide: (def: T, el: HTMLElement) => void;
  // The pointer or focus reached a tile (the host opens or closes the side panel on a beat).
  onItemHover: (def: T | null, el: HTMLElement | null) => void;
}) {
  // The tile under the pointer or the focus, which the footer describes.
  const [hovered, setHovered] = useState<T | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const tiles = category.tiles ? kit.visible(category.tiles, actions) : null;

  // Keyboard entry focuses the first tile, so the arrows carry on from there.
  useLayoutEffect(() => {
    if (focusFirst) bodyRef.current?.querySelector<HTMLElement>('[data-flyout-item]')?.focus();
  }, [focusFirst]);

  const pressTile = (def: T, el: HTMLElement) => {
    if (kit.opensSide(def)) onSide(def, el);
    else kit.press(def, actions, pendingDraw);
  };
  const hover = (def: T | null, el: HTMLElement | null) => {
    setHovered(def);
    onItemHover(def, el);
  };
  const itemProps = { kit, actions, pendingDraw, onPress: pressTile, onHover: hover, sideOpenId };

  return (
    <div data-tour-id="palette-category-menu" className="flex flex-col">
      <FlyoutHeader
        icon={category.icon}
        title={category.label}
        tagline={kit.tagline(category.id, category.description)}
        count={tiles?.length}
      />
      {/* Keyed on the category, so a switch fades the new body in and replays the tiles' cascade. */}
      <div
        key={category.id}
        ref={bodyRef}
        onKeyDown={(e) => {
          const row = sideRowFor(e, tiles);
          if (!row) return onFlyoutArrowKey(e, bodyRef.current);
          e.preventDefault();
          onEnterSide(row.def, row.el);
        }}
        className="animate-fade-in"
      >
        {tiles ? (
          <div className="flex flex-col gap-3 p-3">
            {kit.lead?.(category.id)}
            {kit.groups(category.id, tiles).map((group, gi) => {
              const items =
                kit.layout(category.id) === 'grid' ? (
                  <TileGrid
                    tiles={group.tiles}
                    offset={gi * 4}
                    columns={kit.columns(category.id)}
                    {...itemProps}
                  />
                ) : (
                  <CardList
                    tiles={group.tiles}
                    columns={kit.cardColumns(tiles.length)}
                    {...itemProps}
                  />
                );
              return (
                <section key={group.id} aria-label={group.title ?? category.label}>
                  {group.frame ? (
                    group.frame(items)
                  ) : (
                    <>
                      {group.title ? <FlyoutGroupTitle>{group.title}</FlyoutGroupTitle> : null}
                      {items}
                    </>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          // A catalogue browses as two panes, edge to edge.
          kit.catalogue(category.content, category.id)
        )}
      </div>
      {tiles ? <InfoFooter def={hovered} kit={kit} /> : null}
    </div>
  );
}

/** A flyout group's small heading with a hairline after it (livehuddle's avatar palette heads its groups with it). */
export function FlyoutGroupTitle({ children }: { children: ReactNode }) {
  return (
    <h4 className="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
      {children}
      <span aria-hidden className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
    </h4>
  );
}

/** A flyout's or side panel's header: the glyph on a soft plate, the name, its line, and how many it holds. */
export function FlyoutHeader({
  icon,
  title,
  tagline,
  count,
  aside,
  wrap = false,
}: {
  icon: ReactNode;
  title: ReactNode;
  tagline: string;
  count?: number | undefined;
  // Something at its end in place of the count (a photo tool's Reset).
  aside?: ReactNode;
  // The line runs to two lines rather than cutting off (a photo tool's, which says how to use it).
  wrap?: boolean;
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
        <p
          className={`${wrap ? 'line-clamp-2' : 'truncate'} text-[12px] leading-snug text-slate-500 dark:text-slate-400`}
        >
          {tagline}
        </p>
      </div>
      {count ? <CountBadge count={count} className="shrink-0" /> : null}
      {aside}
    </header>
  );
}
