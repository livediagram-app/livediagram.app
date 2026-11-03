// Pages mode's Contents docked as a sidebar (docs/specs/007-editor/pages-mode.md "Contents"): its size,
// the side it is pinned to, and how far it reaches in over the canvas, so a page framed on screen, and
// Zoom to Fit, centre in what shows beside it rather than under it. Where Contents sits (the sidebar or
// the button) is the person's preference, which each editor keeps in its own lib/contents-placement.ts.

// The docked sidebar, for what measures it (the page framing, Zoom to Fit).
export const CONTENTS_SIDEBAR_SELECTOR = '[data-contents-sidebar]';
// Its width in px, at the panels' UI scale. It sits flush against the canvas's edge, no gap.
export const CONTENTS_SIDEBAR_WIDTH = 236;
// The resting inset the corner panels and the bottom-right cluster keep from what is beside them.
const CONTENTS_SIDEBAR_GAP = 16;

// The sidebar is docked with more than one page: a single page has nothing to find its way round,
// and keeps the button.
export const CONTENTS_SIDEBAR_MIN_PAGES = 2;

// Which side of the canvas the sidebar is pinned to: the left until the person drags it right. Like
// the corner panels' places, a per-device ergonomic choice, kept in this browser only (under each
// editor's CONTENTS_SIDE_STORAGE_KEY) and never synced.
export const CONTENTS_SIDES = ['left', 'right'] as const;
export type ContentsSide = (typeof CONTENTS_SIDES)[number];

export function readContentsSide(stored: string | null): ContentsSide {
  return stored === 'right' ? 'right' : 'left';
}

// How far the corner stacks and the bottom-right cluster on the sidebar's side start from the
// canvas's edge while it is docked: past it, with their usual inset.
export function contentsSidebarClearancePx(panelScale: number): number {
  return CONTENTS_SIDEBAR_WIDTH * panelScale + CONTENTS_SIDEBAR_GAP;
}

/** The bottom-right cluster's bounds beside a docked sidebar (docs/specs/007-editor/pages-mode.md "Docked"), in screen
 *  px from the canvas's sides, its 16px margin added by the caller: pinned right, the cluster moves past the sidebar
 *  (`right`); pinned left, it stops short of it (`left`) and wraps upward from the right rather than run under Add
 *  Page. Null `left` leaves the cluster unbounded on that side. */
export function contentsClusterBounds(
  docked: boolean,
  side: ContentsSide,
  panelScale: number,
): { right: number; left: number | null } {
  if (!docked) return { right: 0, left: null };
  return side === 'right'
    ? { right: CONTENTS_SIDEBAR_WIDTH * panelScale, left: null }
    : { right: 0, left: contentsSidebarClearancePx(panelScale) };
}

export type SideInsets = { left: number; right: number };

export const NO_SIDE_INSETS: SideInsets = { left: 0, right: 0 };

type Box = { left: number; right: number; top: number; bottom: number };

/** Where a panel rests, its `translate` left out: dropped on the other side (or docking), the
 *  sidebar slides home over 200 ms, and a page framed meanwhile must centre beside where it will
 *  be, not where it has got to. */
export function restingRect(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  const [dx = 0, dy = 0] = translateOf(getComputedStyle(el).translate);
  return { left: r.left - dx, right: r.right - dx, top: r.top - dy, bottom: r.bottom - dy };
}

/** The px of a computed `translate` ("12px", "12px -4px", "none"). */
export function translateOf(value: string | undefined): [number, number] {
  if (!value || value === 'none') return [0, 0];
  const [x = '0', y = '0'] = value.trim().split(/\s+/);
  const px = (v: string) => (v.endsWith('px') ? Number.parseFloat(v) || 0 : 0);
  return [px(x), px(y)];
}

/** The screen px a panel covers at the canvas's left or right: a panel in the canvas's left half
 *  covers its left up to the panel's right edge, one in its right half its right from the panel's
 *  left edge; none when it is outside the canvas, or too short to be in the way (a fifth of the
 *  canvas's height). */
export function sideInsetsOf(canvas: Box, panel: Box): SideInsets {
  const width = canvas.right - canvas.left;
  const height = canvas.bottom - canvas.top;
  const overlapsX = panel.right > canvas.left && panel.left < canvas.right;
  const tall = Math.min(panel.bottom, canvas.bottom) - Math.max(panel.top, canvas.top);
  if (!overlapsX || width <= 0 || tall < height / 5) return NO_SIDE_INSETS;
  const middle = (panel.left + panel.right) / 2;
  if (middle < canvas.left + width / 2) {
    return { left: Math.min(width / 2, panel.right - canvas.left), right: 0 };
  }
  return { left: 0, right: Math.min(width / 2, canvas.right - panel.left) };
}
