// When a finger on a phone board that shows one column a screen changes column (docs/specs/026-plan/plan-board.md
// "On a phone", "A column changes only on a swipe meant for it"): each touch settles its direction once, a touch that
// went down never changes column, and one that went across changes it only when it went far enough or was a flick,
// gliding back otherwise. Pure; usePhoneColumnSwipe runs it on the board's body.

// How far a touch moves before its direction is settled (blueprint DEFAULTS D61).
export const SWIPE_AXIS_SLOP_PX = 10;
// How many times further across than down a touch must go to count as across; a diagonal counts as down (D61).
export const SWIPE_AXIS_RATIO = 1.2;
// The share of a column's width a swipe goes to change column (D62).
export const SWIPE_COMMIT_SHARE = 0.28;
// A flick: this fast across at release, over at least SWIPE_FLICK_MIN_PX the same way (D62).
export const SWIPE_FLICK_PX_PER_MS = 0.45;
export const SWIPE_FLICK_MIN_PX = 24;
// How far back the release's speed is read, so a finger that stops before lifting is no flick.
export const SWIPE_VELOCITY_WINDOW_MS = 100;

// A touch's settled direction: across ('x'), down ('y'), or not yet (null, still inside the slop).
export type SwipeAxis = 'x' | 'y' | null;

export function swipeAxis(dx: number, dy: number): SwipeAxis {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < SWIPE_AXIS_SLOP_PX) return null;
  return ax > ay * SWIPE_AXIS_RATIO ? 'x' : 'y';
}

// Which way a released sideways swipe moves: 1 to the next column (the finger went left), -1 to the one before, or 0
// to glide back. `dx` and `dy` are the finger's travel since the touch began, `vx` its speed across at release
// (px/ms). A touch that set off across but ended more down than across (a thumb's arc into a scroll) glides back.
export function swipeStep(dx: number, dy: number, vx: number, columnWidth: number): -1 | 0 | 1 {
  if (swipeAxis(dx, dy) !== 'x') return 0;
  const far = columnWidth > 0 && Math.abs(dx) >= columnWidth * SWIPE_COMMIT_SHARE;
  const flick =
    Math.abs(vx) >= SWIPE_FLICK_PX_PER_MS &&
    Math.abs(dx) >= SWIPE_FLICK_MIN_PX &&
    Math.sign(vx) === Math.sign(dx);
  if (!far && !flick) return 0;
  return dx < 0 ? 1 : -1;
}

// The stop (a column's centred scrollLeft) nearest `left`.
export function nearestStop(stops: readonly number[], left: number): number {
  let best = 0;
  let bestGap = Infinity;
  stops.forEach((stop, i) => {
    const gap = Math.abs(stop - left);
    if (gap < bestGap) {
      best = i;
      bestGap = gap;
    }
  });
  return best;
}

// The scrollLeft a swipe from column `from` lands on: one column at most, never past either end (0 with no columns).
export function landingLeft(stops: readonly number[], from: number, step: -1 | 0 | 1): number {
  return stops[Math.max(0, Math.min(stops.length - 1, from + step))] ?? 0;
}

// The finger's recent positions across, for its speed at release: only the last SWIPE_VELOCITY_WINDOW_MS are kept,
// so the list stays a handful long however long the touch lasts.
export type SwipeSample = { t: number; x: number };

export function addSample(samples: SwipeSample[], t: number, x: number): void {
  samples.push({ t, x });
  // The first sample inside the window (the one just added always is), keeping at least two.
  const inside = samples.findIndex((s) => t - s.t <= SWIPE_VELOCITY_WINDOW_MS);
  const drop = Math.min(inside, samples.length - 2);
  if (drop > 0) samples.splice(0, drop);
}

// Its speed across (px/ms) at release time `now` over the kept samples: 0 with too few, no time between them, or a
// finger that held still for the window before lifting.
export function sampleVelocity(samples: readonly SwipeSample[], now: number): number {
  if (samples.length < 2) return 0;
  const first = samples[0]!;
  const last = samples[samples.length - 1]!;
  if (now - last.t > SWIPE_VELOCITY_WINDOW_MS) return 0;
  const dt = last.t - first.t;
  return dt > 0 ? (last.x - first.x) / dt : 0;
}
