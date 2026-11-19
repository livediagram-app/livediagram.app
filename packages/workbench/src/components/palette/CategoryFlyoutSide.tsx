'use client';

import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { uiUnscaleStyle } from '../../lib/ui-scale';
import type { FlyoutKit, FlyoutTile } from './category-flyout-kit';
import { CardList, InfoFooter } from './category-flyout-items';
import { firstStop, onFlyoutArrowKey } from './category-flyout-keys';
import { FlyoutHeader } from './CategoryFlyout';

// The category flyout's side panel (each editor's docs/specs/007-editor/toolbar-layout.md "A tile's side panel"),
// every editor's one copy: what a tile with presets (Card, Badge) holds, or what the editor puts there for another
// kind (livedesign's opener and Fill tool, `extra`), in a second popover beside the flyout, lined up with the tile
// that opened it, so the flyout stays open behind it as a submenu's parent does. It opens on the side of the tile's own
// column (sidePlacement); on a phone it lies over the flyout. Its presets place and drag as any tile.

const PRESETS_HINT = 'Start from a preset, then change any of it.';
// Its design width, and the gap it keeps from the flyout.
export const SIDE_PX = 304;
const SIDE_GAP_PX = 8;

// `top` lines it up with its tile; `flyoutTop` and `flyoutHeight` are the flyout's own, where a phone's panel starts
// and the least it is tall when the kit has it cover the flyout (sideCoversFlyoutOnPhone).
export type SideOpen<T> = {
  def: T;
  top: number;
  right: number;
  flyoutTop?: number | undefined;
  flyoutHeight?: number | undefined;
};

