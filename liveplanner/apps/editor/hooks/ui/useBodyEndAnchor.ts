'use client';

// Keeps an empty element at the end of the page's body while the editor is up (docs/specs/026-plan/blueprints/
// plan-board.md "Body end anchor"). Anything shown over the page is added to the end of the body (a dragged card's
// copy, a menu, a tooltip): without the anchor it takes `:last-child` from the editor's own root, and Safari then
// restyles the whole editor, over a second each time on a 2,000-card board, as it comes and as it goes. After the
// anchor, only the anchor changes places.
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
