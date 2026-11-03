'use client';

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { editorViewportOf } from '../../lib/editor-viewport';
import { stripRoomBesideMenu } from '../canvas/menu-join';

// How many of the category bar's categories the strip shows, the rest behind its More button
// (docs/specs/007-editor/toolbar-layout.md "The strip's room"). The bar drops its names first (useBarLabels); a
// strip still wider than its room (a narrow window beside Pages mode's docked Contents, whose sidebar takes the
// strip's left) then shows its first categories alone and folds the rest into More, rather than running under the
// menu box. Measured from the strip's REAL sizes, as useBarLabels and useStripTileLimit are: the whole bar is drawn
// once, glyphs alone, and where each button ends is kept; how many fit then follows from the room alone, so folding
// never changes what it was measured from.

/** The strip as measured with every category shown: where each category button ends, from the card's left, and the
 *  card past the last one (Search, its divider, the padding), in screen px. */
export type BarMeasure = { ends: readonly number[]; trailing: number; button: number };

/** How many categories show in `room` px: every one while the whole strip fits, else as many as fit with More (a
 *  button as wide as a category's) after them. Null shows every category. */
export function barFold({ ends, trailing, button }: BarMeasure, room: number): number | null {
  const count = ends.length;
  if (count === 0 || ends[count - 1]! + trailing <= room) return null;
  let shown = count - 1;
  while (shown > 0 && ends[shown - 1]! + button + trailing > room) shown -= 1;
  return shown;
}

/** The categories the strip shows (null: all of them). `cardRef` is the strip's card; its category buttons carry
 *  `data-category-bar-button`, More `data-category-bar-more`. */
export function useBarFold(
  cardRef: RefObject<HTMLElement | null>,
  {
    enabled,
    categoriesKey,
    scale,
  }: {
    // Off on a phone (its bar swipes), while the bar names its categories (they fit), and where the strip is not a
    // category bar.
    enabled: boolean;
    // The bar's categories: another set (another mode) is measured afresh.
    categoriesKey: string;
    scale: number;
  },
): number | null {
  const [shown, setShown] = useState<number | null>(null);
  // The whole bar's measure, for the categories and UI scale it was taken with.
  const whole = useRef<{ key: string; measure: BarMeasure } | null>(null);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!enabled || !card || typeof ResizeObserver === 'undefined') return;
    const key = `${categoriesKey}@${scale}`;
    const measure = () => {
      const box = card.getBoundingClientRect();
      if (box.width <= 0) return;
      if (shown === null) {
        const buttons = [
          ...card.querySelectorAll<HTMLElement>(
            '[data-category-bar-button]:not([data-category-bar-more])',
          ),
        ];
        const last = buttons.at(-1);
        if (!last) return;
        const rects = buttons.map((b) => b.getBoundingClientRect());
        whole.current = {
          key,
          measure: {
            ends: rects.map((r) => r.right - box.left),
            trailing: box.right - last.getBoundingClientRect().right,
            button: Math.min(...rects.map((r) => r.width)),
          },
        };
      } else if (whole.current?.key !== key) {
        // Measured with other categories or at another scale: show them all once to measure them.
        whole.current = null;
        setShown(null);
        return;
      }
      if (!whole.current) return;
      const view = editorViewportOf(card);
      const menu = document.querySelector<HTMLElement>('[data-toolbar-menu]');
      const next = barFold(whole.current.measure, stripRoomBesideMenu(view.width, view.left, menu));
      if (next !== shown) setShown(next);
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
  }, [cardRef, enabled, categoriesKey, scale, shown]);

  return enabled ? shown : null;
}
