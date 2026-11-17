// The menu box joined to a sidebar docked beneath it (livedocuments and livedesign, docs/specs/007-editor/pages-mode.md
// "Joined to the menu box"): pinned at the canvas's left, Pages mode's Contents sidebar rises to the top and the menu
// box (the menu button and the tab's name) becomes its top row, one panel rather than a card over a sidebar. The box
// keeps its place, its button and its name; only its own frame gives way to the sidebar's surface.
import { editorViewportOf } from '../../lib/editor-viewport';
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

/** The menu box's right edge as it would stand uncapped, in screen px: its drawn right plus whatever of the tab's
 *  name (`[data-tab-name-in-box]`) the box's cap hides, up to the name's own widest (16rem). The strip decides where
 *  it goes from this, never from the capped box (useMenuCardRoom caps the box at the room left of the strip): measured
 *  from the capped box, a crowded strip un-crowded itself, re-centred further left and capped the box tighter still,
 *  cutting the mode switch and hiding the name (Work Tracker 1038). Joined, the box's width is the sidebar's, never
 *  capped. */
export function menuNaturalRight(menu: HTMLElement): number {
  const box = menu.getBoundingClientRect();
  const right = box.right;
  if (menu.hasAttribute('data-menu-joined')) return right;
  // Compact (`data-menu-form` icon or bare: the mode switch down to its icon, the name hidden, useMenuCardFit), the
  // box is narrower than it stands whole, and the strip goes by the width it kept from its last whole form
  // (`data-menu-natural-width`, screen px): measured from the compact box, the strip un-crowded and came back.
  const kept = Number(menu.dataset.menuNaturalWidth);
  if (menu.dataset.menuForm && menu.dataset.menuForm !== 'full' && kept > 0) {
    return Math.max(right, box.left + kept);
  }
  const name = menu.querySelector<HTMLElement>(':scope > [data-tab-name-in-box]');
  if (!name || name.offsetWidth === 0) return right;
  // Its border-box width with nothing hidden, no wider than its own max-width (border-box, as Tailwind's base sets).
  const whole = name.scrollWidth + (name.offsetWidth - name.clientWidth);
  const own = parseFloat(getComputedStyle(name).maxWidth);
  const hidden = (Number.isFinite(own) ? Math.min(whole, own) : whole) - name.offsetWidth;
  if (hidden <= 0) return right;
  // Layout px to screen px (the box is drawn at the toolbar's UI scale).
  return right + hidden * (name.getBoundingClientRect().width / name.offsetWidth);
}

/** The width the palette strip may take beside the menu box (`menu`, the `[data-toolbar-menu]` card), in an editor
 *  `viewWidth` wide whose left edge is at `viewLeft`. Centred across the editor, it keeps the strip's gap from the box
 *  on both sides; joined (`data-menu-joined`), the strip centres in what shows beside the sidebar instead, as a page
 *  is framed beside it, so only its left gives way and a laptop's strip keeps its names. */
export function stripRoomBesideMenu(
  viewWidth: number,
  viewLeft: number,
  menu: HTMLElement | null,
  // A strip that may leave the centre for the left, beside the menu box (STRIP_SHIFTS_LEFT): its room is everything
  // between the box and the corner card (or the editor's right edge), not only what is centred.
  shiftsLeft = false,
): number {
  // Experiment (no header bar): the Share and account card at the top right (EditorCornerActions) is cleared as the
  // menu box is, so the strip stands between the two, never under either.
  const right = cornerCardClear(viewWidth, viewLeft);
  if (!menu) return viewWidth - 2 * right;
  // Joined, the box ends a gap short of the sidebar's inner edge: `clear` reaches that edge. Unjoined, the strip keeps
  // its side space from the box.
  const clear =
    menuNaturalRight(menu) -
    viewLeft +
    (menu.hasAttribute('data-menu-joined') ? STRIP_MENU_GAP_PX : STRIP_SIDE_SPACE_PX);
  if (shiftsLeft)
    return viewWidth - stripLeftClear(menu, viewLeft) - Math.max(right, MENU_CARD_INSET_PX);
  // Joined, `clear` reaches the sidebar's inner edge (the box stops a gap short of it), and the strip, centred beside
  // the sidebar, keeps the gap from it and from the editor's right edge, or the corner card's clearance where that is
  // wider (on both sides, since the strip stays centred).
  return menu.hasAttribute('data-menu-joined')
    ? viewWidth - clear - 2 * Math.max(STRIP_SIDE_SPACE_PX, right)
    : viewWidth - 2 * Math.max(clear, right);
}

