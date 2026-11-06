'use client';

import { useRef, type ReactNode } from 'react';
import { useLoopPhase } from '@livehuddle/ui';
import { figure, FIGURES, type Pose, type Who } from './space-figures';
import {
  DOOR,
  HINGE,
  LEAF,
  LOOP_MS,
  PATHS,
  ROOM,
  SCENE_CSS,
  SEATS,
  WALLS,
} from './space-build-scene';

// livehuddle's loading picture (docs/specs/007-editor/new-document-route.md "The opening screen", blueprint:
// docs/specs/007-editor/blueprints/opening-screen.md): a Space coming to life. A room draws wall by wall, is
// furnished, its door swings open and two characters walk in and sit down at the table to talk. Drawn in the house
// art: the canvas's room and furniture pieces (the marketing hero's shapes, fills and line weights, on the theme's
// tokens) and the Avatar's pixel character (space-figures.ts).
//
// Pure SVG and CSS keyframes (space-build-scene.ts), transform and opacity only. The base styles are a calm still
// frame (both seated, talking at rest) for reduced motion; the loop only runs when motion is allowed. The picture
// never changes, so it is built once at module load and every render reuses it. A bare illustration with no
// surface of its own.

// One sprite pixel in canvas units: the 56-unit character over its 24-row grid (packages/avatar walk.ts).
const PX = 2.5;
// Where the feet sit in the sprite box: the bottom of the shoe row.
const FEET = 23 * PX;
// How far a sitter settles below where it walked in, so the table top hides its folded legs.
const SINK = 4;
// The top of a seated head above its seat's feet point: the sprite drops five rows to sit.
const SEATED_TOP = -FEET + 5 * PX + SINK;

// A figure in one pose, placed by its feet: a path per colour on the sprite grid, crisp-edged.
const sprite = (who: Who, pose: Pose, mid?: boolean) => (
  <g transform={`translate(${-8 * PX} ${-FEET}) scale(${PX})`} shapeRendering="crispEdges">
    {pose === 'seated' ? null : (
      <ellipse cx={8} cy={23} rx={5} ry={1.2} fill="rgb(15 23 42 / 0.28)" />
    )}
    {figure(who, pose, mid).map(([c, d]) => (
      <path key={c} d={d} fill={c} />
    ))}
  </g>
);

// A peer's name chip over the head, in its colour, as on the canvas. Your own character has none.
const nameChip = (y: number) => (
  <g transform={`translate(0 ${y})`}>
    <rect x={-17} y={-15} width={34} height={15} rx={4} fill={FIGURES.sam.shirt} />
    <text x={0} y={-4.5} textAnchor="middle" fontSize={10} fontWeight={600} fill="#fff">
      Sam
    </text>
  </g>
);

// A walker: one group per facing, each holding the two stride frames that swap while it walks.
const walker = (who: Who) => {
  const [x, y] = PATHS[who][0]!;
  return (
    <g className={`lhs-walk lhs-${who}-walk`}>
      <g className={`lhs-${who}-move`} style={{ transform: `translate(${x}px, ${y}px)` }}>
        {(['up', 'left', 'right'] as const).map((pose) => (
          <g key={pose} className={`lhs-${who}-${pose}`}>
            <g className="lhs-f0">{sprite(who, pose, false)}</g>
            <g className="lhs-f1">{sprite(who, pose, true)}</g>
          </g>
        ))}
        {who === 'sam' ? nameChip(-FEET - 6) : null}
      </g>
    </g>
  );
};

// Seated, facing you across the table (the table, drawn after, hides the folded legs).
const sitter = (who: Who) => (
  <g className={`lhs-${who}-sit`} transform={`translate(${SEATS[who][0]} ${SEATS[who][1] + SINK})`}>
    {sprite(who, 'seated')}
    {who === 'sam' ? nameChip(-FEET + 5 * PX - 6) : null}
  </g>
);