/** The scale a computed `transform` draws at (`matrix(a, …)`'s `a`): 1 for none, or one this cannot read. */
export function animationScale(transform: string): number {
  const a = /^matrix\(\s*([-\d.e]+)/.exec(transform)?.[1];
  const scale = a ? Number(a) : 1;
  return scale > 0 ? scale : 1;
}

/** How far the panel rises to fit: its bottom where it would hang unlifted (`naturalBottom`), against `floor`, never
 *  more than `maxLift` (the strip's top). 0 when it fits. */
export function sideLift(naturalBottom: number, floor: number, maxLift: number): number {
  const over = naturalBottom - floor;
  return over > 0 ? Math.min(over, Math.max(0, maxLift)) : 0;
}

/** The default floor: the flyout's foot, which already stops above the bottom bar; else the window's, 8px clear. */
function flyoutFloor(panel: HTMLElement): number {
  const flyout = panel
    .closest('[data-toolbar-palette]')
    ?.querySelector('[data-category-flyout]')
    ?.getBoundingClientRect();
  return Math.min(window.innerHeight - 8, flyout?.bottom || Infinity);
}

/** What a side panel holds for a tile without presets: its line under the name, and its body. */
export type SideExtra = { tagline: string; body: ReactNode };

/** Where the panel hangs for a tile, as offsets into the strip's root (screen px, as the flyout's `right` is). */
export function sidePlacement<T>(tile: HTMLElement, def: T): SideOpen<T> | null {
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
  return {
    def,
    top,
    right,
    flyoutTop: Math.max(0, flyout.top - root.top),
    flyoutHeight: flyout.height,
  };
}

export function CategoryFlyoutSide<T extends FlyoutTile<T>, A, P>({
  side,
  kit,
  focusKey = 0,
  onBack,
  isMobile,
  scale,
  actions,
  pendingDraw,
  extra = null,
  seeThrough = false,
  hoverHandlers,
}: {
  side: SideOpen<T>;
  kit: FlyoutKit<T, A, P>;
  // Bumped when the keyboard enters the panel (ArrowRight on its tile): its first card takes the focus.
  focusKey?: number;
  // ArrowLeft on a card, or Escape anywhere in it: the panel closes and the focus goes back to its tile.
  onBack: () => void;
  isMobile: boolean;
  scale: number;
  actions: A;
  pendingDraw: P;
  // What it holds for a tile without presets (the editor's), else nothing but its header.
  extra?: SideExtra | null;
  // A tile is being dragged out: faded, and a drop on it lands on the canvas beneath (`data-drop-through`).
  seeThrough?: boolean;
  hoverHandlers: {
    onPointerEnter: (e: PointerEvent) => void;
    onPointerLeave: (e: PointerEvent) => void;
    onDragStart: () => void;
    onDragEnd: () => void;
  };
}) {
  const { def } = side;
  const [hovered, setHovered] = useState<T | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Lined up with its tile, unless that runs it below its floor (the kit's, else the flyout's foot): then it rises
  // just enough to fit, never above the strip's top. Measured before it paints, again once its opening animation has
  // settled, and whenever its size or the window's changes.
  const [lift, setLift] = useState(0);
  // Where it hangs from: its tile's top, or on a phone that covers the flyout, the flyout's own top.
  const cover = isMobile && !!kit.sideCoversFlyoutOnPhone;
  const anchor = cover ? (side.flyoutTop ?? side.top) : side.top;
  const floorOf = kit.sideFloor ?? flyoutFloor;
  const liftRef = useRef(0);
  useLayoutEffect(() => {
    const panel = panelRef.current!;
    const measure = () => {
      // Its settled height: it mounts scaled down for its opening animation (from its top left), which reads short,
      // so its box is unscaled, and its laid-out height taken when larger. The larger never lifts too little.
      const box = panel.getBoundingClientRect();
      const height = Math.max(
        box.height / animationScale(getComputedStyle(panel).transform),
        panel.offsetHeight,
      );
      const next = sideLift(box.top + liftRef.current + height, floorOf(panel), anchor);
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
  }, [anchor, floorOf]);
  useLayoutEffect(() => {
    if (focusKey) firstStop(bodyRef.current)?.focus({ preventScroll: true });
  }, [focusKey]);
  // Escape steps back out of the panel only, as out of a submenu. Window capture, so it runs before the strip
  // popover's own Escape (useStripPopover, document capture), which would close the flyout too.
  const back = useEffectEvent(onBack);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || !panelRef.current?.contains(document.activeElement)) return;
      e.stopPropagation();
      e.preventDefault();
      back();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  const variants = def.variants?.length ? kit.visible(def.variants, actions) : null;
  const name = kit.displayName(def);
  // Dragged out: faded, or with the kit's say hidden at once (no fade).
  const dragLook = kit.sideHidesOnDrag
    ? seeThrough
      ? 'opacity-0'
      : 'transition-opacity duration-short'
    : `transition-opacity duration-short${seeThrough ? ' opacity-30' : ''}`;
  return (
    <div
      data-category-flyout-side=""
      {...(seeThrough ? { 'data-drop-through': '' } : {})}
      data-floating-panel=""
      ref={panelRef}
      role="dialog"
      aria-label={name}
      {...hoverHandlers}
      style={
        isMobile
          ? { top: anchor - lift, ...(cover ? { minHeight: side.flyoutHeight } : {}) }
          : { ...uiUnscaleStyle(scale), top: anchor - lift, right: side.right }
      }
      className={`absolute ${isMobile ? `inset-x-3${cover ? ' flex flex-col' : ''}` : 'w-[19rem]'} max-h-[calc(100dvh-10rem)] origin-top-left animate-dropdown-down ${dragLook} overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/50`}
    >
      <FlyoutHeader
        icon={def.icon}
        title={name}
        tagline={variants ? (def.variantsHint ?? PRESETS_HINT) : (extra?.tagline ?? '')}
        count={variants?.length}
      />
      <div
        ref={bodyRef}
        // Covering a phone's flyout, the body fills the panel, so its footer pins to the bottom of the stretched panel.
        className={cover ? 'grow' : undefined}
        onKeyDown={(e) => {
          // ArrowLeft on a card goes back to the tile; in a field it still moves the caret.
          if (e.key !== 'ArrowLeft' || !(e.target as HTMLElement).matches('[data-flyout-item]'))
            return onFlyoutArrowKey(e, bodyRef.current);
          e.preventDefault();
          onBack();
        }}
      >
        {variants ? (
          <div className="p-2">
            <CardList
              tiles={variants}
              columns={1}
              kit={kit}
              actions={actions}
              pendingDraw={pendingDraw}
              onPress={(t) => kit.press(t, actions, pendingDraw)}
              onHover={(t) => setHovered(t)}
            />
          </div>
        ) : (
          extra?.body
        )}
      </div>
      {variants ? <InfoFooter def={hovered} kit={kit} /> : null}
    </div>
  );
}
