'use client';

// Keeps an empty element at the end of the page's body while an editor is up (each editor's
// docs/specs/008-canvas/canvas-performance.md "Nothing shown over the page restyles the editor"). Anything shown
// over the page is added to the end of the body (a tooltip, a menu, a toast, a dragged card's copy): without the
// anchor it takes `:last-child` from the editor's own root, and Safari then restyles the whole editor as it comes
// and as it goes (about 0.35 s each way on a design of 2,000 boxes and 1,999 arrows, over a second on a 2,000-card
// board). After the anchor, only the anchor changes places.
import { useEffect } from 'react';

export const BODY_END_ATTR = 'data-body-end';

export function useBodyEndAnchor(): void {
  useEffect(() => {
    const anchor = document.createElement('div');
    anchor.setAttribute(BODY_END_ATTR, '');
    anchor.setAttribute('aria-hidden', 'true');
    anchor.hidden = true;
    document.body.appendChild(anchor);
    return () => anchor.remove();
  }, []);
}
