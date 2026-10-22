// A form cover's animated backgrounds (docs/specs/030-forms/forms.md "The form card, top to bottom", Cover) as
// data: every motion's moving parts, where each sits, what it is painted with and
// how it moves. Pure; the motion layer (components/canvas/PageMotionLayer.tsx) draws them.
//
// Kept cheap and calm: every part moves by transform and opacity alone, soft edges are radial
// gradients rather than blur filters, each motion has at most about a hundred parts, and loops run
// 4 to 90 seconds. Positions come from fixed seeds, so a cover looks the same wherever it is opened.
import type { PageMotion } from '@liveplanner/project';
import { motionSeed, type MotionPaint } from './page-motion';
import { Confetti, Equaliser, Orbits, Radar, Threads, Warp } from './page-motion-parts-page-four';

/** The loops a part runs, one per keyframes in app/motion-page.css (`pm-<name>`). */
export type MotionAnimName =
  | 'slide-x'
  | 'slide-x-neg'
  | 'slide-x-back'
  | 'slide-y'
  | 'rise'
  | 'wander'
  | 'spread'
  | 'turn'
  | 'twinkle'
  | 'float'
  | 'sweep'
  | 'glide'
  | 'fall'
  | 'pulse'
  | 'warp'
  | 'orbit'
  | 'blip'
  | 'bars'
  | 'tumble';

/** How a part moves: its loop, the loop's length and where it starts (seconds, a start at or below
 *  zero so a slide opens mid-motion), how far it travels (px), how far it turns (degrees: a
 *  streak's heading, an orbit's starting angle, a piece of confetti's spin), and where it rests
 *  under reduced motion (a ring's, a bubble's or a bar's scale; how far down its fall a piece of
 *  confetti hangs). */
export type MotionAnim = {
  name: MotionAnimName;
  d: number;
  dl?: number;
  x?: number;
  y?: number;
  r?: number;
  rest?: number;
};

/** What a part is painted with: a colour and an alpha, and for the patterned ones their shape. */
export type MotionFill =
  // A soft round light: full at its centre, under half by 45%, gone at its edge.
  | { kind: 'glow'; color: string; a: number }
  // A light fading evenly from its centre to its edge.
  | { kind: 'fade'; color: string; a: number }
  // One flat colour.
  | { kind: 'solid'; color: string; a?: number }
  // An out-of-focus light: a disc with a soft rim.
  | { kind: 'bokeh'; color: string }
  // Fine lines on the diagonal, `gap` apart.
  | { kind: 'lines'; color: string; a: number; gap: number }
  // A shaft of light, bright down its middle.
  | { kind: 'beam'; color: string; a: number }
  // Pools of colour at points of the box (fractions), each gone by its reach (a fraction).
  | {
      kind: 'mesh';
      spots: readonly { x: number; y: number; color: string; a: number; reach: number }[];
    }
  // Rays turning about the centre: 5 degrees lit, 7 dark.
  | { kind: 'rays'; color: string; a: number }
  // A ring: a border, nothing inside.
  | { kind: 'ring'; color: string; a: number; width: number }
  // A streak: clear at its tail (left), full at its head (right).
  | { kind: 'streak'; color: string; a: number }
  // A radar's sweep: a wedge of the last quarter turn, clear behind, full at its leading edge
  // (straight up, before it turns).
  | { kind: 'sweep'; color: string; a: number }
  // A bar lit from below: `from` at its foot (faint), `to` at its top.
  | { kind: 'bar'; from: string; to: string; a: number };

export type MotionBox = {
  type: 'box';
  left: number;
  top: number;
  width: number;
  height: number;
  // A circle (or an ellipse in a box that is not square).
  round?: boolean;
  fill: MotionFill;
  // A glow round it, as a box shadow: its blur, its spread and its colour.
  halo?: { blur: number; spread: number; color: string; a: number };
  anim?: MotionAnim;
};

/** A wave rolling sideways: its outline across two periods of `w`, so sliding by `w` loops. */
export type MotionWave = {
  type: 'wave';
  w: number;
  h: number;
  amp: number;
  base: number;
  periods: number;
  color: string;
  a: number;
  // A thread: the outline alone, a line this wide, rather than the water under it.
  stroke?: number;
  anim: MotionAnim;
};

/** Parts that move together (the sky of stars, a planet on its orbit, turning about the slide's
 *  centre) or are masked together (the rays from below), in a box the size of the slide. */
export type MotionGroup = {
  type: 'group';
  anim?: MotionAnim;
  mask?: 'from-below';
  children: MotionNode[];
};

