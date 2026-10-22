// How far Pages mode's Contents panel reaches in over the canvas from its left or right edge
// (docs/specs/007-editor/pages-mode.md "Contents"), wherever it is docked or dragged: a page
// framed on screen, and Zoom to Fit, centre in what shows beside it rather than under it.
import { CONTENTS_SIDEBAR_SELECTOR } from './contents-placement';

type SideInsets = { left: number; right: number };

export const NO_SIDE_INSETS: SideInsets = { left: 0, right: 0 };

/** The screen px the Contents panel covers at the canvas's left or right; none when it is absent,
 *  outside the canvas, or too short to be in the way (a fifth of the canvas's height). */
export function sideChromeInsets(canvas: HTMLElement): SideInsets {
  const c = canvas.getBoundingClientRect();
  const panels = [CONTENTS_SIDEBAR_SELECTOR]
    .map((sel) => document.querySelector<HTMLElement>(sel))
    .filter((el): el is HTMLElement => el !== null);
  if (!panels.length) return NO_SIDE_INSETS;
  return panels.reduce<SideInsets>((acc, el) => {
    const next = sideInsetsOf(c, restingRect(el));
    return { left: Math.max(acc.left, next.left), right: Math.max(acc.right, next.right) };
  }, NO_SIDE_INSETS);
}

/** Where a panel rests, its `translate` left out: dropped on the other side (or docking), the
 *  sidebar slides home over 200 ms, and a page framed meanwhile must centre beside where it will
 *  be, not where it has got to. */
export function restingRect(el: HTMLElement): {
  left: number;
  right: number;
  top: number;
  bottom: number;
} {
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
