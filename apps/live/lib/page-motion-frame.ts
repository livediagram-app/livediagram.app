// Where a slide's animated background stands as the slide opens (docs/specs/007-editor/
// illustrate-pages.md "Animated backgrounds"): each part's loop in app/motion-page.css, evaluated
// at its start. The export draws this still, the first frame anyone sees, rather than the bare
// gradient. Pure: the keyframes are restated here as numbers, and a test keeps the two in step.
import type { MotionAnim } from './page-motion-parts';

/** A part's pose: moved by (tx, ty), scaled and turned (degrees) about its centre, at an opacity. */
export type MotionPose = { tx: number; ty: number; scale: number; rotate: number; opacity: number };

const REST: MotionPose = { tx: 0, ty: 0, scale: 1, rotate: 0, opacity: 1 };

type Easing = (t: number) => number;
const linear: Easing = (t) => t;
const easeInOut = cubicBezier(0.42, 0, 0.58, 1);
const spreadOut = cubicBezier(0.2, 0.6, 0.4, 1);

/** How far into its loop a part is as the slide opens: its start is at or below zero, so the slide
 *  opens that far in. The slide's speed divides both the length and the start, so it cancels.
 *  `reversed` is an alternate loop on its way back. */
export function openingPhase(anim: Pick<MotionAnim, 'd' | 'dl'>): {
  p: number;
  reversed: boolean;
} {
  if (!(anim.d > 0)) return { p: 0, reversed: false };
  const elapsed = Math.max(0, -(anim.dl ?? 0)) / anim.d;
  const loops = Math.floor(elapsed);
  return { p: elapsed - loops, reversed: loops % 2 === 1 };
}

/** A part's pose as the slide opens. */
export function openingPose(anim: MotionAnim | undefined): MotionPose {
  if (!anim) return REST;
  const { p, reversed } = openingPhase(anim);
  return poseAt(anim, anim.name === 'sweep' && reversed ? 1 - p : p);
}

/** A part's pose at `p` (0 to 1) through its loop. */
export function poseAt(anim: MotionAnim, p: number): MotionPose {
  const x = anim.x ?? 0;
  const y = anim.y ?? 0;
  switch (anim.name) {
    case 'slide-x':
    case 'slide-x-neg':
      return { ...REST, tx: x * p };
    case 'slide-x-back':
      return { ...REST, tx: x * (1 - p) };
    case 'slide-y':
      return { ...REST, ty: y * p };
    case 'fall':
      return { ...REST, tx: x * p, ty: y * p };
    case 'turn':
      return { ...REST, rotate: 360 * p };
    case 'glide':
      return { ...REST, tx: x * p, rotate: 18 };
    case 'sweep':
      return { ...REST, tx: x * easeInOut(p) };
    case 'rise':
      return {
        ...REST,
        ty: y * p,
        scale: 0.8 + 0.3 * p,
        opacity: track([0, 0], [0.15, 1], [0.7, 0.8], [1, 0])(p, linear),
      };
    case 'wander': {
      const at = (vals: readonly number[]) =>
        track(...vals.map((v, i) => [i / 4, v] as const))(p, easeInOut);
      return { ...REST, tx: at([0, x, x * 0.4, -x * 0.8, 0]), ty: at([0, -y, y, y * 0.3, 0]) };
    }
    case 'spread':
      return {
        ...REST,
        scale: 0.05 + 0.95 * spreadOut(p),
        opacity: track([0, 0], [0.12, 1], [1, 0])(p, spreadOut),
      };
    case 'twinkle':
      return {
        ...REST,
        scale: track([0, 0.7], [0.5, 1], [1, 0.7])(p, easeInOut),
        opacity: track([0, 0.25], [0.5, 1], [1, 0.25])(p, easeInOut),
      };
    case 'float':
      return {
        ...REST,
        tx: track([0, 0], [0.5, x], [1, 0])(p, easeInOut),
        ty: track([0, 0], [0.5, y], [1, 0])(p, easeInOut),
        scale: track([0, 1], [0.5, 1.12], [1, 1])(p, easeInOut),
        opacity: track([0, 0.75], [0.5, 1], [1, 0.75])(p, easeInOut),
      };
    case 'pulse':
      return {
        ...REST,
        scale: track([0, 0.55], [0.5, 1.15], [1, 0.55])(p, easeInOut),
        opacity: track([0, 0.35], [0.5, 1], [1, 0.35])(p, easeInOut),
      };
  }
}

// One property through its keyframes (offset, value), eased within each step as CSS eases them.
function track(...frames: (readonly [number, number])[]) {
  return (p: number, ease: Easing): number => {
    for (let i = 1; i < frames.length; i += 1) {
      const [o1, v1] = frames[i]!;
      const [o0, v0] = frames[i - 1]!;
      if (p <= o1) return v0 + (v1 - v0) * ease(o1 > o0 ? (p - o0) / (o1 - o0) : 1);
    }
    return frames[frames.length - 1]![1];
  };
}

/** CSS's cubic-bezier(x1, y1, x2, y2) timing: the curve's y where its x is t. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const at = (a: number, b: number, s: number) =>
    3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    // x(s) rises monotonically for CSS's curves (x1, x2 in 0..1), so halving finds s.
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i += 1) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < t) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}