/** Retro Grid's floor: a grid of `cell` squares in lines `line` thick, tilted back toward a
 *  horizon at 55% of the slide's height and rolling toward the viewer. */
export type MotionGrid = {
  type: 'grid';
  w: number;
  h: number;
  cell: number;
  line: number;
  color: string;
  a: number;
  anim: MotionAnim;
};

export type MotionNode = MotionBox | MotionWave | MotionGroup | MotionGrid;

export type MotionSize = { w: number; h: number };

/** Every part of a motion on a slide of this size, in paint order. */
export function motionParts(motion: PageMotion, size: MotionSize, p: MotionPaint): MotionNode[] {
  return MOTIONS[motion](size, p);
}

const MOTIONS: Record<PageMotion, (s: MotionSize, p: MotionPaint) => MotionNode[]> = {
  flow: Flow,
  drift: Drift,
  aurora: Aurora,
  ripple: Ripple,
  ribbons: Ribbons,
  mesh: Mesh,
  starfield: Starfield,
  'retro-grid': RetroGrid,
  bokeh: Bokeh,
  waves: Waves,
  spotlight: Spotlight,
  beams: Beams,
  sunburst: Sunburst,
  fireflies: Fireflies,
  snowfall: Snowfall,
  lava: Lava,
  'dot-wave': DotWave,
  clouds: Clouds,
  warp: Warp,
  orbits: Orbits,
  radar: Radar,
  equaliser: Equaliser,
  confetti: Confetti,
  threads: Threads,
};

const box = (b: Omit<MotionBox, 'type'>): MotionBox => ({ type: 'box', ...b });

// ── Flow: fine diagonal lines streaming along, one period a loop, so it never seams. ────────────
function Flow({ w, h }: MotionSize, p: MotionPaint): MotionNode[] {
  const gap = Math.max(w, h) / 14;
  const step = gap * Math.SQRT2;
  return [
    box({
      left: -step * 2,
      top: -step,
      width: w + step * 4,
      height: h + step * 2,
      fill: { kind: 'lines', color: p.hi, a: 0.28, gap },
      anim: { name: 'slide-x', d: 9, x: step },
    }),
  ];
}

// ── Drift: bubbles rising from the lower half and fading as they go. ───────────────────────────
function Drift({ w, h }: MotionSize, p: MotionPaint): MotionNode[] {
  const unit = Math.min(w, h);
  return Array.from({ length: 14 }, (_, i) => {
    const d = unit * (0.05 + motionSeed(i, 1) * 0.11);
    const dur = 14 + motionSeed(i, 2) * 14;
    return box({
      left: motionSeed(i, 3) * (w - d),
      top: h * (0.45 + motionSeed(i, 4) * 0.5),
      width: d,
      height: d,
      round: true,
      fill: { kind: 'glow', color: p.hi, a: 0.55 },
      anim: { name: 'rise', d: dur, dl: -motionSeed(i, 5) * dur, y: -h * 0.55 },
    });
  });
}

// ── Aurora: three broad lights wandering slowly on looping paths. ──────────────────────────────
function Aurora({ w, h }: MotionSize, p: MotionPaint): MotionNode[] {
  const lights = [
    { c: p.cool, x: 0.2, y: 0.12, s: 1.0, a: 0.5, d: 26 },
    { c: p.warm, x: 0.62, y: 0.2, s: 1.15, a: 0.45, d: 32 },
    { c: p.hi, x: 0.45, y: 0.05, s: 0.8, a: 0.28, d: 21 },
    { c: p.b, x: 0.3, y: 0.6, s: 1.0, a: 0.7, d: 38 },
  ];
  const unit = Math.max(w, h);
  return lights.map((l, i) =>
    box({
      left: w * l.x - (unit * l.s) / 2,
      top: h * l.y - (unit * l.s * 0.6) / 2,
      width: unit * l.s,
      height: unit * l.s * 0.6,
      fill: { kind: 'glow', color: l.c, a: l.a },
      anim: { name: 'wander', d: l.d, dl: -i * 7, x: w * 0.18, y: h * 0.12 },
    }),
  );
}

// ── Ripple: rings spreading out from the centre, one after another. ────────────────────────────
function Ripple({ w, h }: MotionSize, p: MotionPaint): MotionNode[] {
  const d = Math.max(w, h) * 1.1;
  return Array.from({ length: 4 }, (_, i) =>
    box({
      left: w / 2 - d / 2,
      top: h / 2 - d / 2,
      width: d,
      height: d,
      round: true,
      fill: { kind: 'ring', color: p.hi, a: 0.4, width: Math.max(2, d / 220) },
      // At rest (reduced motion) the rings stand still, nested.
      anim: { name: 'spread', d: 12, dl: -i * 3, rest: (i + 1) / 4 },
    }),
  );
}

