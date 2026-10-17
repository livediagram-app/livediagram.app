'use client';

import { useLayoutEffect } from 'react';

// Explorer: Midnight (docs/specs/004-interface-design/color-scheme.md "Explorer: Midnight"). While the Explorer is
// mounted the document root carries `data-palette="midnight"`, which dark mode reads as the navy ground and sky
// accent; menus and dialogs portalled to the body follow it. Set before the first paint, removed on unmount, so the
// editor and every other page keep Steel.

export const EXPLORER_PALETTE = 'midnight';

export function useMidnightPalette(): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.palette = EXPLORER_PALETTE;
    return () => {
      if (root.dataset.palette === EXPLORER_PALETTE) delete root.dataset.palette;
    };
  }, []);
}
