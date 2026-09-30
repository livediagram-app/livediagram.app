// The drawn scene under the Sailboat retrospective (template-builders-sailboat.ts,
// docs/specs/008-canvas/canvas-and-palette.md "Templates"): sky, a sea with a
// waved surface, a little wooden boat with two sails and a pennant, rocks
// breaking the surface ahead of it, an island with a palm on the horizon and a
// low sun. Built from ordinary sketches (freehand paths) and shapes, so every
// piece can be moved, recoloured or deleted like anything else on the canvas.
//
// All of it is scaffold: the picture carries the metaphor, the notes ride on
// top of it. Fills are theme-locked, so the sea stays blue under any theme.
//
// Coordinates are local to the scene's top-left corner (`ox`, `oy`).

import { createFreehand, createShape, type Element } from '@livediagram/document';
import { SCAFFOLD } from './template-retro-kit';

type Pt = [number, number];

export const SCENE_COLOURS = {
  sky: '#f0f9ff',
  skyEdge: '#bae6fd',
  sea: '#7dd3fc',
  seaDeep: '#38bdf8',
  foam: '#e0f2fe',
  hull: '#b45309',
  hullEdge: '#78350f',
  deck: '#f59e0b',
  sail: '#ffffff',
  sailEdge: '#94a3b8',
  stripe: '#fb7185',
  pennant: '#e11d48',
  mast: '#78350f',
  rock: '#78716c',
  rockEdge: '#44403c',
  sand: '#fcd34d',
  sandEdge: '#d97706',
  palm: '#16a34a',
  trunk: '#92400e',
  sun: '#fde047',
  sunGlow: '#fef9c3',
} as const;

// A sketch through `points` (scene-local), filled when closed. Straight edges
// keep a sail's corners crisp; smoothing rounds a hull or a wave.
function sketch(
  ox: number,
  oy: number,
  points: Pt[],
  opts: {
    closed: boolean;
    fill?: string;
    stroke: string;
    width?: 'thin' | 'medium' | 'thick' | 'extra-thick';
    straight?: boolean;
  },
): Element {
  const el = createFreehand(
    points.map(([x, y]) => ({ x: ox + x, y: oy + y })),
    opts.closed,
  );
  return {
    ...el,
    ...(opts.fill ? { fillColor: opts.fill, themeLockFill: true } : {}),
    strokeColor: opts.stroke,
    strokeWidth: opts.width ?? 'medium',
    ...(opts.straight ? { straightEdges: true } : {}),
    ...SCAFFOLD,
  };
}

// A gentle sine wave from x0 to x1 about `y`, sampled densely enough that
// straight segments read as a smooth curve (and never overshoot a corner the
// way a smoothed sketch does).
function waveLine(x0: number, x1: number, y: number, amp: number, period: number): Pt[] {
  const pts: Pt[] = [];
  const step = period / 16;
  for (let x = x0; x <= x1 + 0.01; x += step) {
    pts.push([x, y - amp * Math.sin(((x - x0) / period) * Math.PI * 2)]);
  }
  return pts;
}

export type SceneLayout = {
  width: number;
  height: number;
  // Where the sea begins, scene-local.
  waterline: number;
  // The boat's mast, scene-local x.
  boatX: number;
  // The rocks' left edge and the island's centre, scene-local x.
  rocksX: number;
  islandX: number;
  // The sun's centre, scene-local. Drawn before the sea, so a sun on the
  // horizon sets into it.
  sunX: number;
  sunY: number;
};

// Where the mast starts: the rig keeps its height above the waterline
// however deep the sky is.
const mastTopOf = (s: SceneLayout) => s.waterline - 338;

// The jib's leading edge at scene-local height `y`, so gusts can aim at it.
export function jibEdgeX(s: SceneLayout, y: number): number {
  const top = mastTopOf(s) + 40;
  const foot = s.waterline - 50;
  return s.boatX - 10 - (120 * (y - top)) / (foot - top);
}

// The sky panel the whole picture sits in.
export function sceneSky(ox: number, oy: number, s: SceneLayout): Element[] {
  return [
    {
      ...createShape('square', ox, oy),
      width: s.width,
      height: s.height,
      fillColor: SCENE_COLOURS.sky,
      strokeColor: SCENE_COLOURS.skyEdge,
      borderRadius: 'lg',
      themeLockFill: true,
      ...SCAFFOLD,
    },
  ];
}

