'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';
import { editorViewportOf } from '../../lib/editor-viewport';
import {
  cornerCardClear,
  stripRoomBesideMenu,
  CORNER_CARD_EVENT,
  stripShiftsLeft,
  stripSitsBetween,
  stripLeftClear,
} from '../canvas/menu-join';

// Whether the centred strip would run under the top-left menu card (docs/specs/007-editor/toolbar-layout.md "The
// category bar"): the strip as drawn is wider than the room centring leaves it, the editor's width less the menu
// card on both sides. The category bar drops its names to fit and can drop nothing more, so on a tablet (768px) its
// glyphs alone still ran 13px under the card, cutting the tab's name. Crowded, the strip sits at the right instead,
// clear of the card. Measured from the real sizes, as useBarLabels and useStripTileLimit are.

export function useStripCrowded(cardRef: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  return useStripCrowding(cardRef, enabled).crowded;
}

/** A crowded strip's right padding, in its surface px: 12px from the editor's edge, or clear of the top-right corner
 *  card where there is one. */
export function crowdedPaddingRight(clearRight: number, scale: number): string | number {
  return clearRight > 0 ? clearRight / scale : '0.75rem';
}

/** The crowding, and where a crowded strip must start to clear the menu card: `clear` is the card's right edge
 *  plus the strip's gap, in screen px from the editor's left (0 with no card). A strip that can give way (an
 *  article's docked formatting, whose controls scroll) starts there rather than running under the card. */
export function useStripCrowding(
  cardRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): { crowded: boolean; shifted: boolean; clear: number; clearRight: number } {
  const [state, setState] = useState({ crowded: false, shifted: false, clear: 0, clearRight: 0 });
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!enabled || !card || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const width = card.getBoundingClientRect().width;
      if (width <= 0) return;
      const view = editorViewportOf(card);
      const menu = document.querySelector<HTMLElement>('[data-toolbar-menu]');
      // A strip that may shift left is crowded only when even the room beside the menu box is too small; short of
      // that it is `shifted`, standing at the left beside the box. Whether it centres goes by its width with its
      // names (useBarLabels keeps it on the card), so a window narrowing past the point it moved aside never brings
      // it back to the centre once its names drop.
      const shifts = stripShiftsLeft(card);
      const natural = shifts ? Number(card.dataset.stripNaturalWidth) || 0 : 0;
      const centred = Math.max(width, natural) <= stripRoomBesideMenu(view.width, view.left, menu);
      const crowded =
        shifts || stripSitsBetween(card)
          ? width > stripRoomBesideMenu(view.width, view.left, menu, true)
          : !centred;
      const shifted = shifts && !centred && !crowded;
      const clear = stripLeftClear(menu, view.left);
      // Where a crowded strip, set at the right, must end: short of the top-right corner card (EditorCornerActions).
      const clearRight = Math.ceil(cornerCardClear(view.width, view.left));
      setState((s) =>
        s.crowded === crowded &&
        s.shifted === shifted &&
        s.clear === clear &&
        s.clearRight === clearRight
          ? s
          : { crowded, shifted, clear, clearRight },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    const menu = document.querySelector<HTMLElement>('[data-toolbar-menu]');
    if (menu) observer.observe(menu);
    // The top-right corner card (EditorCornerActions) bounds the strip too; it says when it mounts or resizes.
    window.addEventListener(CORNER_CARD_EVENT, measure);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener(CORNER_CARD_EVENT, measure);
    };
  }, [cardRef, enabled]);
  return enabled ? state : { crowded: false, shifted: false, clear: 0, clearRight: 0 };
}
