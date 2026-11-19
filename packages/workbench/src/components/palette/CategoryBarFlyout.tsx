'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { StripPopover } from './ToolbarStripPopover';
import { HOVER_CLOSE_MS, flyoutWidthClass, type CategoryBarState } from './CategoryBar';
import { CategoryFlyout } from './CategoryFlyout';
import {
  CategoryFlyoutSide,
  sidePlacement,
  type SideExtra,
  type SideOpen,
} from './CategoryFlyoutSide';
import {
  flyoutCategoryWidthPx,
  type FlyoutCategory,
  type FlyoutKit,
  type FlyoutTile,
} from './category-flyout-kit';

// The open category's flyout under the category bar (each editor's docs/specs/007-editor/toolbar-layout.md "The
// flyout" and "A tile's side panel"), every editor's one copy: hung under its button and gliding to the next one, and
// the side panel a tile opens beside it, with the hover intent and the keyboard that move between the two. The tiles
// are the editor's (its kit), and so is what a side panel holds for a tile without presets (`sideExtra`).

// Resting on a side-panel tile this long opens its panel; a click opens it at once.
const SIDE_OPEN_MS = 150;

export function CategoryBarFlyout<
  T extends FlyoutTile<T>,
  A,
  P,
  C extends FlyoutCategory<T> & { group?: number | undefined },
>({
  bar,
  categories,
  kit,
  actions,
  pendingDraw,
  isMobile,
  scale,
  sideExtra,
  pressSide,
}: {
  bar: CategoryBarState<C>;
  categories: readonly C[];
  kit: FlyoutKit<T, A, P>;
  actions: A;
  pendingDraw: P;
  isMobile: boolean;
  scale: number;
  // What the side panel holds for a tile without presets (an opener's category, the Fill tool's colour).
  sideExtra?: ((def: T) => SideExtra | null) | undefined;
  // A press on a side-panel tile the editor handles itself (the Fill tool picks up on a desktop): true when it did.
  pressSide?: ((def: T) => boolean) | undefined;
}) {
  // The side panel (CategoryFlyoutSide) and the category it belongs to: a switch of category drops it.
  // `focus` counts the keyboard's entries into it (ArrowRight on its tile), each moving the focus to its first card.
  const [side, setSide] = useState<(SideOpen<T> & { category: string; focus: number }) | null>(
    null,
  );
  // The tile it opened from, which ArrowLeft and Escape in the panel hand the focus back to.
  const sideTile = useRef<HTMLElement | null>(null);
  // Its own hover intent: resting on a side-panel tile opens its panel, resting on another tile closes it.
  const sideTimer = useRef<number | null>(null);
  const clearSideTimer = () => {
    if (sideTimer.current !== null) window.clearTimeout(sideTimer.current);
    sideTimer.current = null;
  };
  useEffect(() => clearSideTimer, []);
  const category = categories.find((c) => c.id === bar.openId);
  if (!category) return null;
  const openSide = side && side.category === category.id ? side : null;
  const showSide = (def: T, el: HTMLElement, focus = 0) => {
    clearSideTimer();
    const placed = sidePlacement(el, def);
    if (!placed) return;
    sideTile.current = el;
    setSide({ ...placed, category: category.id, focus });
  };
  // ArrowRight on a side-panel tile: into its panel, opening it first if a rest has not yet.
  const enterSide = (def: T, el: HTMLElement) => {
    if (openSide?.def.id === def.id) {
      clearSideTimer();
      setSide({ ...openSide, focus: openSide.focus + 1 });
    } else showSide(def, el, 1);
  };
  const leaveSide = () => {
    setSide(null);
    sideTile.current?.focus({ preventScroll: true });
  };
  const onItemHover = (def: T | null, el: HTMLElement | null) => {
    clearSideTimer();
    if (def && el && kit.opensSide(def)) {
      if (openSide?.def.id !== def.id)
        sideTimer.current = window.setTimeout(() => showSide(def, el), SIDE_OPEN_MS);
    } else if (openSide) {
      sideTimer.current = window.setTimeout(() => setSide(null), HOVER_CLOSE_MS);
    }
  };
  // The flyout and the side panel count as one surface for hover intent, drags and Escape.
  const surface = {
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType === 'mouse') bar.hoverFlyout();
    },
    onPointerLeave: (e: PointerEvent) => {
      if (e.pointerType === 'mouse') bar.leave();
    },
    onDragStart: bar.dragStarted,
    onDragEnd: bar.dragEnded,
  };
  return (
    <>
      <StripPopover
        right={bar.popover.right}
        isMobile={isMobile}
        scale={scale}
        name={category.label}
        dataAttr="data-category-flyout"
        widthClass={flyoutWidthClass(flyoutCategoryWidthPx(kit, category))}
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
            kit={kit}
            actions={actions}
            pendingDraw={pendingDraw}
            focusFirst={bar.viaKeyboard}
            sideOpenId={openSide?.def.id ?? null}
            onSide={(def, el) => {
              if (pressSide?.(def)) return;
              if (openSide?.def.id === def.id) setSide(null);
              else showSide(def, el);
            }}
            onEnterSide={enterSide}
            onItemHover={onItemHover}
          />
        </div>
      </StripPopover>
      {openSide ? (
        <CategoryFlyoutSide
          key={openSide.def.id}
          side={openSide}
          kit={kit}
          focusKey={openSide.focus}
          onBack={leaveSide}
          isMobile={isMobile}
          scale={scale}
          actions={actions}
          pendingDraw={pendingDraw}
          extra={openSide.def.variants?.length ? null : (sideExtra?.(openSide.def) ?? null)}
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
