'use client';

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { STRIP_RAIL_SCROLL } from '@/components/chrome/toolbar-surface';
import { track } from '@/lib/telemetry';
import type { PendingDraw } from '@/lib/draw-mode';
import { StripPopover, useStripPopover } from './ToolbarStripPopover';
import { CategoryFlyout, type FlyoutCategory } from './CategoryFlyout';
import { flyoutCardColumns, flyoutLayout } from './category-flyout-groups';
import { opensSide } from './category-flyout-items';
import { CategoryFlyoutSide, sidePlacement, type SideOpen } from './CategoryFlyoutSide';
import type { PaletteTileDef } from './palette-tile-defs';
import { StripOpenedBody, Divider } from './strip-rail-items';
import type { PaletteTileActions } from './PaletteTileGrid';

// The category bar (docs/specs/007-editor/toolbar-layout.md "The category bar"): Diagram's and Workshop's strip
// shows the mode's categories rather than one category's tiles, each a button with its glyph and name. With a mouse, resting
// on one opens its flyout (CategoryFlyout) centred under it, pointing at another moves the flyout there, and leaving
// both the bar and the flyout closes it. A tap or a click opens it too. The arrow keys walk the bar, and Down or
// Enter opens a category with its first tile focused.

// The bar's buttons, its flyout and the flyout's side panel: a press on any never counts as outside the flyout.
const BAR_SELECTOR =
  '[data-category-flyout], [data-category-flyout-side], [data-category-bar-button]';

// The flyout's design width: five picture tiles, two cards with their blurbs, or one column of cards for a short
// list (Media's two), so a small category is a small flyout.
const GRID_PX = 416;
const CARDS_PX = 576;
const CARD_COLUMN_PX = 304;
const RAIL_PX = 600;
const WIDTH_CLASS: Readonly<Record<number, string>> = {
  [RAIL_PX]: 'w-[37.5rem]',
  [GRID_PX]: 'w-[26rem]',
  [CARDS_PX]: 'w-[36rem]',
  [CARD_COLUMN_PX]: 'w-[19rem]',
};
const widthPx = (c: FlyoutCategory) => {
  // A catalogue (Icons, Stickers, Technology, Session) browses as two panes, its groups down the side.
  if (!c.tiles) return RAIL_PX;
  if (!c.tiles || flyoutLayout(c.id) !== 'cards') return GRID_PX;
  return flyoutCardColumns(c.tiles.length) === 1 ? CARD_COLUMN_PX : CARDS_PX;
};

// Hover intent, at design time (docs/specs/004-interface-design/motion.md has no token for a wait): a pointer resting
// this long on a closed bar opens the category, so sweeping across the bar to the canvas opens nothing; and the
// flyout waits this long after the pointer leaves before closing, so a diagonal path from a button into the flyout,
// across the gap or a corner of the canvas, keeps it open.
export const HOVER_OPEN_MS = 120;
export const HOVER_CLOSE_MS = 300;
// Resting on a presets tile this long opens its side panel; a click opens it at once.
const SIDE_OPEN_MS = 150;

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
  // Opened by a press (a click, a tap, the keyboard) rather than a rest of the pointer: a deliberate open, so moving
  // the pointer away doesn't close it; an outside press, Escape or using a tile does. Pointing at another category
  // still moves it there, pinned as it was.
  const pinned = useRef(false);
  // Hover intent's pending open or close, one at a time.
  const timer = useRef<number | null>(null);
  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clearTimer, []);
  // A tile dragged out of the flyout: it stays open until the drop, since closing it would unmount the tile mid-drag,
  // but it turns see-through and lets presses pass (`dragActive`), so a drop on the canvas it covers lands there.
  const dragging = useRef(false);
  const [dragActive, setDragActive] = useState(false);
  const close = (refocus: boolean) => {
    clearTimer();
    popover.setOpen(false);
    if (refocus && openId) buttons.current.get(openId)?.focus();
  };
  return {
    popover,
    openId: popover.open ? openId : null,
    viaKeyboard,
    buttons,
    isOpen,
    open: (category: FlyoutCategory, keyboard: boolean) => {
      clearTimer();
      pinned.current = true;
      open(category, keyboard);
    },
    close,
    /** The mouse came onto a bar button: open its category after a beat, or at once while another is open. */
    hoverButton: (category: FlyoutCategory) => {
      clearTimer();
      if (isOpen(category.id)) return;
      if (popover.open) open(category, false);
      else
        timer.current = window.setTimeout(() => {
          pinned.current = false;
          open(category, false);
        }, HOVER_OPEN_MS);
    },
    /** The mouse came onto the flyout: it stays. */
    hoverFlyout: clearTimer,
    /** The mouse left a button or the flyout: close after a grace, unless it was opened by a press, a tile is being
     *  dragged out, or a search has been typed into (the pointer drifting off would throw the query away). */
    leave: () => {
      clearTimer();
      if (pinned.current) return;
      timer.current = window.setTimeout(() => {
        timer.current = null;
        if (dragging.current || typedSearch()) return;
        popover.setOpen(false);
      }, HOVER_CLOSE_MS);
    },
    dragActive: popover.open && dragActive,
    dragStarted: () => {
      clearTimer();
      dragging.current = true;
      setDragActive(true);
    },
    dragEnded: () => {
      dragging.current = false;
      setDragActive(false);
      close(false);
    },
  };
}

