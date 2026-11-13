'use client';

// The open popovers, in the order they opened (AnchoredPopover, ConfirmPopover): only the one on top takes a key
// (Escape closes it alone, never the popover it opened from), and a press inside a popover opened from another is
// not a press outside that other. One window listener, taken before anything else (capture), serves them all while
// any is open.
//
// Tab and Shift+Tab wrap at the top popover's ends while focus is in it. A popover is portalled to the end of the
// page, outside the dialog it opened over, so that dialog's focus trap never hears its keys: Tab past its last
// control fell to the page body, then to the editor behind the modal. Focus outside it (a field driving its list)
// is left alone.
import { useEffect, useRef, type RefObject } from 'react';
import { tabbables } from './useFocusTrap';

type Layer = {
  panel: RefObject<HTMLElement | null>;
  onKey: (e: KeyboardEvent) => void;
};

const layers: Layer[] = [];

function onKeyDown(e: KeyboardEvent): void {
  const top = layers.at(-1);
  if (!top) return;
  top.onKey(e);
  if (e.key === 'Tab' && !e.defaultPrevented) wrapTab(e, top.panel.current);
}

// Keeps Tab inside the panel holding focus: from its last control (or anything after it, a scrolling list the browser
// lets Tab stop on) to its first, and Shift+Tab from its first (or the panel itself) to its last.
function wrapTab(e: KeyboardEvent, panel: HTMLElement | null): void {
  const at = document.activeElement;
  if (!panel || !(at instanceof HTMLElement) || !panel.contains(at)) return;
  const items = tabbables(panel);
  const first = items[0];
  const last = items.at(-1);
  if (!first || !last) {
    e.preventDefault();
    return;
  }
  const afterLast =
    at !== last && (last.compareDocumentPosition(at) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  const beforeFirst =
    at === panel ||
    (at !== first && (first.compareDocumentPosition(at) & Node.DOCUMENT_POSITION_PRECEDING) !== 0);
  if (e.shiftKey ? at === first || beforeFirst : at === last || afterLast) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus({ preventScroll: true });
  }
}

function push(layer: Layer): () => void {
  if (layers.length === 0) window.addEventListener('keydown', onKeyDown, true);
  layers.push(layer);
  return () => {
    const at = layers.indexOf(layer);
    if (at >= 0) layers.splice(at, 1);
    if (layers.length === 0) window.removeEventListener('keydown', onKeyDown, true);
  };
}

// The popovers open now, for tests.
export function openPopoverCount(): number {
  return layers.length;
}

/** Joins the stack while mounted: `onKey` hears every key while this popover is the top one. Gives back whether a
 *  node sits in a popover opened above this one (a press there is not outside this one). */
export function usePopoverLayer(
  panel: RefObject<HTMLElement | null>,
  onKey: (e: KeyboardEvent) => void,
): { withinAbove: (target: EventTarget | null) => boolean } {
  const keyRef = useRef(onKey);
  useEffect(() => {
    keyRef.current = onKey;
  });
  const layerRef = useRef<Layer | null>(null);
  useEffect(() => {
    const layer: Layer = { panel, onKey: (e) => keyRef.current(e) };
    layerRef.current = layer;
    return push(layer);
  }, [panel]);
  return {
    withinAbove: (target) => {
      if (!(target instanceof Node)) return false;
      const at = layerRef.current ? layers.indexOf(layerRef.current) : -1;
      if (at < 0) return false;
      return layers.slice(at + 1).some((l) => l.panel.current?.contains(target) ?? false);
    },
  };
}
