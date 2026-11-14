'use client';

// The item an editor's door came from, marked in the place that holds it (liveworkspace/docs/specs/004-index/one-explorer.md
// "Opening from an open item"): its row or card is scrolled to the middle of the list and wears the selected ring
// (`data-arrived`, explorer.css) with `aria-current`. Lists load after the page and draw only the rows on screen, and
// a card grid's window can draw every card before it measures and then drop most of them, so nothing here trusts one
// look: while the arrival settles (until the person scrolls, presses or types, or ARRIVED_WAIT_MS passes) each list
// view brings the item back into its window whenever a render leaves it out (useRevealArrived), and the mark is put on
// every row or card of it that is drawn, each scrolled to the middle (useArrivedItem). Once settled, the ring stays on
// whatever is drawn and nothing moves the page.
import { createContext, useContext, useEffect, useRef } from 'react';

/** How long an arrival settles: long enough for a few pages to load. */
export const ARRIVED_WAIT_MS = 15_000;
/** At most this many further pages are loaded looking for the item. */
export const ARRIVED_MAX_PAGES = 10;
/** At most this many times a view acts to bring the item into its window. */
export const ARRIVED_MAX_REVEALS = 12;
// The person taking over: any of these ends the settling.
const TAKE_OVER = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

/** The arrived item's id, for the list views to bring into their window. */
export const ArrivedItemContext = createContext<string | null>(null);

/** The rows and cards that can stand for item `id`: an index item's in any list or Home, or This Browser's. */
export function arrivedSelector(id: string): string {
  const v = CSS.escape(id);
  return `[data-item-row="${v}"],[data-item-card="${v}"],[data-this-browser-row="${v}"]`;
}

/** Calls `settle` once the arrival has settled: the person scrolls, presses or types, or ARRIVED_WAIT_MS passes.
 *  Returns the cleanup. */
function watchSettling(settle: () => void): () => void {
  const done = () => {
    stop();
    settle();
  };
  const timer = window.setTimeout(done, ARRIVED_WAIT_MS);
  for (const type of TAKE_OVER)
    window.addEventListener(type, done, { capture: true, passive: true });
  function stop() {
    window.clearTimeout(timer);
    for (const type of TAKE_OVER) window.removeEventListener(type, done, { capture: true });
  }
  return stop;
}

/** Marks every drawn row or card of item `id` under `[data-explorer]`, for as long as the place shows, scrolling each to
 *  the middle while the arrival settles; nothing for no id. */
export function useArrivedItem(id: string | null | undefined) {
  useEffect(() => {
    if (!id) return;
    const selector = arrivedSelector(id);
    let settling = true;
    const mark = () => {
      const row = document
        .querySelector('[data-explorer]')
        ?.querySelector<HTMLElement>(`:is(${selector}):not([data-arrived])`);
      if (!row) return;
      row.setAttribute('data-arrived', '');
      row.setAttribute('aria-current', 'true');
      if (settling) row.scrollIntoView?.({ block: 'center' });
    };
    mark();
    // One attribute query per batch of changes, only while the place shows (the host drops the id as the view changes).
    const observer = new MutationObserver(mark);
    observer.observe(document.body, { childList: true, subtree: true });
    const stopSettling = watchSettling(() => {
      settling = false;
    });
    return () => {
      observer.disconnect();
      stopSettling();
    };
  }, [id]);
}

/** Scrolls whatever holds `container` (a positioned element) so the box `top` px down it, `height` tall, is in the
 *  middle of the screen: where a windowed list's undrawn row will be, so the list draws it. */
export function revealAt(container: HTMLElement, top: number, height: number) {
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = `position:absolute;left:0;top:${top}px;width:1px;height:${height}px;pointer-events:none`;
  container.append(probe);
  probe.scrollIntoView?.({ block: 'center' });
  probe.remove();
}

/**
 * A list view's part in marking the arrived item (ArrivedItemContext). While the arrival settles, after every render:
 * when the item's row or card is in the page, nothing; when the item is not among `items` and the list has more pages,
 * the next is loaded (at most ARRIVED_MAX_PAGES); when it is among them but not drawn, `reveal` is asked to bring the
 * row at `offset` + its index into the window (acting at most ARRIVED_MAX_REVEALS times). The page itself is the
 * judge, never the view's window: one not yet measured can draw a card it then leaves out. Nothing for no item.
 */
export function useRevealArrived({
  items,
  offset,
  hasMore,
  loadingMore,
  onLoadMore,
  reveal,
}: {
  items: readonly { id: string }[];
  // Rows drawn before the items (the folders).
  offset: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  // Brings row `index` into the window if it can yet: true when it acted (revealed a batch, or scrolled).
  reveal: (index: number) => boolean;
}) {
  const id = useContext(ArrivedItemContext);
  const seeking = useRef({ pages: 0, reveals: 0, settled: true });
  useEffect(() => {
    seeking.current = { pages: 0, reveals: 0, settled: !id };
    if (!id) return;
    return watchSettling(() => {
      seeking.current.settled = true;
    });
  }, [id]);
  useEffect(() => {
    const s = seeking.current;
    if (!id || s.settled || document.querySelector(arrivedSelector(id))) return;
    const at = items.findIndex((item) => item.id === id);
    if (at >= 0) {
      if (s.reveals < ARRIVED_MAX_REVEALS && reveal(offset + at)) s.reveals += 1;
      return;
    }
    if (hasMore && !loadingMore && s.pages < ARRIVED_MAX_PAGES) {
      s.pages += 1;
      onLoadMore();
    }
  });
}
