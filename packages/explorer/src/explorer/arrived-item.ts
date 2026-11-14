'use client';

// The item an editor's door came from, marked in the place that holds it (liveworkspace/docs/specs/004-index/one-explorer.md
// "Opening from an open item"): once its row or card is drawn, it is scrolled to the middle of the list and wears the
// selected ring (`data-arrived`, explorer.css) with `aria-current`. Lists load after the page and draw only the rows on
// screen, so each list view brings the item into its window first (useRevealArrived: further pages loaded until the
// item is in the list, then the window moved to it), and the mark waits for the row with one MutationObserver, for a
// few seconds at most, then stops.
import { createContext, useContext, useEffect, useRef } from 'react';

/** How long the page waits for the item's row to be drawn before giving up: long enough for a few pages to load. */
export const ARRIVED_WAIT_MS = 15_000;
/** At most this many further pages are loaded looking for the item. */
export const ARRIVED_MAX_PAGES = 10;

/** The arrived item's id, for the list views to bring into their window. */
export const ArrivedItemContext = createContext<string | null>(null);

/** The rows and cards that can stand for item `id`: an index item's in any list or Home, or This Browser's. */
export function arrivedSelector(id: string): string {
  const v = CSS.escape(id);
  return `[data-item-row="${v}"],[data-item-card="${v}"],[data-this-browser-row="${v}"]`;
}

/** Marks item `id`'s row or card under `[data-explorer]` once it is drawn; nothing for no id. */
export function useArrivedItem(id: string | null | undefined) {
  useEffect(() => {
    if (!id) return;
    const selector = arrivedSelector(id);
    const mark = () => {
      const row = document.querySelector('[data-explorer]')?.querySelector<HTMLElement>(selector);
      if (!row) return false;
      row.setAttribute('data-arrived', '');
      row.setAttribute('aria-current', 'true');
      row.scrollIntoView?.({ block: 'center' });
      return true;
    };
    if (mark()) return;
    const observer = new MutationObserver(() => {
      if (mark()) stop();
    });
    const timer = window.setTimeout(() => stop(), ARRIVED_WAIT_MS);
    function stop() {
      observer.disconnect();
      window.clearTimeout(timer);
    }
    observer.observe(document.body, { childList: true, subtree: true });
    return stop;
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
 * A list view's part in marking the arrived item (ArrivedItemContext): while the item is not among `items` and the
 * list has more pages, the next is loaded (at most ARRIVED_MAX_PAGES); once it is, `reveal` is asked to bring the row
 * at `offset` + its index into the window, until it says it has. Nothing for no arrived item, or one already shown.
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
  // Brings row `index` into the window; true once it is drawn or on its way.
  reveal: (index: number) => boolean;
}) {
  const id = useContext(ArrivedItemContext);
  const seeking = useRef({ id: null as string | null, pages: 0, done: false });
  useEffect(() => {
    if (!id) return;
    if (seeking.current.id !== id) seeking.current = { id, pages: 0, done: false };
    const s = seeking.current;
    if (s.done) return;
    const at = items.findIndex((item) => item.id === id);
    if (at >= 0) {
      s.done = reveal(offset + at);
      return;
    }
    if (hasMore && !loadingMore && s.pages < ARRIVED_MAX_PAGES) {
      s.pages += 1;
      onLoadMore();
    }
  });
}
