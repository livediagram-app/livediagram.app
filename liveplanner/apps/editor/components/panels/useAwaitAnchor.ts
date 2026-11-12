import { useEffect } from 'react';

// A popover opened before its anchor is drawn (an Inbox link to a Sheet cell's thread lands as the tab loads, and the
// cell's anchor appears only once the Sheet has drawn and scrolled it into view, docs/specs/029-sheets/sheet.md "Cell
// comments"): `measure` runs once the anchor appears, so the popover is placed rather than left waiting for a scroll or
// a resize. Watches only while `waiting` (the popover has no place yet), and stops at the first match.
export function useAwaitAnchor(selector: string, waiting: boolean, measure: () => void): void {
  useEffect(() => {
    if (!waiting || typeof MutationObserver === 'undefined') return;
    if (document.querySelector(selector)) {
      measure();
      return;
    }
    const watch = new MutationObserver(() => {
      if (!document.querySelector(selector)) return;
      watch.disconnect();
      measure();
    });
    watch.observe(document.body, { childList: true, subtree: true, attributes: true });
    return () => watch.disconnect();
  }, [selector, waiting, measure]);
}
