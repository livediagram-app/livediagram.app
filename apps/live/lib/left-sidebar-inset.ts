// How far a docked sidebar reaches in over the canvas's left edge (Illustrate's Contents,
// docs/specs/007-editor/illustrate-pages.md "Contents"): a page framed on screen centres beside it.
import { CONTENTS_SIDEBAR_SELECTOR } from './contents-placement';

/** How far a sidebar laid over the canvas reaches into it from the left, in screen px; 0 with none. */
export function leftSidebarInset(canvas: HTMLElement): number {
  const sidebar = document.querySelector<HTMLElement>(CONTENTS_SIDEBAR_SELECTOR);
  if (!sidebar) return 0;
  const c = canvas.getBoundingClientRect();
  const s = sidebar.getBoundingClientRect();
  const overlaps = s.right > c.left && s.left < c.left + c.width / 2;
  return overlaps ? s.right - c.left : 0;
}