// The sea with its waved surface, and the wake trailing the boat.
export function sceneSea(ox: number, oy: number, s: SceneLayout): Element[] {
  const { width: w, height: h, waterline: wl } = s;
  const r = 14;
  // The sea follows the panel's rounded bottom corners.
  const corner = (cx: number, cy: number, from: number): Pt[] =>
    [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const a = ((from + i * 15) * Math.PI) / 180;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    });
  const sea: Pt[] = [
    ...waveLine(0, w, wl, 5, 80),
    [w, h - r],
    ...corner(w - r, h - r, 0),
    ...corner(r, h - r, 90),
    [0, h - r],
  ];
  return [
    sketch(ox, oy, sea, {
      closed: true,
      fill: SCENE_COLOURS.sea,
      stroke: SCENE_COLOURS.seaDeep,
      width: 'thin',
      straight: true,
    }),
    // The wake trailing from the stern, so the boat reads as under way.
    ...[
      { x: s.boatX - 330, y: wl + 24, w: 130 },
      { x: s.boatX - 430, y: wl + 50, w: 170 },
      { x: s.boatX - 540, y: wl + 74, w: 200 },
    ].map((l) =>
      sketch(ox, oy, waveLine(l.x, l.x + l.w, l.y, 4, 40), {
        closed: false,
        stroke: SCENE_COLOURS.foam,
        width: 'medium',
        straight: true,
      }),
    ),
  ];
}

// The sun setting on the horizon behind the island, with a pale halo, and
// two gulls heading for it.
export function sceneSun(ox: number, oy: number, s: SceneLayout): Element[] {
  const size = 108;
  const glow = 160;
  const cy = s.sunY;
  const disc = (d: number, fill: string): Element => ({
    ...createShape('circle', ox + s.sunX - d / 2, oy + cy - d / 2),
    width: d,
    height: d,
    fillColor: fill,
    strokeColor: fill,
    themeLockFill: true,
    ...SCAFFOLD,
  });
  const gull = (x: number, y: number, span: number): Element =>
    sketch(
      ox,
      oy,
      [
        [x - span, y - span * 0.35],
        [x - span * 0.45, y - span * 0.45],
        [x, y],
        [x + span * 0.45, y - span * 0.45],
        [x + span, y - span * 0.35],
      ],
      { closed: false, stroke: '#475569', width: 'medium' },
    );
  return [
    disc(glow, SCENE_COLOURS.sunGlow),
    disc(size, SCENE_COLOURS.sun),
    gull(s.sunX - 250, cy - 150, 14),
    gull(s.sunX - 212, cy - 176, 10),
  ];
}

// The boat: a wooden hull riding the waterline with portholes, a mast, a
// striped mainsail, a jib and a pennant streaming ahead.
export function sceneBoat(ox: number, oy: number, s: SceneLayout): Element[] {
  const x = s.boatX;
  const wl = s.waterline;
  const hullTop = wl - 34;
  const hullBot = wl + 34;
  const mastTop = mastTopOf(s);
  const boomY = hullTop - 16;
  const hull: Pt[] = [
    [x - 170, hullTop],
    [x + 180, hullTop],
    [x + 150, hullTop + 30],
    [x + 110, hullBot],
    [x - 120, hullBot],
    [x - 150, hullTop + 30],
  ];
  const porthole = (px: number): Element => ({
    ...createShape('circle', ox + px - 8, oy + hullTop + 14),
    width: 16,
    height: 16,
    fillColor: SCENE_COLOURS.foam,
    strokeColor: SCENE_COLOURS.hullEdge,
    strokeWidth: 'medium',
    themeLockFill: true,
    ...SCAFFOLD,
  });
  return [
    // Mast first, so the sails and hull sit over it.
    {
      ...createShape('square', ox + x - 4, oy + mastTop),
      width: 8,
      height: hullTop - mastTop + 4,
      fillColor: SCENE_COLOURS.mast,
      strokeColor: SCENE_COLOURS.mast,
      borderRadius: 'sm',
      themeLockFill: true,
      ...SCAFFOLD,
    },
    // Mainsail, aft of the mast, with a coral band across it.
    sketch(
      ox,
      oy,
      [
        [x + 10, mastTop + 18],
        [x + 150, boomY],
        [x + 10, boomY],
      ],
      { closed: true, fill: SCENE_COLOURS.sail, stroke: SCENE_COLOURS.sailEdge, straight: true },
    ),
    sketch(
      ox,
      oy,
      [
        [x + 10, boomY - 92],
        [x + 10 + (140 * (boomY - 92 - mastTop - 18)) / (boomY - mastTop - 18), boomY - 92],
        [x + 10 + (140 * (boomY - 64 - mastTop - 18)) / (boomY - mastTop - 18), boomY - 64],
        [x + 10, boomY - 64],
      ],
      { closed: true, fill: SCENE_COLOURS.stripe, stroke: SCENE_COLOURS.stripe, straight: true },
    ),
    // Jib, forward of the mast.
    sketch(
      ox,
      oy,
      [
        [x - 10, mastTop + 40],
        [x - 10, boomY],
        [x - 130, boomY],
      ],
      { closed: true, fill: SCENE_COLOURS.sail, stroke: SCENE_COLOURS.sailEdge, straight: true },
    ),
    // Pennant at the masthead, streaming the way the wind blows.
    sketch(
      ox,
      oy,
      [
        [x + 4, mastTop],
        [x + 50, mastTop + 10],
        [x + 4, mastTop + 20],
      ],
      { closed: true, fill: SCENE_COLOURS.pennant, stroke: SCENE_COLOURS.pennant, straight: true },
    ),
    sketch(ox, oy, hull, {
      closed: true,
      fill: SCENE_COLOURS.hull,
      stroke: SCENE_COLOURS.hullEdge,
      straight: true,
    }),
    // A lighter deck rail along the top of the hull.
    {
      ...createShape('square', ox + x - 170, oy + hullTop - 6),
      width: 350,
      height: 8,
      fillColor: SCENE_COLOURS.deck,
      strokeColor: SCENE_COLOURS.hullEdge,
      strokeWidth: 'thin',
      borderRadius: 'full',
      themeLockFill: true,
      ...SCAFFOLD,
    },
    porthole(x - 70),
    porthole(x),
    porthole(x + 70),
  ];
}

