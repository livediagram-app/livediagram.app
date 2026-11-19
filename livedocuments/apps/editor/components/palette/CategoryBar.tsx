'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { StripPopover } from '@liveworkspace/workbench/components/palette/ToolbarStripPopover';
import {
  CategoryBarButtons as SharedCategoryBarButtons,
  HOVER_CLOSE_MS,
  flyoutWidthClass,
  flyoutWidthPx,
  useCategoryBar as useSharedCategoryBar,
  type CategoryBarState as SharedCategoryBarState,
} from '@liveworkspace/workbench/components/palette/CategoryBar';
import { CategoryFlyout, type FlyoutCategory } from './CategoryFlyout';
import { flyoutCardColumns, flyoutLayout } from './category-flyout-groups';
import { opensSide } from './category-flyout-items';
import { CategoryFlyoutSide, sidePlacement, type SideOpen } from './CategoryFlyoutSide';
import type { PaletteTileDef } from './palette-tile-defs';
import { Divider } from './strip-rail-items';
import { type PaletteTileActions } from './PaletteTileGrid';

// The category bar (docs/specs/007-editor/toolbar-layout.md "The category bar"): its state and its buttons are
// workbench's (@liveworkspace/workbench/components/palette/CategoryBar), bound here to this editor's flyout widths and
// strip divider; the flyout under it, drawn from this editor's tiles, is this editor's own.
export {
  HOVER_CLOSE_MS,
  HOVER_OPEN_MS,
} from '@liveworkspace/workbench/components/palette/CategoryBar';

// Resting on a presets tile this long opens its side panel; a click opens it at once.
const SIDE_OPEN_MS = 150;

export type BarCategory = FlyoutCategory & { group?: number | undefined };

// A category's flyout width: a catalogue's two panes, a grid of picture tiles, or its cards in one column or two.
const widthPx = (c: FlyoutCategory) =>
  flyoutWidthPx(c.tiles ? c.tiles.length : null, flyoutLayout(c.id) === 'cards', flyoutCardColumns);

/** The bar's state: which category's flyout is open, and the popover it hangs in. */
export function useCategoryBar(
  rootRef: RefObject<HTMLElement | null>,
  { onOpen }: { onOpen?: () => void } = {},
) {
  return useSharedCategoryBar<BarCategory>(rootRef, { onOpen, widthOf: widthPx });
}

type CategoryBarState = SharedCategoryBarState<BarCategory>;

/** The bar's buttons, a divider between the bands. */
export function CategoryBarButtons(
  props: Omit<
    Parameters<typeof SharedCategoryBarButtons<BarCategory>>[0],
    'divider' | 'tourAnchors'
  >,
) {
  return <SharedCategoryBarButtons {...props} divider={<Divider />} tourAnchors={false} />;
}

/** The open category's flyout, hung under its button and gliding to the next one, and its side panel. */
export function CategoryBarFlyout({
  bar,
  categories,
  actions,
  pendingDraw,
  isMobile,
  scale,
}: {
  bar: CategoryBarState;
  categories: readonly BarCategory[];
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null;
  isMobile: boolean;
  scale: number;
}) {
  // The side panel (CategoryFlyoutSide) and the category it belongs to: a switch of category drops it.
  // `focus` counts the keyboard's entries into it (ArrowRight on its tile), each moving the focus to its first card.
  const [side, setSide] = useState<(SideOpen & { category: string; focus: number }) | null>(null);
  // The tile it opened from, which ArrowLeft and Escape in the panel hand the focus back to.
  const sideTile = useRef<HTMLElement | null>(null);
  // Its own hover intent: resting on a presets tile opens its panel, resting on another tile closes it.
  const sideTimer = useRef<number | null>(null);
  const clearSideTimer = () => {
    if (sideTimer.current !== null) window.clearTimeout(sideTimer.current);
    sideTimer.current = null;
  };
  useEffect(() => clearSideTimer, []);
  const category = categories.find((c) => c.id === bar.openId);
  if (!category) return null;
  const openSide = side && side.category === category.id ? side : null;
  const showSide = (def: PaletteTileDef, el: HTMLElement, focus = 0) => {
    clearSideTimer();
    const placed = sidePlacement(el, def);
    if (!placed) return;
    sideTile.current = el;
    setSide({ ...placed, category: category.id, focus });
  };
  // ArrowRight on a side-panel tile: into its panel, opening it first if a rest has not yet.
  const enterSide = (def: PaletteTileDef, el: HTMLElement) => {
    if (openSide?.def.id === def.id) {
      clearSideTimer();
      setSide({ ...openSide, focus: openSide.focus + 1 });
    } else showSide(def, el, 1);
  };
  const leaveSide = () => {
    setSide(null);
    sideTile.current?.focus({ preventScroll: true });
  };
  const onItemHover = (def: PaletteTileDef | null, el: HTMLElement | null) => {
    clearSideTimer();
    if (def && el && opensSide(def)) {
      if (openSide?.def.id !== def.id)
        sideTimer.current = window.setTimeout(() => showSide(def, el), SIDE_OPEN_MS);
    } else if (openSide) {
      sideTimer.current = window.setTimeout(() => setSide(null), HOVER_CLOSE_MS);
    }
  };
  // The flyout and the side panel count as one surface for hover intent, drags and Escape.
  const surface = {
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') bar.hoverFlyout();
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') bar.leave();
    },
    onDragStart: bar.dragStarted,
    onDragEnd: bar.dragEnded,
  };
  const width = widthPx(category);
  return (
    <>
      <StripPopover
        right={bar.popover.right}
        isMobile={isMobile}
        scale={scale}
        name={category.label}
        dataAttr="data-category-flyout"
        widthClass={flyoutWidthClass(width)}
        seeThrough={bar.dragActive}
        glide
        bare
      >
        <div
          {...surface}
          onKeyDown={(e) => {
            // Escape closes it (the popover's own listener) and hands the focus back to its button.
            if (e.key === 'Escape') bar.close(true);
          }}
        >
          <CategoryFlyout
            key={category.id}
            category={category}
            actions={actions}
            pendingDraw={pendingDraw}
            focusFirst={bar.viaKeyboard}
            sideOpenId={openSide?.def.id ?? null}
            onSide={(def, el) => (openSide?.def.id === def.id ? setSide(null) : showSide(def, el))}
            onEnterSide={enterSide}
            onItemHover={onItemHover}
          />
        </div>
      </StripPopover>
      {openSide ? (
        <CategoryFlyoutSide
          key={openSide.def.id}
          side={openSide}
          focusKey={openSide.focus}
          onBack={leaveSide}
          isMobile={isMobile}
          scale={scale}
          actions={actions}
          pendingDraw={pendingDraw}
          seeThrough={bar.dragActive}
          hoverHandlers={{
            ...surface,
            onPointerEnter: (e) => {
              clearSideTimer();
              surface.onPointerEnter(e);
            },
          }}
        />
      ) : null}
    </>
  );
}