type WaveSpec = Omit<MotionWave, 'type' | 'w' | 'h' | 'anim'> & {
  dur: number;
  delay: number;
  reverse?: boolean;
};

function wave({ w, h }: MotionSize, s: WaveSpec): MotionWave {
  return {
    type: 'wave',
    w,
    h,
    amp: s.amp,
    base: s.base,
    periods: s.periods,
    color: s.color,
    a: s.a,
    anim: { name: s.reverse ? 'slide-x-back' : 'slide-x-neg', d: s.dur, dl: s.delay, x: -w },
  };
}

// ── Ribbons: bands of colour flowing sideways at different paces. ──────────────────────────────
function Ribbons(s: MotionSize, p: MotionPaint): MotionNode[] {
  const { h } = s;
  return [
    wave(s, { amp: h * 0.08, base: h * 0.3, periods: 2, color: p.hi, a: 0.16, dur: 30, delay: 0 }),
    wave(s, {
      amp: h * 0.1,
      base: h * 0.5,
      periods: 3,
      color: p.b,
      a: 0.35,
      dur: 24,
      delay: -6,
      reverse: true,
    }),
    wave(s, {
      amp: h * 0.07,
      base: h * 0.68,
      periods: 2,
      color: p.hi,
      a: 0.12,
      dur: 36,
      delay: -12,
    }),
  ];
}

// ── Waves: an ocean along the bottom, three layers rolling at their own speeds. ────────────────
function Waves(s: MotionSize, p: MotionPaint): MotionNode[] {
  const { h } = s;
  return [
    wave(s, {
      amp: h * 0.035,
      base: h * 0.72,
      periods: 3,
      color: p.hi,
      a: 0.12,
      dur: 22,
      delay: -4,
    }),
    wave(s, {
      amp: h * 0.04,
      base: h * 0.79,
      periods: 4,
      color: p.b,
      a: 0.55,
      dur: 16,
      delay: -9,
      reverse: true,
    }),
    wave(s, { amp: h * 0.03, base: h * 0.86, periods: 3, color: p.lo, a: 0.7, dur: 12, delay: 0 }),
  ];
}

// ── Mesh: an oversized field of the page's colours turning slowly about the centre. ────────────
function Mesh({ w, h }: MotionSize, p: MotionPaint): MotionNode[] {
  const d = Math.hypot(w, h) * 1.15;
  return [
    box({
      left: w / 2 - d / 2,
      top: h / 2 - d / 2,
      width: d,
      height: d,
      fill: {
        kind: 'mesh',
        spots: [
          { x: 0.25, y: 0.3, color: p.cool, a: 0.6, reach: 0.42 },
          { x: 0.75, y: 0.35, color: p.b, a: 0.9, reach: 0.45 },
          { x: 0.4, y: 0.78, color: p.a, a: 0.9, reach: 0.48 },
          { x: 0.8, y: 0.8, color: p.warm, a: 0.55, reach: 0.4 },
          { x: 0.55, y: 0.5, color: p.hi, a: 0.25, reach: 0.3 },
        ],
      },
      anim: { name: 'turn', d: 48 },
    }),
  ];
}

// ── Starfield: stars of three sizes twinkling on their own beats while the sky drifts. ─────────
function Starfield({ w, h }: MotionSize, p: MotionPaint): MotionNode[] {
  const unit = Math.min(w, h);
  const stars = Array.from({ length: 46 }, (_, i) => {
    const big = motionSeed(i, 7) > 0.85;
    const d = unit * (big ? 0.012 : 0.004 + motionSeed(i, 8) * 0.004);
    const dur = 3 + motionSeed(i, 9) * 5;
    return box({
      left: motionSeed(i, 10) * w * 1.1 - w * 0.05,
      top: motionSeed(i, 11) * h,
      width: d,
      height: d,
      round: true,
      fill: { kind: 'solid', color: p.hi },
      ...(big ? { halo: { blur: d * 2, spread: 0, color: p.hi, a: 0.8 } } : {}),
      anim: { name: 'twinkle', d: dur, dl: -motionSeed(i, 12) * dur },
    });
  });
  return [
    box({
      left: w * 0.45,
      top: -h * 0.4,
      width: w,
      height: h,
      fill: { kind: 'glow', color: p.b, a: 0.5 },
      anim: { name: 'wander', d: 40, x: -w * 0.2, y: h * 0.1 },
    }),
    { type: 'group', anim: { name: 'slide-x-neg', d: 90, x: -w * 0.05 }, children: stars },
  ];
}

