'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';
import { editorViewportOf } from '../../lib/editor-viewport';
import { STRIP_MENU_GAP_PX, stripRoomBesideMenu } from '../canvas/menu-join';

// Whether the centred strip would run under the top-left menu card (docs/specs/007-editor/toolbar-layout.md "The
// category bar"): the strip as drawn is wider than the room centring leaves it, the editor's width less the menu
// card on both sides. The category bar drops its names to fit and can drop nothing more, so on a tablet (768px) its
// glyphs alone still ran 13px under the card, cutting the tab's name. Crowded, the strip sits at the right instead,
// clear of the card. Measured from the real sizes, as useBarLabels and useStripTileLimit are.

export function useStripCrowded(cardRef: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  return useStripCrowding(cardRef, enabled).crowded;
}

/** The crowding, and where a crowded strip must start to clear the menu card: `clear` is the card's right edge
 *  plus the strip's gap, in screen px from the editor's left (0 with no card). A strip that can give way (an
 *  article's docked formatting, whose controls scroll) starts there rather than running under the card. */
export function useStripCrowding(
  cardRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): { crowded: boolean; clear: number } {
  const [state, setState] = useState({ crowded: false, clear: 0 });
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!enabled || !card || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const width = card.getBoundingClientRect().width;
      if (width <= 0) return;
      const view = editorViewportOf(card);
      const menu = document.querySelector<HTMLElement>('[data-toolbar-menu]');
      const crowded = width > stripRoomBesideMenu(view.width, view.left, menu);
      const clear = menu
        ? Math.max(0, Math.ceil(menu.getBoundingClientRect().right - view.left + STRIP_MENU_GAP_PX))
        : 0;
      setState((s) => (s.crowded === crowded && s.clear === clear ? s : { crowded, clear }));
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
  return enabled ? state : { crowded: false, clear: 0 };
}