// The talking equaliser: three small bars in the talker's colour, out of step with each other.
const talkingBars = (who: Who, lift: number) => (
  <g
    className={`lhs-${who}-talk`}
    transform={`translate(${SEATS[who][0]} ${SEATS[who][1] + SEATED_TOP - lift})`}
  >
    {[0, 1, 2].map((i) => (
      <rect
        key={i}
        className="lhs-bar"
        x={-6.5 + i * 5}
        y={i === 1 ? -12 : -9}
        width={3}
        height={i === 1 ? 12 : 9}
        rx={1.5}
        fill={FIGURES[who].shirt}
        style={{ animationDelay: `${-i * 0.23}s`, animationDuration: `${0.5 + i * 0.12}s` }}
      />
    ))}
  </g>
);

// --- The canvas pieces, at their canvas size (the marketing hero's markup, drawn with the theme's tokens) -----

// A chair at the table's far side faces you (backrest above the seat); one at the near side has its back to you.
const chair = (x: number, near: boolean) =>
  near ? (
    <g key={x}>
      <path className="lhs-l" d={`M${x + 5} 136v22M${x + 39} 136v22`} />
      <rect className="lhs-p" x={x} y={110} width={44} height={12} rx={3} />
      <rect className="lhs-p" x={x + 5} y={102} width={34} height={36} rx={4} />
      <rect className="lhs-t" x={x + 5} y={102} width={34} height={36} rx={4} />
      <path className="lhs-d" d={`M${x + 22} 107v26`} />
    </g>
  ) : (
    <g key={x}>
      <rect className="lhs-p" x={x + 5} y={8} width={34} height={30} rx={4} />
      <path className="lhs-d" d={`M${x + 22} 13v20`} />
      <rect className="lhs-p" x={x} y={34} width={44} height={12} rx={3} />
    </g>
  );

// Book spines on a shelf row: x, top, width, colour (each runs down to the shelf board at 42).
const BOOKS: [number, number, number, string][] = [
  [14, 18, 8, '#f87171'],
  [23, 22, 7, '#60a5fa'],
  [31, 16, 9, '#fbbf24'],
  [41, 20, 6, '#34d399'],
  [48, 18, 8, '#a78bfa'],
  [67, 22, 7, '#60a5fa'],
  [75, 16, 10, '#fbbf24'],
  [86, 20, 7, '#34d399'],
  [94, 18, 8, '#a78bfa'],
];

const shelf = (
  <g>
    <ellipse className="lhs-shadow" cx={60} cy={128} rx={58} ry={4} />
    <rect className="lhs-p" x={4} y={4} width={112} height={122} rx={4} />
    <rect className="lhs-p" x={10} y={12} width={100} height={108} rx={2} />
    <rect className="lhs-t" x={10} y={12} width={100} height={108} rx={2} />
    {[0, 38, 76].map((dy, row) => (
      <g key={dy} transform={`translate(0 ${dy})`}>
        {BOOKS.map(([x, y, w, c], i) =>
          // A gap on every shelf, in a different place on each, so the rows don't repeat.
          (i + row) % 4 === 3 ? null : (
            <rect key={i} className="lhs-o" x={x} y={y} width={w} height={42 - y} rx={1} fill={c} />
          ),
        )}
        <rect className="lhs-p" x={10} y={42} width={100} height={5} rx={1.5} />
      </g>
    ))}
  </g>
);

const coffee = (
  <g>
    <ellipse className="lhs-shadow" cx={36} cy={92} rx={32} ry={3.5} />
    <rect className="lhs-p" x={2} y={64} width={68} height={24} rx={2} />
    <rect className="lhs-t" x={2} y={64} width={68} height={24} rx={2} />
    <path className="lhs-d" d="M8 76h56" />
    <rect className="lhs-p" x={2} y={58} width={68} height={8} rx={2} />
    <rect className="lhs-p" x={14} y={14} width={44} height={44} rx={5} />
    <rect className="lhs-t" x={14} y={14} width={44} height={44} rx={5} />
    <rect className="lhs-p" x={14} y={8} width={44} height={9} rx={3} />
    <rect x={20} y={20} width={32} height={8} rx={2} fill="var(--lhs-line)" />
    <rect className="lhs-p" x={32} y={31} width={8} height={6} rx={1.5} />
    <rect className="lhs-o" x={26} y={40} width={20} height={18} rx={4} fill="#e2e8f0" />
    <rect className="lhs-o" x={28} y={48} width={16} height={8} rx={2} fill="#78350f" />
    <rect className="lhs-p" x={58} y={49} width={10} height={10} rx={2} />
  </g>
);

