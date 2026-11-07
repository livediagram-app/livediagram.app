// The timeline and geometry of livehuddle's loading picture, SpaceBuildAnimation
// (docs/specs/007-editor/new-document-route.md "The opening screen", blueprint:
// docs/specs/007-editor/blueprints/opening-screen.md). Pure data and the CSS it generates, kept apart from the
// markup so the component file stays the drawing.
//
// Coordinates are the canvas's own units (a ten-unit wall, a 56-unit character), so the pieces are drawn at the
// same size and line weight as on the canvas and in the marketing hero. Every moment is a percentage of one loop.

// Front-loaded: most loads finish within a second or two, so the room is built, the door open and the first
// character walking by about 0.6s (1% is 90ms). A slow build would only ever show an empty box.
export const LOOP_MS = 9_000;

export type Point = readonly [number, number];
export type View = 'up' | 'left' | 'right';

// The room's outer box and its doorway (a 96-unit gap in the bottom wall, like the canvas door piece).
export const ROOM = { w: 480, h: 320, wall: 10 } as const;
export const DOOR = { x0: 192, x1: 288 } as const;
// The door leaf's hinge, on the left post, and its length.
export const HINGE: Point = [199.5, 315];
export const LEAF = 84;

// The two seats behind the table, where each character's feet rest as it sits.
export const SEATS: Record<'you' | 'sam', Point> = { you: [210, 128], sam: [270, 128] };

// Each character's walk, feet first: in at the doorway, up, along, up the side of the table, across to its seat.
export const PATHS: Record<'you' | 'sam', readonly Point[]> = {
  you: [[228, 350], [228, 290], [112, 290], [112, 128], SEATS.you],
  sam: [[252, 350], [252, 290], [368, 290], [368, 128], SEATS.sam],
};

// When each walk starts and ends (% of the loop). Sam is a beat behind.
export const WALKS: Record<'you' | 'sam', readonly [number, number]> = {
  you: [7, 35],
  sam: [11, 39],
};

// The build, overlapping: floor, the walls round the room, the door, the name band, the furniture.
export const FLOOR_IN = 3;
// Each wall's draw window, drawn clockwise from the top-left corner in quick overlapping strokes. `origin` is the end it grows from.
export const WALLS = [
  { id: 'top', x: 0, y: 0, w: ROOM.w, h: ROOM.wall, axis: 'X', origin: '0px 0px', at: [0, 2.5] },
  {
    id: 'right',
    x: ROOM.w - ROOM.wall,
    y: 0,
    w: ROOM.wall,
    h: ROOM.h,
    axis: 'Y',
    origin: `${ROOM.w}px 0px`,
    at: [1, 3.5],
  },
  {
    id: 'bottom-right',
    x: DOOR.x1,
    y: ROOM.h - ROOM.wall,
    w: ROOM.w - DOOR.x1,
    h: ROOM.wall,
    axis: 'X',
    origin: `${ROOM.w}px ${ROOM.h}px`,
    at: [2, 4],
  },
  {
    id: 'bottom-left',
    x: 0,
    y: ROOM.h - ROOM.wall,
    w: DOOR.x0,
    h: ROOM.wall,
    axis: 'X',
    origin: `${DOOR.x0}px ${ROOM.h}px`,
    at: [3, 5],
  },
  {
    id: 'left',
    x: 0,
    y: 0,
    w: ROOM.wall,
    h: ROOM.h,
    axis: 'Y',
    origin: `0px ${ROOM.h}px`,
    at: [3.5, 6],
  },
] as const;
export const POSTS_AT = 2;
export const BAND_AT = 5;
// Furniture pops in one piece after another, while the people are already on their way in.
export const PIECES = {
  rug: 5,
  table: 6,
  shelf: 7.5,
  coffee: 9,
  plantL: 10.5,
  plantR: 12,
} as const;
export const DOOR_OPEN: readonly [number, number] = [3, 8];
// Seated across the table, they meet: the ring, then each talks in turn.
export const RING_IN = 39;
export const TALK: Record<'you' | 'sam', readonly [number, number]> = {
  you: [41, 58],
  sam: [57, 76],
};
// The whole Space dissolves at the end of the loop and everything resets unseen.
export const OUT: readonly [number, number] = [90, 96];

// The stride: two frames, swapped on a short loop of their own (only seen while a character walks).
export const STEP_MS = 360;

const r1 = (v: number) => Math.round(v * 100) / 100;

export type Segment = { view: View; t0: number; t1: number; from: Point; to: Point };

