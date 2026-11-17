'use client';

import { useLayoutEffect } from 'react';

// Where focus starts as the Share dialog opens: its first real control, the selected tab when it has tabs, else the
// pass level picker, never the header's Show Me or Help (liveworkspace/docs/specs/004-index/dialog-hero-header.md
// "Focus starts in the body").
// Focus on either of those opened its hover card over the tabs as the dialog appeared (Work Tracker 1166).
export const SHARE_START = '[role="tab"][aria-selected="true"], [data-share-start] button';

// Runs once, as the dialog mounts: a layout effect, so it lands before the dialog's focus trap places focus (the
// trap keeps a control that already holds it) and before the first paint, so nothing flashes on the header.
export function useShareStartFocus(titleId: string): void {
  useLayoutEffect(() => {
    const panel = document.getElementById(titleId)?.closest<HTMLElement>('[aria-modal="true"]');
    panel?.querySelector<HTMLElement>(SHARE_START)?.focus({ preventScroll: true });
    // Once, on open (`titleId` never changes): a tab appearing later (the Approval door answering) never takes focus
    // from where it is.
  }, [titleId]);
}