const plant = (
  <g>
    <ellipse className="lhs-shadow" cx={28} cy={84} rx={18} ry={3.5} />
    <path
      className="lhs-o"
      d="M27 61C18 62 9 56 4 48C13 46 22 52 27 61ZM29 61C38 62 47 56 52 48C43 46 34 52 29 61Z"
      fill="#22c55e"
    />
    <path
      className="lhs-o"
      d="M27 60C14 54 6 40 7 26C17 32 24 44 27 60ZM29 60C42 54 50 40 49 26C39 32 32 44 29 60ZM28 60C20 44 20 24 28 8C36 24 36 44 28 60Z"
      fill="#4ade80"
    />
    <path className="lhs-d" d="M28 56V16" />
    <rect className="lhs-o" x={12} y={56} width={32} height={8} rx={3} fill="#ea580c" />
    <path className="lhs-o" d="M15 63H41L38 84H18Z" fill="#c2410c" />
  </g>
);

// A piece popping in at its place: the pop's scale on the outer group, the placement on the inner one (a CSS
// transform would replace an SVG transform attribute on the same element).
const placed = (cls: string, at: string, piece: ReactNode) => (
  <g className={`lhs-pop ${cls}`}>
    <g transform={at}>{piece}</g>
  </g>
);

// The table piece (the hero's meeting table, less its end chairs), in two layers either side of the sitters.
const TABLE = 'translate(124 76)';

