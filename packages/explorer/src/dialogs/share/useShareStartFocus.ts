'use client';

import { useLayoutEffect, useRef } from 'react';

// Where focus starts as the Share dialog opens: its first real control, the selected tab when it has tabs, else the
// pass level picker, never the header's Show Me or Help (liveworkspace/docs/specs/004-index/dialog-hero-header.md
// "Focus starts in the body").
// Focus on either of those opened its hover card over the tabs as the dialog appeared (Work Tracker 1166).
export const SHARE_START = '[role="tab"][aria-selected="true"], [data-share-start] button';

// Runs as the dialog mounts: a layout effect, so it lands before the dialog's focus trap places focus (the trap keeps
// a control that already holds it) and before the first paint, so nothing flashes on the header. Runs again when the
// tab strip comes or goes (`tabbed`), but only to pick up focus that fell out with it: the Approval tab shows while
// the door is asked and goes when it answers no, taking the focused Passes tab with it (seen in livediagram), and
// focus would land on the panel. A tab appearing later never takes focus from where it is.
export function useShareStartFocus(titleId: string, tabbed: boolean): void {
  const placed = useRef(false);
  useLayoutEffect(() => {
    const panel = document.getElementById(titleId)?.closest<HTMLElement>('[aria-modal="true"]');
    if (!panel) return;
    const now = document.activeElement;
    if (placed.current && now !== null && now !== document.body && now !== panel) return;
    placed.current = true;
    panel.querySelector<HTMLElement>(SHARE_START)?.focus({ preventScroll: true });
  }, [titleId, tabbed]);
}
