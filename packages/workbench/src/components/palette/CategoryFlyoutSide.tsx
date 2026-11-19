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

export type SideOpen<T> = { def: T; top: number; right: number };

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
  return { def, top, right };
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
  // Lined up with its tile, unless that runs it off the bottom of the window: then it rises just enough to fit
  // (8px clear), never above the strip's top. Measured once it has laid out, before it paints.
  const [lift, setLift] = useState(0);
  useLayoutEffect(() => {
    const panel = panelRef.current!;
    // Its laid-out height too, not only its box: it mounts scaled down for its opening animation,
    // which measures it short and left its foot below the window. The larger never lifts too little.
    // Its floor is the flyout's foot, which already stops above the bottom bar; else the window's.
    const box = panel.getBoundingClientRect();
    const flyout = panel
      .closest('[data-toolbar-palette]')
      ?.querySelector('[data-category-flyout]')
      ?.getBoundingClientRect();
    const floor = Math.min(window.innerHeight - 8, flyout?.bottom || Infinity);
    const over = box.top + Math.max(box.height, panel.offsetHeight) - floor;
    setLift(over > 0 ? Math.min(over, side.top) : 0);
  }, [side.top]);
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
          ? { top: side.top - lift }
          : { ...uiUnscaleStyle(scale), top: side.top - lift, right: side.right }
      }
      className={`absolute ${isMobile ? 'inset-x-3' : 'w-[19rem]'} max-h-[calc(100dvh-10rem)] origin-top-left animate-dropdown-down transition-opacity duration-short ${seeThrough ? 'opacity-30' : ''} overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/50`}
    >
      <FlyoutHeader
        icon={def.icon}
        title={name}
        tagline={variants ? (def.variantsHint ?? PRESETS_HINT) : (extra?.tagline ?? '')}
        count={variants?.length}
      />
      <div
        ref={bodyRef}
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
