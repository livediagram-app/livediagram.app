'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';
import { editorViewportOf } from '@/lib/editor-viewport';

// Whether the centred strip would run under the top-left menu card (docs/specs/007-editor/toolbar-layout.md "The
// category bar"): the strip as drawn is wider than the room centring leaves it, the editor's width less the menu
// card on both sides. The category bar drops its names to fit and can drop nothing more, so on a tablet (768px) its
// glyphs alone still ran 13px under the card, cutting the tab's name. Crowded, the strip sits at the right instead,
// clear of the card. Measured from the real sizes, as useBarLabels is.

const MENU_GAP_PX = 8;

export function useStripCrowded(cardRef: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const [crowded, setCrowded] = useState(false);
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!enabled || !card || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const width = card.getBoundingClientRect().width;
      if (width <= 0) return;
      const view = editorViewportOf(card);
      const menu = document.querySelector<HTMLElement>('[data-toolbar-menu]');
      const clear = menu ? menu.getBoundingClientRect().right - view.left + MENU_GAP_PX : 0;
      setCrowded(width > view.width - 2 * clear);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    const menu = document.querySelector<HTMLElement>('[data-toolbar-menu]');
    if (menu) observer.observe(menu);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [cardRef, enabled]);
  return enabled && crowded;
}
