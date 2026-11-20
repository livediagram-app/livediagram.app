// How far Pages mode's Contents panel reaches in over the canvas from its left or right edge
// (docs/specs/007-editor/pages-mode.md "Contents"), wherever it is docked or dragged: a page
// framed on screen, and Zoom to Fit, centre in what shows beside it rather than under it.
import {
  CONTENTS_SIDEBAR_SELECTOR,
  NO_SIDE_INSETS,
  restingRect,
  sideInsetsOf,
  type SideInsets,
} from '@liveworkspace/workbench/lib/contents-sidebar';

/** The screen px the Contents panel covers at the canvas's left or right; none when it is absent,
 *  outside the canvas, or too short to be in the way (a fifth of the canvas's height). */
export function sideChromeInsets(canvas: HTMLElement): SideInsets {
  const panel = document.querySelector<HTMLElement>(CONTENTS_SIDEBAR_SELECTOR);
  if (!panel) return NO_SIDE_INSETS;
  return sideInsetsOf(canvas.getBoundingClientRect(), restingRect(panel));
}