// Rocks breaking the surface ahead of the boat, foam at their feet.
export function sceneRocks(ox: number, oy: number, s: SceneLayout): Element[] {
  const x = s.rocksX;
  const wl = s.waterline;
  const rock = (pts: Pt[]) =>
    sketch(ox, oy, pts, {
      closed: true,
      fill: SCENE_COLOURS.rock,
      stroke: SCENE_COLOURS.rockEdge,
      straight: true,
    });
  return [
    rock([
      [x, wl + 14],
      [x + 18, wl - 30],
      [x + 36, wl - 22],
      [x + 58, wl - 62],
      [x + 84, wl - 26],
      [x + 104, wl + 14],
    ]),
    rock([
      [x + 92, wl + 14],
      [x + 110, wl - 18],
      [x + 126, wl - 10],
      [x + 144, wl + 14],
    ]),
    sketch(ox, oy, waveLine(x - 12, x + 156, wl + 16, 3, 24), {
      closed: false,
      stroke: '#ffffff',
      width: 'thick',
      straight: true,
    }),
  ];
}

// The island on the horizon: a sandy mound with a palm.
export function sceneIsland(ox: number, oy: number, s: SceneLayout): Element[] {
  const x = s.islandX;
  const wl = s.waterline;
  const trunkBase: Pt = [x - 10, wl - 30];
  const crown: Pt = [x + 16, wl - 128];
  const leaf = (dx: number, dy: number, lift: number): Element =>
    sketch(
      ox,
      oy,
      [
        crown,
        [crown[0] + dx * 0.5, crown[1] + dy * 0.5 - lift],
        [crown[0] + dx, crown[1] + dy],
        [crown[0] + dx * 0.5, crown[1] + dy * 0.5 + lift * 0.3],
      ],
      { closed: true, fill: SCENE_COLOURS.palm, stroke: '#15803d', width: 'thin' },
    );
  return [
    sketch(ox, oy, [trunkBase, [x - 2, wl - 70], [x + 8, wl - 104], crown], {
      closed: false,
      stroke: SCENE_COLOURS.trunk,
      width: 'extra-thick',
    }),
    leaf(-66, 22, 18),
    leaf(-40, -26, 10),
    leaf(58, 26, 18),
    leaf(44, -22, 10),
    leaf(4, 44, 12),
    sketch(
      ox,
      oy,
      [
        [x - 140, wl + 6],
        [x - 90, wl - 24],
        [x, wl - 40],
        [x + 90, wl - 24],
        [x + 140, wl + 6],
      ],
      { closed: true, fill: SCENE_COLOURS.sand, stroke: SCENE_COLOURS.sandEdge },
    ),
  ];
}
