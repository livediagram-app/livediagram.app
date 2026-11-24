'use client';

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { prefersReducedMotion } from '@liveworkspace/ui';

// One concept-graphic row as its own full-size layer (docs/specs/009-elements/concept-graphics.md), so its shape and
// its words animate as one; `--lvd-cg-i` is its place in reading order and the transform origin its own middle, so a
// pulse grows it about itself.
//
// A row that joins a graphic already on the canvas eases in about its own middle, and when one leaves, the rows
// that stay settle into their new places (each product's docs/specs/004-interface-design/motion.md "Rows that come
// and go": anything added or removed is animated, on the canvas too). The graphic's first paint moves nothing, and
// reduced motion skips both. Done with the Web Animations API on the row itself, so it needs no stylesheet and
// never touches the graphic's own animation classes.

const ARRIVE: Keyframe[] = [
  { opacity: 0, transform: 'scale(0.9)' },
  { opacity: 1, transform: 'scale(1)' },
];
const SETTLE: Keyframe[] = [{ opacity: 0.45 }, { opacity: 1 }];
const TIMING: KeyframeAnimationOptions = { duration: 220, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' };

// Read in the layout effect only, so never during render; no matchMedia (a test's DOM) moves nothing.
const moves = () => !!window.matchMedia && !prefersReducedMotion();

export function ConceptRowLayer({
  i,
  origin,
  children,
}: {
  i: number;
  origin: { x: number; y: number };
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // After every paint of the graphic: which rows it has now (their whole-number places), against which it had. Not
  // how many layers it draws: selecting a graphic adds layers of controls, and that is no row arriving. The
  // graphic's element keeps the list; it is written a moment later, so every row of one render reads the same
  // "before".
  useLayoutEffect(() => {
    const el = ref.current;
    const graphic = el?.parentElement;
    if (!el || !graphic) return;
    const places = [
      ...new Set(
        [...graphic.querySelectorAll<HTMLElement>(':scope > .lvd-cg-row')]
          .map((row) => Number(row.dataset.cgPlace))
          .filter((n) => Number.isInteger(n)),
      ),
    ].sort((a, b) => a - b);
    const now = places.join(',');
    const before = graphic.dataset.cgRows;
    queueMicrotask(() => {
      graphic.dataset.cgRows = now;
    });
    // The first paint (no list yet), an unchanged list, and a layer that is not a row move nothing.
    if (before === undefined || before === now || !Number.isInteger(i)) return;
    if (!moves() || typeof el.animate !== 'function') return;
    const had = new Set(before.split(',').filter(Boolean).map(Number));
    if (places.length > had.size && !had.has(i)) el.animate(ARRIVE, TIMING);
    else if (places.length < had.size) el.animate(SETTLE, TIMING);
  });
  return (
    <div
      ref={ref}
      data-cg-place={i}
      className="lvd-cg-row pointer-events-none absolute inset-0"
      style={{ '--lvd-cg-i': i, transformOrigin: `${origin.x}px ${origin.y}px` } as CSSProperties}
    >
      {children}
    </div>
  );
}
