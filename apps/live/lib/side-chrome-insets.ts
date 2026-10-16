// How far Illustrate's Contents panel reaches in over the canvas from its left or right edge
// (docs/specs/007-editor/illustrate-pages.md "Contents"), wherever it is docked or dragged: a page
// framed on screen, and Zoom to Fit, centre in what shows beside it rather than under it.
import { CONTENTS_SIDEBAR_SELECTOR } from './contents-placement';

export type SideInsets = { left: number; right: number };

export const NO_SIDE_INSETS: SideInsets = { left: 0, right: 0 };

/** The screen px the Contents panel covers at the canvas's left or right; none when it is absent,
 *  outside the canvas, or too short to be in the way (a fifth of the canvas's height). */
export function sideChromeInsets(canvas: HTMLElement): SideInsets {
  const panel = document.querySelector<HTMLElement>(CONTENTS_SIDEBAR_SELECTOR);
  if (!panel) return NO_SIDE_INSETS;
  return sideInsetsOf(canvas.getBoundingClientRect(), panel.getBoundingClientRect());
}

/** The pure measure behind sideChromeInsets: a panel in the canvas's left half covers its left up
 *  to the panel's right edge, one in its right half its right from the panel's left edge. */
export function sideInsetsOf(
  canvas: { left: number; right: number; top: number; bottom: number },
  panel: { left: number; right: number; top: number; bottom: number },
): SideInsets {
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
