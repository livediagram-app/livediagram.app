// Pages mode's Contents docked as a sidebar (docs/specs/007-editor/pages-mode.md "Contents"): its size,
// always down the left, and how far it reaches in over the canvas, so a page framed on screen, and
// Zoom to Fit, centre in what shows beside it rather than under it. Where Contents sits (the sidebar or
// the button) is the person's preference, which each editor keeps in its own lib/contents-placement.ts.

// The docked sidebar, for what measures it (the page framing, Zoom to Fit).
export const CONTENTS_SIDEBAR_SELECTOR = '[data-contents-sidebar]';
// Its width in px, at the panels' UI scale. It sits flush against the canvas's edge, no gap.
export const CONTENTS_SIDEBAR_WIDTH = 236;
// The resting inset the corner panels and the bottom-right cluster keep from what is beside them.
const CONTENTS_SIDEBAR_GAP = 16;

// The sidebar is docked from the first page: it is where pages are added, named and reordered, so
// it is there from the start rather than appearing with a second page and shifting the canvas.
export const CONTENTS_SIDEBAR_MIN_PAGES = 1;

// How far the left corner stacks and the bottom-right cluster start from the canvas's left while
// the sidebar is docked: past it, with their usual inset.
export function contentsSidebarClearancePx(panelScale: number): number {
  return CONTENTS_SIDEBAR_WIDTH * panelScale + CONTENTS_SIDEBAR_GAP;
}

/** The bottom-right cluster's left bound beside a docked sidebar (docs/specs/007-editor/pages-mode.md "Docked"), in
 *  screen px from the canvas's left, its 16px margin added by the caller: the sidebar is always on the left, so the
 *  cluster stops short of it and wraps upward from the right rather than run under Add Page. Null leaves the cluster
 *  unbounded. */
export function contentsClusterLeft(docked: boolean, panelScale: number): number | null {
  return docked ? contentsSidebarClearancePx(panelScale) : null;
}

export type SideInsets = { left: number; right: number };

export const NO_SIDE_INSETS: SideInsets = { left: 0, right: 0 };

type Box = { left: number; right: number; top: number; bottom: number };

/** Where a panel rests, its `translate` left out: docking, the sidebar slides in over 200 ms, and a page framed meanwhile must centre beside where it will
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