// A walk split into straight segments over its window, at a constant pace, each facing the way it goes.
export function segments(path: readonly Point[], [t0, t1]: readonly [number, number]): Segment[] {
  const lengths = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i]![0], p[1] - path[i]![1]));
  const total = lengths.reduce((a, b) => a + b, 0);
  let at = t0;
  return lengths.map((len, i) => {
    const from = path[i]!;
    const to = path[i + 1]!;
    const start = at;
    at += ((t1 - t0) * len) / total;
    const view: View = to[1] < from[1] ? 'up' : to[0] < from[0] ? 'left' : 'right';
    return { view, t0: r1(start), t1: r1(at), from, to };
  });
}

// An element that turns on at `on` and off at `off` (instantly), from a loop that starts with it hidden.
function blink(name: string, windows: readonly (readonly [number, number])[]): string {
  const stops = ['0% { opacity: 0; }'];
  for (const [on, off] of windows) {
    stops.push(`${r1(Math.max(0, on - 0.01))}% { opacity: 0; }`, `${on}% { opacity: 1; }`);
    stops.push(`${r1(off - 0.01)}% { opacity: 1; }`, `${off}% { opacity: 0; }`);
  }
  stops.push('100% { opacity: 0; }');
  return `@keyframes ${name} { ${stops.join(' ')} }`;
}

// A piece arriving: from nothing, a small overshoot, then settled for the rest of the loop.
const pop = (name: string, at: number) =>
  `@keyframes ${name} { 0%, ${at}% { opacity: 0; transform: scale(0.6); } ${r1(at + 2)}% { opacity: 1; transform: scale(1.06); } ${r1(at + 3.5)}%, 100% { opacity: 1; transform: scale(1); } }`;

// Fade in at `at` over `len`, then held.
const fadeIn = (name: string, at: number, len = 2) =>
  `@keyframes ${name} { 0%, ${at}% { opacity: 0; } ${r1(at + len)}%, 100% { opacity: 1; } }`;

function walkFrames(who: 'you' | 'sam'): string {
  const segs = segments(PATHS[who], WALKS[who]);
  const [start, end] = WALKS[who];
  const first = segs[0]!.from;
  const at = (p: Point) => `transform: translate(${p[0]}px, ${p[1]}px);`;
  const moves = [
    `0%, ${start}% { ${at(first)} }`,
    ...segs.map((s) => `${s.t1}% { ${at(s.to)} }`),
    `100% { ${at(segs[segs.length - 1]!.to)} }`,
  ];
  const views = (['up', 'left', 'right'] as const).map((v) =>
    blink(
      `lhs-${who}-${v}`,
      segs.filter((s) => s.view === v).map((s) => [s.t0, s.t1] as const),
    ),
  );
  return [
    `@keyframes lhs-${who}-move { ${moves.join(' ')} }`,
    // The walker fades up in the doorway, and goes as the seated figure takes its place.
    `@keyframes lhs-${who}-walk { 0%, ${start}% { opacity: 0; } ${start + 2}% { opacity: 1; } ${r1(end - 0.01)}% { opacity: 1; } ${end}%, 100% { opacity: 0; } }`,
    `@keyframes lhs-${who}-sit { 0%, ${r1(end - 0.01)}% { opacity: 0; } ${end}%, 100% { opacity: 1; } }`,
    ...views,
  ].join('\n');
}

// A talker's bars: still and low until its turn, a voice during it, low again after.
const talkFrames = (who: 'you' | 'sam') => {
  const [t0, t1] = TALK[who];
  return `@keyframes lhs-${who}-talk { 0%, ${t0}% { opacity: 0; } ${t0 + 1}%, ${t1}% { opacity: 1; } ${t1 + 1}%, 100% { opacity: 0.35; } }`;
};

const anim = (name: string, timing = 'linear') =>
  `animation: ${name} ${LOOP_MS}ms ${timing} var(--lhs-delay, 0ms) infinite;`;