const SCENE = (
  <>
    <defs>
      <radialGradient id="lhs-glow">
        <stop offset="0" stopColor="#0ea5e9" stopOpacity={0.28} />
        <stop offset="0.55" stopColor="#8b5cf6" stopOpacity={0.12} />
        <stop offset="1" stopColor="#8b5cf6" stopOpacity={0} />
      </radialGradient>
    </defs>
    <g className="lhs-scene" fontFamily="system-ui, sans-serif">
      {/* The floor, and the rug the table will stand on, under the walls and the door's swing. */}
      <rect
        className="lhs-floor"
        x={4}
        y={4}
        width={ROOM.w - 8}
        height={ROOM.h - 8}
        fill="var(--lhs-floor)"
      />
      <g className="lhs-pop lhs-rug">
        <ellipse
          cx={240}
          cy={156}
          rx={140}
          ry={84}
          fill="var(--lhs-rug)"
          stroke="var(--lhs-line)"
          strokeWidth={2}
        />
        <path
          className="lhs-d"
          d="M118 156a122 70 0 1 0 244 0a122 70 0 1 0-244 0M152 156a88 46 0 1 0 176 0a88 46 0 1 0-176 0M190 156a50 22 0 1 0 100 0a50 22 0 1 0-100 0"
        />
      </g>
      {/* The room's name band along the top wall, then the walls drawn round the room. */}
      <g className="lhs-band">
        <rect className="lhs-w lhs-wall" x={0} y={9} width={ROOM.w} height={27} rx={1} />
        <rect className="lhs-t" x={0} y={9} width={ROOM.w} height={27} rx={1} />
        <text x={14} y={22.5} fontSize={14} fill="var(--lhs-ink)" dominantBaseline="central">
          Huddle Room
        </text>
      </g>
      {WALLS.map((w) => (
        <rect
          key={w.id}
          className={`lhs-w lhs-wall lhs-wall-${w.id}`}
          x={w.x}
          y={w.y}
          width={w.w}
          height={w.h}
          rx={2}
        />
      ))}
      {/* The doorway: a threshold and two posts, the leaf on its hinge and its dashed swing arc. */}
      <g className="lhs-posts lhs-pop">
        <rect
          x={DOOR.x0}
          y={ROOM.h - 9}
          width={DOOR.x1 - DOOR.x0}
          height={8}
          fill="var(--lhs-floor)"
        />
        <rect className="lhs-w" x={DOOR.x0} y={ROOM.h - 10} width={6} height={10} />
        <rect className="lhs-w" x={DOOR.x1 - 6} y={ROOM.h - 10} width={6} height={10} />
      </g>
      <path
        className="lhs-arc"
        d={`M${HINGE[0] + LEAF} ${HINGE[1]}A${LEAF} ${LEAF} 0 0 0 ${HINGE[0]} ${HINGE[1] - LEAF}`}
        fill="none"
        stroke="var(--lhs-line)"
        strokeWidth={1.5}
        opacity={0.55}
        strokeDasharray="4 4"
      />
      <rect
        className="lhs-w lhs-leaf"
        x={HINGE[0] - 1.5}
        y={HINGE[1] - LEAF}
        width={3}
        height={LEAF}
        rx={1}
      />

      {/* Where they meet: a soft pool of light round the pair once both have sat down. */}
      <ellipse className="lhs-ring" cx={240} cy={112} rx={120} ry={78} fill="url(#lhs-glow)" />

      {/* Furniture, back to front. */}
      {placed('lhs-shelf', 'translate(20 46) scale(0.58)', shelf)}
      {placed('lhs-coffee', 'translate(392 40)', coffee)}
      {placed('lhs-plantL', 'translate(22 214)', plant)}
      {placed('lhs-plantR', 'translate(402 214)', plant)}
      {placed(
        'lhs-table',
        TABLE,
        <>
          <ellipse className="lhs-shadow" cx={116} cy={160} rx={96} ry={6} />
          {chair(64, false)}
          {chair(124, false)}
        </>,
      )}
      {/* The seated pair sits between the far chairs and the table top. */}
      {sitter('you')}
      {sitter('sam')}
      {placed(
        'lhs-table',
        TABLE,
        <>
          <path className="lhs-l" d="M50 110v20M182 110v20" />
          {/* An opaque underlay, so the top hides the sitters' legs as a real table would. */}
          <rect x={40} y={56} width={152} height={52} rx={6} fill="var(--lhs-floor)" />
          <rect className="lhs-p" x={40} y={56} width={152} height={44} rx={6} />
          <rect className="lhs-p" x={40} y={96} width={152} height={12} rx={4} />
          <rect className="lhs-t" x={40} y={96} width={152} height={12} rx={4} />
          {chair(64, true)}
          {chair(124, true)}
        </>,
      )}
      {talkingBars('you', 8)}
      {talkingBars('sam', 27)}

      {/* The walkers, over everything: they pass in front of the furniture on their way in. */}
      {walker('sam')}
      {walker('you')}
    </g>
  </>
);

// The theme's tokens, flipped by the dark variant: the hero's light and dark floor, outline, furniture tint,
// shadow, ink and rug.
const TOKENS =
  '[--lhs-floor:#f5f0e6] [--lhs-line:var(--color-slate-400)] [--lhs-piece:rgb(148_163_184/0.32)] [--lhs-shadow:rgb(15_23_42/0.12)] [--lhs-ink:var(--color-slate-900)] [--lhs-rug:#fef9e7] dark:[--lhs-floor:var(--color-stone-800)] dark:[--lhs-line:var(--color-slate-500)] dark:[--lhs-piece:rgb(100_116_139/0.32)] dark:[--lhs-shadow:rgb(0_0_0/0.3)] dark:[--lhs-ink:var(--color-slate-200)] dark:[--lhs-rug:var(--color-slate-800)]';

export function SpaceBuildAnimation({
  className = 'max-w-[380px]',
  label = 'A Space coming to life',
}: {
  className?: string;
  /** The picture's accessible name; empty, it is decorative and hidden from assistive tech. */
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The /new creating stage gives way to the editor's own load in place: the scene carries on, never restarts.
  useLoopPhase(ref, 'space', LOOP_MS, '--lhs-delay');
  return (
    <div ref={ref} data-loading-art="space" className={`lhs mx-auto w-full ${className} ${TOKENS}`}>
      <svg
        viewBox="-24 -34 528 392"
        className="w-full overflow-visible"
        {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      >
        {SCENE}
      </svg>
      <style>{SCENE_CSS}</style>
    </div>
  );
}