// The flyout's search field (Icons, Technology) holds a query the person typed.
function typedSearch(): boolean {
  const field = document.activeElement;
  return (
    field instanceof HTMLInputElement &&
    !!field.closest('[data-category-flyout], [data-category-flyout-side]') &&
    field.value.trim() !== ''
  );
}

type CategoryBarState = ReturnType<typeof useCategoryBar>;

/** The bar's buttons, a divider between the bands (Common, Structure, Decorate). */
export function CategoryBarButtons({
  bar,
  categories,
  labels,
  scrollable = false,
}: {
  bar: CategoryBarState;
  categories: readonly BarCategory[];
  // Names beside the glyphs; off where the window is too narrow for them (and on a phone).
  labels: boolean;
  // A phone's strip: the bar is the part that gives way and swipes sideways, so the
  // selection mode and Search beside it stay in reach (docs/specs/007-editor/toolbar-layout.md "On a phone").
  scrollable?: boolean;
}) {
  // What pressed a bar button last (mouse, touch, pen), read by its click: the click alone doesn't say.
  const pressedBy = useRef<string | null>(null);
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
    <div
      role="toolbar"
      aria-label="Palette categories"
      {...(scrollable ? { 'data-strip-rail': '' } : {})}
      className={`flex items-center ${scrollable ? STRIP_RAIL_SCROLL : ''}`}
    >
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
            // The Diagram tour's Palette Categories step opens the first category; the Workshop tour rings Ask and
            // Session by their own anchors.
            data-tour-id={i === 0 ? 'palette-category' : `bar-${c.id}`}
            aria-label={c.label}
            aria-haspopup="dialog"
            aria-expanded={open}
            onPointerDown={(e) => {
              pressedBy.current = e.pointerType;
            }}
            onClick={(e) => {
              // A keyboard press (Enter, Space) reports no pointer position.
              const keyboard = e.detail === 0;
              // A tap (touch, pen) or a keyboard press on the open category toggles it shut. A mouse click on it keeps
              // it open, now pinned: the hover opened it and the click was on its way there.
              const toggles =
                keyboard || pressedBy.current === 'touch' || pressedBy.current === 'pen';
              pressedBy.current = null;
              if (open && toggles) bar.close(false);
              else bar.open(c, keyboard);
            }}
            onPointerEnter={(e) => {
              if (e.pointerType === 'mouse') bar.hoverButton(c);
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === 'mouse') bar.leave();
            }}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`relative flex h-9 shrink-0 touch-target-y items-center gap-1.5 rounded-lg transition ${
              labels ? 'pl-2 pr-2.5' : 'w-9 justify-center phone:w-11'
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
        // No hover card: resting on a button opens its flyout, which names it.
        return (
          <Fragment key={c.id}>
            {bandChange ? <Divider /> : null}
            {button}
          </Fragment>
        );
      })}
    </div>
  );
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
  const [side, setSide] = useState<(SideOpen & { category: string }) | null>(null);
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
  const showSide = (def: PaletteTileDef, el: HTMLElement) => {
    clearSideTimer();
    const placed = sidePlacement(el, def);
    if (placed) setSide({ ...placed, category: category.id });
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
  // An opener's body: the category it stands for, at its group (an AWS opener opens Technology's AWS marks).
  const openBody = (categoryId: string, group: string | null): ReactNode => (
    <StripOpenedBody
      opened={{ key: `${categoryId}/${group ?? ''}`, category: categoryId, group }}
      content={categories.find((c) => c.id === categoryId)?.content ?? null}
    />
  );
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
        dataAttr="data-category-flyout"
        widthClass={WIDTH_CLASS[width] ?? 'w-[26rem]'}
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
            onItemHover={onItemHover}
          />
        </div>
      </StripPopover>
      {openSide ? (
        <CategoryFlyoutSide
          key={openSide.def.id}
          side={openSide}
          isMobile={isMobile}
          scale={scale}
          actions={actions}
          pendingDraw={pendingDraw}
          openBody={openBody}
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