// The base styles ARE the still frame: the finished room, the door open, both seated and talking at rest. Motion
// is layered on only when it is allowed, and the in-app Reduce Motion preference (which collapses animations to
// their last frame) stops it outright instead, since this loop's last frame is the empty, dissolved Space.
export const SCENE_CSS = `
.lhs-walk { opacity: 0; }
.lhs-pop { transform-box: fill-box; transform-origin: 50% 100%; }
.lhs-table { transform-box: view-box; transform-origin: 240px 236px; }
.lhs-rug { transform-origin: center; }
.lhs-bar { transform-box: fill-box; transform-origin: 50% 100%; }
.lhs-wall { vector-effect: non-scaling-stroke; }
.lhs-leaf { transform-origin: ${HINGE[0]}px ${HINGE[1]}px; }
.lhs-p { fill: var(--lhs-piece); stroke: var(--lhs-line); stroke-width: 2; }
.lhs-w { fill: var(--lhs-floor); stroke: var(--lhs-line); stroke-width: 2; }
.lhs-t { fill: var(--lhs-line); opacity: 0.22; }
.lhs-d { fill: none; stroke: var(--lhs-line); stroke-width: 1.5; opacity: 0.55; stroke-linecap: round; }
.lhs-l { fill: none; stroke: var(--lhs-line); stroke-width: 2.5; stroke-linecap: round; }
.lhs-o { stroke: var(--lhs-line); stroke-width: 2; }
.lhs-shadow { fill: var(--lhs-shadow); }
@media (prefers-reduced-motion: no-preference) {
  .lhs-scene { ${anim('lhs-scene')} }
  .lhs-floor { transform-box: fill-box; transform-origin: center; ${anim('lhs-floor', 'ease-out')} }
${WALLS.map((w) => `  .lhs-wall-${w.id} { transform-origin: ${w.origin}; ${anim(`lhs-wall-${w.id}`, 'ease-in-out')} }`).join('\n')}
  .lhs-posts { ${anim('lhs-posts')} }
  .lhs-band { ${anim('lhs-band')} }
${Object.keys(PIECES)
  .map((k) => `  .lhs-${k} { ${anim(`lhs-${k}`, 'ease-out')} }`)
  .join('\n')}
  .lhs-leaf { ${anim('lhs-leaf')} }
  .lhs-arc { ${anim('lhs-arc')} }
  .lhs-ring { ${anim('lhs-ring', 'ease-out')} }
${(['you', 'sam'] as const)
  .map(
    (who) => `  .lhs-${who}-move { ${anim(`lhs-${who}-move`)} }
  .lhs-${who}-walk { ${anim(`lhs-${who}-walk`)} }
  .lhs-${who}-sit { ${anim(`lhs-${who}-sit`)} }
  .lhs-${who}-up { ${anim(`lhs-${who}-up`)} }
  .lhs-${who}-left { ${anim(`lhs-${who}-left`)} }
  .lhs-${who}-right { ${anim(`lhs-${who}-right`)} }
  .lhs-${who}-talk { ${anim(`lhs-${who}-talk`)} }`,
  )
  .join('\n')}
  .lhs-f0 { animation: lhs-f0 ${STEP_MS}ms steps(1, end) infinite; }
  .lhs-f1 { animation: lhs-f1 ${STEP_MS}ms steps(1, end) infinite; }
  .lhs-bar { animation: lhs-bar 0.6s ease-in-out infinite alternate; }
  @keyframes lhs-scene { 0%, ${OUT[0]}% { opacity: 1; } ${OUT[1]}%, 100% { opacity: 0; } }
  @keyframes lhs-floor { 0% { opacity: 0; transform: scale(0.96); } ${FLOOR_IN}%, 100% { opacity: 1; transform: scale(1); } }
${WALLS.map((w) => `  @keyframes lhs-wall-${w.id} { 0%, ${w.at[0]}% { opacity: 0; transform: scale${w.axis}(0); } ${r1(w.at[0] + 0.3)}% { opacity: 1; } ${w.at[1]}%, 100% { opacity: 1; transform: scale${w.axis}(1); } }`).join('\n')}
  ${pop('lhs-posts', POSTS_AT)}
  ${fadeIn('lhs-band', BAND_AT, 3)}
${Object.entries(PIECES)
  .map(([k, at]) => `  ${pop(`lhs-${k}`, at)}`)
  .join('\n')}
  @keyframes lhs-leaf { 0%, ${POSTS_AT}% { opacity: 0; transform: rotate(90deg); } ${POSTS_AT + 1}%, ${DOOR_OPEN[0]}% { opacity: 1; transform: rotate(90deg); animation-timing-function: cubic-bezier(0.3, 0, 0.2, 1); } ${DOOR_OPEN[1]}%, 100% { opacity: 1; transform: rotate(0deg); } }
  ${fadeIn('lhs-arc', DOOR_OPEN[0] + 1, 4)}
  @keyframes lhs-ring { 0%, ${RING_IN}% { opacity: 0; transform: scale(0.85); } ${RING_IN + 4}%, 100% { opacity: 1; transform: scale(1); } }
  ${walkFrames('you')}
  ${walkFrames('sam')}
  ${talkFrames('you')}
  ${talkFrames('sam')}
  @keyframes lhs-f0 { 0% { opacity: 1; } 50% { opacity: 0; } }
  @keyframes lhs-f1 { 0% { opacity: 0; } 50% { opacity: 1; } }
  @keyframes lhs-bar { from { transform: scaleY(0.35); } to { transform: scaleY(1); } }
}
@media (prefers-reduced-motion: reduce) {
  .lhs * { animation: none !important; }
}
:root.reduce-motion .lhs * { animation: none !important; }
.lhs-ring { transform-box: fill-box; transform-origin: center; }
`;
