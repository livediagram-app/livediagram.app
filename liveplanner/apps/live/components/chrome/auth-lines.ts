// The routes the Night Band frame's lines take (docs/specs/014-identity/auth-and-guest-access.md "The look: Night
// Band"). Pure: given a random source, one edge-to-edge curve on the 1280 x 800 stage, entering from one edge and
// leaving through another, in any direction, and the colour it is drawn in.

export const STAGE_W = 1280;
export const STAGE_H = 800;
// How far beyond the edge a route starts and ends, so its tip is never seen arriving or leaving.
const OFFSTAGE = 40;
// Bends stay this far inside the stage, so every route sweeps across it rather than hugging an edge.
const INSET_X = 100;
const INSET_Y = 80;

// Light inks at about half strength, dark ones a touch softer; never the whole colour, the lines sit behind copy.
export const TRACE_TONES = [
  'stroke-emerald-500/50 dark:stroke-emerald-400/50',
  'stroke-sky-500/45 dark:stroke-sky-400/45',
  'stroke-violet-500/40 dark:stroke-violet-400/45',
  'stroke-amber-500/45 dark:stroke-amber-400/40',
  'stroke-rose-400/45 dark:stroke-rose-400/40',
] as const;

export type Edge = 'top' | 'right' | 'bottom' | 'left';
const EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left'];

export interface Trace {
  d: string;
  tone: string;
  from: Edge;
  to: Edge;
}

function pointOn(edge: Edge, t: number): [number, number] {
  switch (edge) {
    case 'top':
      return [t * STAGE_W, -OFFSTAGE];
    case 'right':
      return [STAGE_W + OFFSTAGE, t * STAGE_H];
    case 'bottom':
      return [t * STAGE_W, STAGE_H + OFFSTAGE];
    case 'left':
      return [-OFFSTAGE, t * STAGE_H];
  }
}

// How far a bend may stray from its third of the straight line between the ends: enough to sweep, too little to loop.
const SWAY = 260;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// A bend near the point `t` of the way from `a` to `b`, kept on the stage.
function bend(
  a: [number, number],
  b: [number, number],
  t: number,
  rand: () => number,
): [number, number] {
  return [
    clamp(a[0] + (b[0] - a[0]) * t + (rand() * 2 - 1) * SWAY, INSET_X, STAGE_W - INSET_X),
    clamp(a[1] + (b[1] - a[1]) * t + (rand() * 2 - 1) * SWAY, INSET_Y, STAGE_H - INSET_Y),
  ];
}

const r = (n: number) => Math.round(n);

// `rand` returns a number in [0, 1), as Math.random does; tests pass a seeded one.
export function randomTrace(rand: () => number): Trace {
  const fromIndex = Math.floor(rand() * EDGES.length);
  // Any other edge: the next one round, the opposite or the one before.
  const toIndex = (fromIndex + 1 + Math.floor(rand() * (EDGES.length - 1))) % EDGES.length;
  const from = EDGES[fromIndex]!;
  const to = EDGES[toIndex]!;
  const start = pointOn(from, rand());
  const end = pointOn(to, rand());
  const [x0, y0] = start;
  const [c1x, c1y] = bend(start, end, 1 / 3, rand);
  const [c2x, c2y] = bend(start, end, 2 / 3, rand);
  const [x1, y1] = end;
  const tone = TRACE_TONES[Math.floor(rand() * TRACE_TONES.length)]!;
  return {
    d: `M ${r(x0)} ${r(y0)} C ${r(c1x)} ${r(c1y)}, ${r(c2x)} ${r(c2y)}, ${r(x1)} ${r(y1)}`,
    tone,
    from,
    to,
  };
}

// Under reduced motion two fixed routes stand still, fully drawn, through the margins.
export const STILL_TRACES: readonly { d: string; tone: string }[] = [
  { d: 'M -40 790 C 260 730, 560 800, 860 752 S 1140 700, 1320 728', tone: TRACE_TONES[0] },
  {
    d: 'M 1320 120 C 1180 40, 1040 160, 900 110 S 600 30, 300 70 S 60 40, -40 60',
    tone: TRACE_TONES[1],
  },
];
