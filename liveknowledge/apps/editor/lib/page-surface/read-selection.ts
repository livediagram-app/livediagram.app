// A reader's selection in the writing lets go on a press elsewhere on the page, as on any web page
// (docs/specs/030-knowledgebase/editing.md "Selecting and copying"). The canvas takes a press on the margins for its
// own (focus, pan), so the browser never gets to collapse the selection there: a highlight stayed on the page after
// a click beside it. A press on the writing is left to the browser, which moves the selection itself.

const READ_WRITING = '.article-flow[data-readonly]';
const BLOCK = '.article-flow > *';

/**
 * Clears a selection held in the read-only writing when a press lands off the writing. `within` is the page's
 * scroller: a press outside it reaches here only through a React portal (the reading selection bar, a popover) and
 * acts on the words, so it keeps them.
 */
export function releaseReadSelection(target: EventTarget | null, within?: Element | null): void {
  if (target instanceof Element && target.closest(BLOCK)) return;
  if (within && target instanceof Node && !within.contains(target)) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  // Only when a selection is held, so a plain press costs one check.
  const writings = document.querySelectorAll(READ_WRITING);
  if ([...writings].some((w) => w.contains(sel.anchorNode))) sel.removeAllRanges();
}
