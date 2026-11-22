import type { ReactNode } from 'react';

// An isometric cube for the site's drawings (the hero, the import art), in a 2:1 isometric: a step along the
// right edge is (+2, +1), along the left edge (-2, +1), and up is (0, -1). Flat fills, one class per face.
export type Shades = { top: string; left: string; right: string };

// The brand's three limes: the ramp's 300 on top, between its 500 and 600 at the left, its 700 at the right.
export const LIME: Shades = {
  top: 'fill-brand-300',
  left: 'fill-[#65a30d]',
  right: 'fill-brand-700',
};

// A cube standing on (cx, cy), the centre of its base: its left, right and top faces, then anything drawn on them.
export function Cube({
  cx,
  cy,
  half,
  height,
  shades,
  children,
}: {
  cx: number;
  cy: number;
  // Half the width on screen; the base's diamond is `half` wide each way and `half / 2` tall each way.
  half: number;
  height: number;
  shades: Shades;
  children?: ReactNode;
}) {
  const rise = half / 2;
  const top = cy - height;
  return (
    <>
      <polygon
        className={shades.left}
        points={`${cx - half},${top} ${cx},${top + rise} ${cx},${cy + rise} ${cx - half},${cy}`}
      />
      <polygon
        className={shades.right}
        points={`${cx},${top + rise} ${cx + half},${top} ${cx + half},${cy} ${cx},${cy + rise}`}
      />
      <polygon
        className={shades.top}
        points={`${cx},${top - rise} ${cx + half},${top} ${cx},${top + rise} ${cx - half},${top}`}
      />
      {children}
    </>
  );
}
