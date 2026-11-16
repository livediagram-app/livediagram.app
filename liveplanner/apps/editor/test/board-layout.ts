// A stand-in for the layout jsdom does not do, so a perf test of a busy board draws what a browser would: the runs
// near the view, and a placeholder for each far run (docs/specs/026-plan/plan-board.md "Cards out of view wait").
// jsdom reports every box as zero-sized, so without it every run counts as near and every card is drawn; a test of
// 5,000 cards then pays for 5,000 faces a browser never builds (Work Tracker 987, 988). Not a test itself: the
// perf tests call `stubBoardLayout()` in `beforeEach` and `vi.unstubAllGlobals(); vi.restoreAllMocks()` after each.
import { vi } from 'vitest';

const box = (top: number, height: number) =>
  ({ top, bottom: top + height, left: 0, right: 300, width: 300, height, x: 0, y: top }) as DOMRect;

/** The height each run is laid out at, and so how many runs sit inside the body's view. */
export const RUN_HEIGHT = 400;
/** The body's view, the 800 px a browser window's board fills. */
export const VIEW_HEIGHT = 800;

/** A browser's IntersectionObserver that never reports (the board's own first pass decides what is near), and runs
 *  laid one under another in their cell by their place in it: the first few of each cell sit in the body's 800 px
 *  view, and a run drawn again after a change sits where the run it replaces did. */
export function stubBoardLayout(): void {
  class QuietIO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('IntersectionObserver', QuietIO);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (!this.hasAttribute('data-plan-run')) return box(0, VIEW_HEIGHT);
    let place = 0;
    for (let s = this.previousElementSibling; s; s = s.previousElementSibling)
      if (s.hasAttribute('data-plan-run')) place++;
    return box(place * RUN_HEIGHT, RUN_HEIGHT);
  });
}