// ── Retro Grid: a neon grid rolling toward a glowing horizon. ──────────────────────────────────
function RetroGrid({ w, h }: MotionSize, p: MotionPaint): MotionNode[] {
  const cell = Math.max(w, h) / 12;
  return [
    box({
      left: 0,
      top: h * 0.32,
      width: w,
      height: h * 0.4,
      fill: { kind: 'fade', color: p.hi, a: 0.6 },
    }),
    {
      type: 'grid',
      w,
      h,
      cell,
      line: Math.max(1.5, cell / 26),
      color: p.hi,
      a: 0.75,
      anim: { name: 'slide-y', d: 4, y: cell },
    },
  ];
}

// ── Bokeh: soft out-of-focus lights of many sizes floating and breathing. ──────────────────────
function Bokeh({ w, h }: MotionSize, p: MotionPaint): MotionNode[] {
  const unit = Math.min(w, h);
  return Array.from({ length: 16 }, (_, i) => {
    const d = unit * (0.08 + motionSeed(i, 13) * 0.26);
    const dur = 16 + motionSeed(i, 14) * 18;
    const c = [p.hi, p.cool, p.hi, p.warm, p.b][i % 5]!;
    return box({
      left: motionSeed(i, 15) * w - d / 2,
      top: motionSeed(i, 16) * h - d / 2,
      width: d,
      height: d,
      round: true,
      fill: { kind: 'bokeh', color: c },
      anim: {
        name: 'float',
        d: dur,
        dl: -motionSeed(i, 17) * dur,
        x: (motionSeed(i, 18) - 0.5) * w * 0.16,
        y: (motionSeed(i, 19) - 0.5) * h * 0.18,
      },
    });
  });
}

// ── Spotlight: a stage light sweeping across, a softer one answering it. ───────────────────────
function Spotlight({ w, h }: MotionSize, p: MotionPaint): MotionNode[] {
  const d = Math.max(w, h) * 0.9;
  return [
    box({
      left: -d / 2,
      top: -d * 0.35,
      width: d,
      height: d,
      fill: { kind: 'glow', color: p.hi, a: 0.55 },
      anim: { name: 'sweep', d: 14, x: w },
    }),
    box({
      left: w - d * 0.4,
      top: h - d * 0.55,
      width: d * 0.8,
      height: d * 0.8,
      fill: { kind: 'glow', color: p.b, a: 0.6 },
      anim: { name: 'sweep', d: 19, dl: -9, x: -w * 0.8 },
    }),
  ];
}

// ── Beams: tall shafts of light gliding past at a slant, one after another. ────────────────────
function Beams({ w, h }: MotionSize, p: MotionPaint): MotionNode[] {
  const bw = Math.max(w, h) * 0.14;
  return Array.from({ length: 5 }, (_, i) => {
    const dur = 11 + motionSeed(i, 20) * 7;
    return box({
      left: -bw * 2,
      top: -h * 0.4,
      width: bw * (0.5 + motionSeed(i, 21)),
      height: h * 1.8,
      fill: { kind: 'beam', color: p.hi, a: 0.22 + motionSeed(i, 22) * 0.12 },
      anim: { name: 'glide', d: dur, dl: -motionSeed(i, 23) * dur, x: w + bw * 4 },
    });
  });
}

// ── Sunburst: rays from below the slide turning slowly, fading out toward the edges. ───────────
function Sunburst({ w, h }: MotionSize, p: MotionPaint): MotionNode[] {
  const d = Math.hypot(w, h) * 2;
  return [
    {
      type: 'group',
      mask: 'from-below',
      children: [
        box({
          left: w / 2 - d / 2,
          top: h - d / 2,
          width: d,
          height: d,
          fill: { kind: 'rays', color: p.hi, a: 0.3 },
          anim: { name: 'turn', d: 80 },
        }),
      ],
    },
  ];
}

// ── Fireflies: small warm lights drifting on their own, glowing and fading. ────────────────────
function Fireflies({ w, h }: MotionSize, p: MotionPaint): MotionNode[] {
  const unit = Math.min(w, h);
  return Array.from({ length: 24 }, (_, i) => {
    const d = unit * (0.012 + motionSeed(i, 30) * 0.012);
    const dur = 7 + motionSeed(i, 31) * 9;
    const c = i % 3 === 0 ? p.warm : p.hi;
    return box({
      left: motionSeed(i, 32) * w,
      top: motionSeed(i, 33) * h,
      width: d,
      height: d,
      round: true,
      fill: { kind: 'solid', color: c },
      halo: { blur: d * 3, spread: d, color: c, a: 0.55 },
      anim: {
        name: 'float',
        d: dur,
        dl: -motionSeed(i, 34) * dur,
        x: (motionSeed(i, 35) - 0.5) * w * 0.12,
        y: (motionSeed(i, 36) - 0.5) * h * 0.16,
      },
    });
  });
}

