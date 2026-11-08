import type { CSSProperties } from 'react';

// A livehuddle character: the pixel figure everyone walks round a Space as, its shirt in their presence colour, with
// the name chip under its feet as livehuddle draws it. Decorative. The figure is a 10 × 15 grid of squares drawn with
// crisp edges, so it stays a pixel figure at any size; `className` places and sizes the whole (the width sets the
// figure's size, the chip keeps its own).

export type CharacterLook = {
  shirt: string;
  hair: string;
  skin: string;
  legs?: string;
  // Long hair falls to the shoulders.
  long?: boolean;
};

// Each run of squares as [x, y, width, height] on the 10 × 15 grid.
type Run = readonly [number, number, number, number];
const HAIR: Run[] = [
  [3, 0, 4, 1],
  [2, 1, 6, 1],
  [2, 2, 1, 1],
  [7, 2, 1, 1],
];
const LONG_HAIR: Run[] = [
  [1, 2, 1, 4],
  [8, 2, 1, 4],
];
const SKIN: Run[] = [
  [3, 2, 4, 1],
  [2, 3, 6, 3],
  [1, 10, 1, 1],
  [8, 10, 1, 1],
];
const EYES: Run[] = [
  [3, 3, 1, 1],
  [6, 3, 1, 1],
];
const SHIRT: Run[] = [
  [2, 6, 6, 5],
  [1, 6, 1, 4],
  [8, 6, 1, 4],
];
const LEGS: Run[] = [
  [2, 11, 6, 1],
  [2, 12, 3, 2],
  [5, 12, 3, 2],
];
const SHOES: Run[] = [
  [2, 14, 3, 1],
  [5, 14, 3, 1],
];

// One path per colour, not a rect per run, so a character stays a handful of nodes in the page.
function Runs({ runs, fill }: { runs: Run[]; fill: string }) {
  return (
    <path d={runs.map(([x, y, w, h]) => `M${x} ${y}h${w}v${h}h-${w}z`).join('')} fill={fill} />
  );
}

export function Character({
  name,
  look,
  talking = false,
  className = '',
  style,
}: {
  name?: string;
  look: CharacterLook;
  // Talking: the level bars over the head, in the speaker's colour.
  talking?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none flex flex-col items-center ${className}`}
      style={style}
    >
      {talking ? (
        <svg
          viewBox="0 0 10 4"
          className="absolute bottom-full mb-1 w-1/2"
          shapeRendering="crispEdges"
        >
          <rect x="1" y="2" width="2" height="2" fill={look.shirt} />
          <rect x="4" y="0" width="2" height="4" fill={look.shirt} />
          <rect x="7" y="1" width="2" height="3" fill={look.shirt} />
        </svg>
      ) : null}
      <svg viewBox="0 0 10 15" className="w-full" shapeRendering="crispEdges">
        <Runs runs={look.long ? [...HAIR, ...LONG_HAIR] : HAIR} fill={look.hair} />
        <Runs runs={SKIN} fill={look.skin} />
        <Runs runs={EYES} fill="#1e293b" />
        <Runs runs={SHIRT} fill={look.shirt} />
        <Runs runs={LEGS} fill={look.legs ?? '#334155'} />
        <Runs runs={SHOES} fill="#0f172a" />
      </svg>
      {name ? (
        <span className="mt-0.5 flex items-center gap-1 rounded-full bg-white px-1.5 py-px text-[9px] leading-tight font-semibold whitespace-nowrap text-slate-700 shadow-sm ring-1 ring-slate-200 sm:text-[10px] dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: look.shirt }} />
          {name}
        </span>
      ) : null}
    </span>
  );
}
