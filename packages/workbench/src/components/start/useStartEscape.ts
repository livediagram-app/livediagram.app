'use client';

// Escape on a start panel that can close (start-diagramming.md "Search" in each product): the panel's own keydown
// handles a focus inside it; this takes the rest. A press on the panel's background, a rail row in a browser that
// does not focus buttons on a click, or the canvas focused just as the panel opened, leave the focus on the page or
// the canvas, outside the panel, and Escape there went to the canvas (which clears a selection) instead; so did a
// focus left on the tab bar's Add Tab. While the panel shows, such an Escape closes it, ahead of the canvas's
// listeners (a capture on the window); a focus that something else holds (a dialog, a menu, a field elsewhere) keeps
// its Escape.
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { focusIsFree } from '../../lib/focus-is-free';

// The tab bar's own buttons (Add Tab just pressed, a tab chosen) hold the focus as a new tab's start opens, and
// Escape there means nothing else; its fields (a tab's rename) and menus keep theirs.
function onTabBar(): boolean {
  const active = document.activeElement;
  if (!active?.closest('[data-editor-tabbar]')) return false;
  if (active.closest('[role="menu"], [role="dialog"]')) return false;
  return !(
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    (active as HTMLElement).isContentEditable
  );
}

export function useStartEscape(
  panel: RefObject<HTMLElement | null>,
  // Undefined while the panel cannot close, or has stepped aside: then Escape is left alone.
  onClose: (() => void) | undefined,
): void {
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  });
  const closable = onClose !== undefined;
  useEffect(() => {
    if (!closable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
      const box = panel.current;
      // Inside the panel its own handler decides (the search clears first, the mode menu closes first).
      if (!box || (e.target instanceof Node && box.contains(e.target))) return;
      if (!focusIsFree() && !onTabBar()) return;
      e.preventDefault();
      e.stopPropagation();
      close.current?.();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [closable, panel]);
}