// ── Snowfall: flakes of three sizes falling and drifting a little sideways. ────────────────────
function Snowfall({ w, h }: MotionSize, p: MotionPaint): MotionNode[] {
  const unit = Math.min(w, h);
  return Array.from({ length: 48 }, (_, i) => {
    const near = motionSeed(i, 40);
    const d = unit * (0.006 + near * 0.014);
    const dur = 18 - near * 10;
    return box({
      left: motionSeed(i, 41) * w,
      top: -d * 2,
      width: d,
      height: d,
      round: true,
      fill: { kind: 'solid', color: p.hi, a: 0.5 + near * 0.45 },
      anim: {
        name: 'fall',
        d: dur,
        dl: -motionSeed(i, 42) * dur,
        x: (motionSeed(i, 43) - 0.5) * w * 0.1,
        y: h + d * 4,
      },
    });
  });
}

// ── Lava: big soft blobs of the page's colours rising and sinking slowly. ──────────────────────
function Lava({ w, h }: MotionSize, p: MotionPaint): MotionNode[] {
  const unit = Math.max(w, h);
  const blobs = [
    { c: p.warm, x: 0.15, y: 0.7, s: 0.55 },
    { c: p.cool, x: 0.7, y: 0.25, s: 0.6 },
    { c: p.b, x: 0.45, y: 0.55, s: 0.5 },
    { c: p.hi, x: 0.85, y: 0.8, s: 0.35 },
    { c: p.warm, x: 0.3, y: 0.15, s: 0.4 },
  ];
  return blobs.map((b, i) =>
    box({
      left: w * b.x - (unit * b.s) / 2,
      top: h * b.y - (unit * b.s) / 2,
      width: unit * b.s,
      height: unit * b.s,
      fill: { kind: 'glow', color: b.c, a: 0.7 },
      anim: {
        name: 'float',
        d: 22 + i * 5,
        dl: -i * 4,
        x: (i % 2 ? -1 : 1) * w * 0.12,
        y: (i % 2 ? 1 : -1) * h * 0.3,
      },
    }),
  );
}

// ── Dot Wave: a grid of dots swelling in a wave that runs corner to corner. ────────────────────
function DotWave({ w, h }: MotionSize, p: MotionPaint): MotionNode[] {
  const cols = 14;
  const rows = Math.max(5, Math.round((cols * h) / w));
  const sx = w / cols;
  const sy = h / rows;
  const d = Math.min(sx, sy) * 0.22;
  const dots: MotionNode[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      dots.push(
        box({
          left: c * sx + sx / 2 - d / 2,
          top: r * sy + sy / 2 - d / 2,
          width: d,
          height: d,
          round: true,
          fill: { kind: 'solid', color: p.hi, a: 0.6 },
          // The wave: each dot a beat behind the one up and to its left.
          anim: { name: 'pulse', d: 5, dl: -((c + r) % 10) * 0.5 },
        }),
      );
    }
  }
  return dots;
}

// ── Clouds: soft wide clouds drifting across, the nearer ones faster. ──────────────────────────
function Clouds({ w, h }: MotionSize, p: MotionPaint): MotionNode[] {
  return Array.from({ length: 5 }, (_, i) => {
    const cw = w * (0.35 + motionSeed(i, 50) * 0.3);
    const dur = 50 - i * 6;
    return box({
      left: -cw,
      top: h * (0.05 + motionSeed(i, 51) * 0.6),
      width: cw,
      height: cw * 0.32,
      fill: { kind: 'fade', color: p.hi, a: 0.42 },
      anim: { name: 'slide-x', d: dur, dl: -motionSeed(i, 52) * dur, x: w + cw },
    });
  });
}

/** One wave's outline across two periods of `w`, so sliding it by `w` loops without a seam. */
export function wavePath(w: number, h: number, amp: number, base: number, periods: number): string {
  return `${waveLine(w, amp, base, periods)} V${h} H0 Z`;
}

/** A wave's crest line alone (a thread), across two periods of `w`. */
export function waveLine(w: number, amp: number, base: number, periods: number): string {
  const seg = w / periods;
  let d = `M0 ${base}`;
  for (let i = 0; i < periods * 2; i += 1) {
    const x = i * seg;
    const up = i % 2 === 0 ? -amp : amp;
    d += ` Q${x + seg / 2} ${base + up} ${x + seg} ${base}`;
  }
  return d;
}
