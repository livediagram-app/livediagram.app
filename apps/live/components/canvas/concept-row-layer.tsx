import type { CSSProperties, ReactNode } from 'react';

// One concept-graphic row as its own full-size layer (docs/specs/009-elements/concept-graphics.md), so its shape and
// its words animate as one; `--lvd-cg-i` is its place in reading order and the transform origin its own middle, so a
// pulse grows it about itself.
export function ConceptRowLayer({
  i,
  origin,
  children,
}: {
  i: number;
  origin: { x: number; y: number };
  children: ReactNode;
}) {
  return (
    <div
      className="lvd-cg-row pointer-events-none absolute inset-0"
      style={{ '--lvd-cg-i': i, transformOrigin: `${origin.x}px ${origin.y}px` } as CSSProperties}
    >
      {children}
    </div>
  );
}
