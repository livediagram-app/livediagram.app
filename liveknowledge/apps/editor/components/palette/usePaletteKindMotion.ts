'use client';

// The strip's change of kind (docs/specs/007-editor/pages-mode.md "The palette's kind"): when the
// palette's kind changes (someone moves onto a page of another kind), its new categories (or an
// article's formatting) come in as a quick cascade, each rising and fading in a moment after the one
// before, so the change reads as one motion rather than a jump. The whole cascade
// settles within the chrome budget (docs/specs/004-interface-design/motion.md: 250 ms). Nothing
// moves under reduced motion, or on the first render.
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import {
  KIND_ITEM_MS,
  kindStagger,
} from '@liveworkspace/workbench/components/palette/usePaletteKindMotion';

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

// What moves: the bar's category buttons, or the docked formatting's slot as one (its controls
// arrive a render later).
const ITEMS = '[data-category-bar-button], [data-article-dock]';

export function usePaletteKindMotion(kind: string, root: RefObject<HTMLElement | null>): void {
  const seen = useRef(kind);
  useLayoutEffect(() => {
    if (seen.current === kind) return;
    seen.current = kind;
    const el = root.current;
    if (!el || prefersReducedMotion() || typeof el.animate !== 'function') return;
    const items = [...el.querySelectorAll<HTMLElement>(ITEMS)];
    const step = kindStagger(items.length);
    items.forEach((item, i) =>
      item.animate(
        [
          { opacity: 0, transform: 'translateY(6px) scale(0.96)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: KIND_ITEM_MS, delay: i * step, easing: EASE, fill: 'backwards' },
      ),
    );
  }, [kind, root]);
}
