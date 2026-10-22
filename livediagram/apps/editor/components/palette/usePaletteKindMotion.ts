'use client';

// The strip's change of kind: when the
// palette's kind changes (a change of editor mode), its new categories come in as a quick cascade, each rising and fading in a moment after the one
// before, so the change reads as one motion rather than a jump. The whole cascade
// settles within the chrome budget (docs/specs/004-interface-design/motion.md: 250 ms). Nothing
// moves under reduced motion, or on the first render.
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { prefersReducedMotion } from '@/lib/motion-preference';

// Each item's own rise, and the cascade's whole length (the last item's start plus its rise).
export const KIND_ITEM_MS = 160;
export const KIND_CASCADE_MS = 250;
// The most one item waits after the one before.
const KIND_STAGGER_MAX_MS = 24;
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

// What moves: the bar's category buttons.
const ITEMS = '[data-category-bar-button]';

/** The stagger between items so `count` of them finish within the cascade. */
export function kindStagger(count: number): number {
  if (count <= 1) return 0;
  return Math.min(KIND_STAGGER_MAX_MS, (KIND_CASCADE_MS - KIND_ITEM_MS) / (count - 1));
}

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
