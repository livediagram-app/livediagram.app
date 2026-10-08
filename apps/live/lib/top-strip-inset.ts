// How far the Toolbar layout's top strip reaches down over the canvas: a page (useIllustratePages) or a board
// column (frame-board-column.ts) framed on screen centres below it.
// The Toolbar layout's strip lies over the canvas's top edge; the page centres below it.
const TOP_STRIP_SELECTOR = '[data-toolbar-palette]:not(.hidden)';

/** How far a top strip laid over the canvas reaches down into it, in screen px. */
export function topStripInset(canvas: HTMLElement): number {
  const strip = document.querySelector<HTMLElement>(TOP_STRIP_SELECTOR);
  // Stood aside (a phone's page toolbar in its place): its room is the page's.
  if (!strip || getComputedStyle(strip).visibility === 'hidden') return 0;
  const c = canvas.getBoundingClientRect();
  const s = strip.getBoundingClientRect();
  const overlaps = s.bottom > c.top && s.top < c.top + c.height / 2;
  return overlaps ? s.bottom - c.top : 0;
}
