// The animated backgrounds (docs/specs/007-editor/pages-mode.md "Animated backgrounds" in
// livedocuments and livedesign, a form's cover in liveplanner: docs/specs/030-forms/forms.md "The form
// card, top to bottom", Cover) as data: every motion's moving parts, where each sits, what it is
// painted with and how it moves. Pure, so every place that draws a motion reads the same parts: each
// product's motion layer (components/canvas/PageMotionLayer.tsx, moving) and, where a product
// exports pages, its PNG / PDF export (lib/page-motion-canvas.ts, still, as the page opens). Each
// product's lib/page-motion-parts.ts binds this module.
//
// Kept cheap and calm: every part moves by transform and opacity alone, soft edges are radial
// gradients rather than blur filters, each motion has at most about a hundred parts, and loops run
// 4 to 90 seconds. Positions come from fixed seeds, so a background looks the same wherever it is opened.
import type { PageMotion } from './index';
import type { MotionPaint } from './motion-paint';
import { Confetti, Equaliser, Orbits, Radar, Threads, Warp } from './motion-parts-page-four';
import {
  Flow,
  Drift,
  Aurora,
  Ripple,
  Ribbons,
  Waves,
  Mesh,
  Starfield,
  RetroGrid,
  Bokeh,
  Spotlight,
  Beams,
  Sunburst,
  Fireflies,
  Snowfall,
  Lava,
  DotWave,
  Clouds,
} from './motion-parts-first-pages';
export { wavePath, waveLine } from './motion-parts-first-pages';

/** The loops a part runs, one per keyframes in each app's app/motion-page.css (`pm-<name>`). */
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
