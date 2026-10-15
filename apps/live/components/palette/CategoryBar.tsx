'use client';

import {
  Fragment,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { HoverCard } from '@livediagram/ui';
import { track } from '@/lib/telemetry';
import type { PendingDraw } from '@/lib/draw-mode';
import { StripPopover, useStripPopover } from './ToolbarStripPopover';
import { CategoryFlyout, type FlyoutCategory } from './CategoryFlyout';
import { flyoutLayout, flyoutTagline } from './category-flyout-groups';
import { StripOpenedBody, Divider } from './strip-rail-items';
import type { PaletteTileActions } from './PaletteTileGrid';

// Diagram's category bar (docs/specs/007-editor/toolbar-layout.md "Diagram's category bar"): the strip shows the
// mode's categories rather than one category's tiles, each a button with its glyph and name. Pressing one opens its
// flyout (CategoryFlyout) centred under it; while one is open, pointing at another moves the flyout there, as a
// menu bar does. The arrow keys walk the bar, and Down or Enter opens a category with its first tile focused.

// The bar's buttons and its flyout: a press on either never counts as outside the flyout.
const BAR_SELECTOR = '[data-category-flyout], [data-category-bar-button]';

// The flyout's design width: wide enough for five picture tiles, or two cards with their blurbs.
const GRID_PX = 416;
const CARDS_PX = 576;
const widthPx = (c: FlyoutCategory) =>
  c.tiles && flyoutLayout(c.id) === 'cards' ? CARDS_PX : GRID_PX;

export type BarCategory = FlyoutCategory & { group?: number | undefined };

/** The bar's state: which category's flyout is open, and the popover it hangs in. */
export function useCategoryBar(rootRef: RefObject<HTMLElement | null>) {
  const popover = useStripPopover(rootRef, BAR_SELECTOR);
  const [openId, setOpenId] = useState<string | null>(null);
  // Opened from the keyboard, so the flyout focuses its first tile.
  const [viaKeyboard, setViaKeyboard] = useState(false);
  const buttons = useRef(new Map<string, HTMLElement>());
  const isOpen = (id: string) => popover.open && openId === id;
  const open = (category: FlyoutCategory, keyboard: boolean) => {
    const button = buttons.current.get(category.id);
    if (!button) return;
    if (!isOpen(category.id)) track('UI', 'Changed', 'ToolbarCategory');
    setOpenId(category.id);
    setViaKeyboard(keyboard);
    popover.openFrom(button, 'centre', widthPx(category));
  };
  return {
    popover,
    openId: popover.open ? openId : null,
    viaKeyboard,
    buttons,
    isOpen,
    open,
    close: (refocus: boolean) => {
      popover.setOpen(false);
      if (refocus && openId) buttons.current.get(openId)?.focus();
    },
  };
}

export type CategoryBarState = ReturnType<typeof useCategoryBar>;

/** The bar's buttons, a divider between the bands (Popular, then Common, Structure, Decorate). */
export function CategoryBarButtons({
  bar,
  categories,
  labels,
}: {
  bar: CategoryBarState;
  categories: readonly BarCategory[];
  // Names beside the glyphs; off where the window is too narrow for them (and on a phone).
  labels: boolean;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (step) {
      e.preventDefault();
      const next = categories[(i + step + categories.length) % categories.length]!;
      bar.buttons.current.get(next.id)?.focus();
      // A flyout already open follows the focus, as a menu bar's does.
      if (bar.openId) bar.open(next, true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      bar.open(categories[i]!, true);
    }
  };
  return (
    <div role="toolbar" aria-label="Palette categories" className="flex items-center">
      {categories.map((c, i) => {
        const open = bar.isOpen(c.id);
        const bandChange = i > 0 && categories[i - 1]!.group !== c.group;
        const button = (
          <button
            ref={(el) => {
              if (el) bar.buttons.current.set(c.id, el);
              else bar.buttons.current.delete(c.id);
            }}
            type="button"
            data-category-bar-button=""
            // The Diagram tour's Palette Categories step rings the bar and opens the first category.
            {...(i === 0 ? { 'data-tour-id': 'palette-category' } : {})}
            aria-label={c.label}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={(e) => {
              if (open) bar.close(false);
              // A keyboard press (Enter, Space) reports no pointer position.
              else bar.open(c, e.detail === 0);
            }}
            onPointerEnter={(e) => {
              if (e.pointerType === 'mouse' && bar.openId && !open) bar.open(c, false);
            }}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`relative flex h-9 shrink-0 touch-target-y items-center gap-1.5 rounded-lg transition ${
              labels ? 'pl-2 pr-2.5' : 'w-9 justify-center phone:w-8'
            } ${
              open
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
            }`}
          >
            <span
              aria-hidden
              className="flex h-[18px] w-[18px] items-center justify-center [&>svg]:max-h-full [&>svg]:max-w-full"
            >
              {c.icon}
            </span>
            {labels ? (
              <span className="text-[13px] font-medium leading-none">{c.label}</span>
            ) : null}
            {/* The open category's marker, under its button. */}
            <span
              aria-hidden
              className={`absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full bg-brand-500 transition-opacity duration-micro ${open ? 'opacity-100' : 'opacity-0'}`}
            />
          </button>
        );
        return (
          <Fragment key={c.id}>
            {bandChange ? <Divider /> : null}
            {open || bar.openId ? (
              // No hover card while a flyout is open: the flyout already names it.
              button
            ) : (
              <HoverCard title={c.label} description={flyoutTagline(c.id, c.description)}>
                {button}
              </HoverCard>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

/** The open category's flyout, hung under its button and gliding to the next one. */
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
  const category = categories.find((c) => c.id === bar.openId);
  if (!category) return null;
  // An opener's body: the category it stands for, at its group (Popular's AWS opens Technology's AWS marks).
  const openBody = (categoryId: string, group: string | null): ReactNode => (
    <StripOpenedBody
      opened={{ key: `${categoryId}/${group ?? ''}`, category: categoryId, group, label: '' }}
      content={categories.find((c) => c.id === categoryId)?.content ?? null}
    />
  );
  return (
    <StripPopover
      right={bar.popover.right}
      isMobile={isMobile}
      scale={scale}
      dataAttr="data-category-flyout"
      widthClass={widthPx(category) === CARDS_PX ? 'w-[36rem]' : 'w-[26rem]'}
      glide
      bare
    >
      <div
        onKeyDown={(e) => {
          // Escape closes it (the popover's own listener) and hands the focus back to its button.
          if (e.key === 'Escape') bar.close(true);
        }}
      >
        {/* Keyed on the category, so a drill into one never carries over to the next. */}
        <CategoryFlyout
          key={category.id}
          category={category}
          actions={actions}
          pendingDraw={pendingDraw}
          focusFirst={bar.viaKeyboard}
          openBody={openBody}
        />
      </div>
    </StripPopover>
  );
}
