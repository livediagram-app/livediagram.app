// The menu box joined to a sidebar docked beneath it (livedocuments and livedesign, docs/specs/007-editor/pages-mode.md
// "Joined to the menu box"): pinned at the canvas's left, Pages mode's Contents sidebar rises to the top and the menu
// box (the menu button and the tab's name) becomes its top row, one panel rather than a card over a sidebar. The box
// keeps its place, its button and its name; only its own frame gives way to the sidebar's surface.
import { toSurfacePx } from '../../lib/ui-scale';

/** The gap the palette strip keeps from the menu box's right edge (useStripCrowded, useBarLabels). */
export const STRIP_MENU_GAP_PX = 8;

// The menu box's inset from the canvas's top-left corner, in screen px (ToolbarMenuCard).
const MENU_CARD_INSET_PX = 12;

/** The box's frame easing in and out as the sidebar docks, and none under reduced motion. */
export const MENU_CARD_FRAME_MOTION =
  'motion-safe:transition-[background-color,border-color,box-shadow] motion-safe:duration-200 motion-safe:ease-out';

/** Joined: no border, fill or shadow of its own, so it sits straight on the sidebar's surface. Important, so a
 *  maximised element's band tint (livedesign's BAND_TINT) never paints it back. */
export const MENU_CARD_JOINED = 'border-transparent! bg-transparent! shadow-none!';

/** The box's width while joined, in the toolbar's surface px (it is drawn at the toolbar's UI scale): across the
 *  sidebar from its 12px inset to the strip's gap short of the sidebar's inner edge, so the strip, which keeps that
 *  gap from the box, clears the whole sidebar. `sidebarPx` is the sidebar's width on screen. */
export function joinedMenuCardWidth(sidebarPx: number, toolbarScale: number): number {
  return toSurfacePx(Math.max(0, sidebarPx - MENU_CARD_INSET_PX - STRIP_MENU_GAP_PX), toolbarScale);
}

/** The width the palette strip may take beside the menu box (`menu`, the `[data-toolbar-menu]` card), in an editor
 *  `viewWidth` wide whose left edge is at `viewLeft`. Centred across the editor, it keeps the strip's gap from the box
 *  on both sides; joined (`data-menu-joined`), the strip centres in what shows beside the sidebar instead, as a page
 *  is framed beside it, so only its left gives way and a laptop's strip keeps its names. */
export function stripRoomBesideMenu(
  viewWidth: number,
  viewLeft: number,
  menu: HTMLElement | null,
): number {
  if (!menu) return viewWidth;
  const clear = menu.getBoundingClientRect().right - viewLeft + STRIP_MENU_GAP_PX;
  return menu.hasAttribute('data-menu-joined')
    ? viewWidth - clear - STRIP_MENU_GAP_PX
    : viewWidth - 2 * clear;
}

/** The sidebar's top row while joined: room for the menu box (drawn over it, above the sidebar), a hairline at its
 *  foot, so the sidebar's own header sits where it does unjoined. `height` is in the sidebar's surface px. */
export function MenuJoinBand({ height }: { height: number }) {
  return (
    <div
      aria-hidden
      data-menu-join-band=""
      style={{ height }}
      className="mx-3 shrink-0 border-b border-slate-200 dark:border-slate-800"
    />
  );
}
