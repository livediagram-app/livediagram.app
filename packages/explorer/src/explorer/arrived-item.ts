'use client';

// The item an editor's door came from, marked in the place that holds it (liveworkspace/docs/specs/004-index/one-explorer.md
// "Opening from an open item"): once its row or card is drawn, it is scrolled to the middle of the list and wears the
// selected ring (`data-arrived`, explorer.css) with `aria-current`. Lists load after the page, so it waits for the row
// with one MutationObserver, for a few seconds at most (the first page of a long list may not hold it), then stops.
import { useEffect } from 'react';

/** How long the page waits for the item's row to be drawn before giving up. */
export const ARRIVED_WAIT_MS = 5000;

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
