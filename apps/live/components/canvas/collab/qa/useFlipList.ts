// FLIP reordering for the Q&A board's queue (docs/specs/012-collaboration/qa-board.md): when a vote changes
// the ranking, each row slides from where it was to where it now is, and a row
// that climbed gets one soft glow.
//
// Measured with `offsetTop`, not getBoundingClientRect: the board sits inside
// the canvas zoom AND the Collaborate card's own scale (CollabScale), and
// offsetTop is layout units, untouched by either transform. So the delta is
// already in the units the translate is applied in.

import { useEffectEvent, useLayoutEffect, useRef } from 'react';

function motionReduced(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true ||
    document.documentElement.classList.contains('reduce-motion')
  );
}

// `order` is the list's ids in display order; the effect re-runs only when it
// changes. Rows register with `rowRef(id)`.
export function useFlipList(order: string[]) {
  const nodes = useRef(new Map<string, HTMLElement>());
  const last = useRef(new Map<string, number>());
  const key = order.join('|');

  // Keyed on `key`, which stands in for `order` (a fresh array every render):
  // the flip itself is an effect event reading the order as it is now.
  const flip = useEffectEvent(() => {
    const before = last.current;
    const after = new Map<string, number>();
    const reduce = motionReduced();
    for (const id of order) {
      const node = nodes.current.get(id);
      if (!node) continue;
      const top = node.offsetTop;
      after.set(id, top);
      const was = before.get(id);
      if (reduce || was === undefined || was === top) continue;
      const delta = was - top;
      // Invert: put it back where it was, with no transition...
      node.style.transition = 'none';
      node.style.transform = `translateY(${delta}px)`;
      // ...force the browser to take that as the starting frame...
      void node.offsetHeight;
      // ...then play: let it slide home, on .qa-flip-move in qa-board.css.
      node.style.transition = '';
      node.classList.add('qa-flip-move');
      node.style.transform = '';
      if (delta > 0) {
        node.classList.remove('qa-climb');
        void node.offsetWidth;
        node.classList.add('qa-climb');
      }
    }
    last.current = after;
  });
  useLayoutEffect(() => flip(), [key]);

  return (id: string) => (node: HTMLElement | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  };
}