/** The room a strip keeps from what it stands beside when it leaves the centre (the menu box, the Contents sidebar,
 *  the corner card): wider than the box's own gap, so it never reads as touching them. */
export const STRIP_SIDE_SPACE_PX = 16;

/** Where a strip standing at the left (shifted, or giving way) starts, in screen px from the editor's left: the space
 *  past the menu box, or joined, past the sidebar the box heads (which ends a gap beyond the box). */
export function stripLeftClear(menu: HTMLElement | null, viewLeft: number): number {
  if (!menu) return 0;
  const right = menu.getBoundingClientRect().right - viewLeft;
  const edge = menu.hasAttribute('data-menu-joined') ? right + STRIP_MENU_GAP_PX : right;
  return Math.max(0, Math.ceil(edge + STRIP_SIDE_SPACE_PX));
}

/** Sent on `window` when the top-right corner card mounts, resizes or goes, so the strip measures its room again. */
// The corner card's inset from the editor's top-right corner, in screen px (EditorCornerActions' right-3).
const CORNER_CARD_INSET_PX = 12;

/** On a strip's root: when it can't centre, it moves left beside the menu box before it gives up names or folds
 *  (livedocuments). Read by useStripCrowding, useBarLabels and useBarFold through `stripShiftsLeft`. */
export const STRIP_SHIFTS_LEFT = 'data-strip-shifts-left';
export const stripShiftsLeft = (card: Element) => card.closest(`[${STRIP_SHIFTS_LEFT}]`) !== null;

/** Experiment (no header bar): a strip centred in the gap between the menu box and the corner card rather than across
 *  the editor, filling that gap when it runs short (livediagram). Its room is the whole gap, as a shifting strip's is. */
export const STRIP_BETWEEN = 'data-strip-between';
export const stripSitsBetween = (card: Element) => card.closest(`[${STRIP_BETWEEN}]`) !== null;
/** Whether the strip's room is the whole gap between the menu box and the corner card (stripRoomBesideMenu's
 *  `shiftsLeft`). */
export const stripTakesGap = (card: Element) => stripShiftsLeft(card) || stripSitsBetween(card);

export const CORNER_CARD_EVENT = 'corner-card-change';

/** Sent on `window` when the palette strip's width with its category names (`data-strip-natural-width`) changes, so
 *  the corner card judges again whether to drop its own names first (cornerCardCompact). */
export const STRIP_NAMED_EVENT = 'strip-named-change';

/** Experiment (no header bar): whether the top-right corner card drops its names (Share, Sign in), given its width
 *  with them in screen px. It does so first, as the window narrows: once the palette, named, no longer fits between
 *  the menu box and the card with its names, so the palette keeps its names as long as it can. */
export function cornerCardCompact(wideWidth: number): boolean {
  if (typeof document === 'undefined' || wideWidth <= 0) return false;
  const strip = document.querySelector<HTMLElement>(
    '[data-region=palette] [data-strip-natural-width]',
  );
  const named = strip ? Number(strip.dataset.stripNaturalWidth) || 0 : 0;
  if (!strip || named <= 0) return false;
  const view = editorViewportOf(strip);
  const menu = document.querySelector<HTMLElement>('[data-toolbar-menu]');
  const room =
    view.width -
    stripLeftClear(menu, view.left) -
    (Math.ceil(wideWidth) + CORNER_CARD_INSET_PX + STRIP_SIDE_SPACE_PX);
  return named > room;
}

/** How far in from the editor's right edge the strip must stop to keep its gap from the top-right corner card, in
 *  screen px; 0 with no card over this editor. Measured in the browser only (the strip's layout effects). */
export function cornerCardClear(viewWidth: number, viewLeft: number): number {
  const card = document.querySelector<HTMLElement>('[data-corner-actions]');
  if (!card) return 0;
  const box = card.getBoundingClientRect();
  // The card stands over the editor at the window's right edge (in a split, the right pane): elsewhere, nothing to
  // clear. Judged from the editor's box, not the card's, since a resize can measure before the card has moved.
  if (box.width === 0 || viewLeft + viewWidth < window.innerWidth - 1) return 0;
  // Its width, its 12px inset from the corner and the strip's space.
  return Math.ceil(box.width) + CORNER_CARD_INSET_PX + STRIP_SIDE_SPACE_PX;
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
