// People arrows (docs/specs/008-canvas/people-arrows.md "Motion"): one arrow's easing per frame. The position and the
// turn ease towards where the arrow should be (time-based, so a slow frame catches up rather than lagging); the scale
// is a lightly damped spring, so an arrival overshoots a touch; the opacity eases. Reduced motion snaps everything.

/** Where an arrow wants to be this frame. `shown` false means it is leaving (its person came into view). */
export type ArrowGoal = {
  x: number;
  y: number;
  angle: number;
  scale: number;
  opacity: number;
  shown: boolean;
};

export type ArrowMotion = {
  x: number;
  y: number;
  angle: number;
  scale: number;
  scaleVelocity: number;
  opacity: number;
  /** False until the arrow has first been placed: it then starts where it should be, small and clear. */
  placed: boolean;
};

const GLIDE_MS = 110; // the position's and the turn's time constant
const FADE_MS = 90;
const SPRING_STIFFNESS = 420; // per s², the scale spring
const SPRING_DAMPING = 24; // per s: under-damped, about a 6% overshoot
const ENTER_SCALE = 0.45;
const LEAVE_SCALE = 0.55;
const MAX_DT_MS = 64; // a frame after a stall eases as if it were four, never a jump

export function restingMotion(): ArrowMotion {
  return { x: 0, y: 0, angle: 0, scale: ENTER_SCALE, scaleVelocity: 0, opacity: 0, placed: false };
}

/** The signed shortest turn from `from` to `to`, radians in (-π, π]. */
export function shortestTurn(from: number, to: number): number {
  let d = (to - from) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

const ease = (dtMs: number, tauMs: number) => 1 - Math.exp(-dtMs / tauMs);

/**
 * One frame of an arrow's motion, in place. Answers whether it is still moving: false once it has settled (it then
 * sits exactly on the goal), so the frame loop can stop.
 */
export function stepArrow(
  m: ArrowMotion,
  goal: ArrowGoal,
  dtMs: number,
  reduced: boolean,
): boolean {
  const targetScale = goal.shown ? goal.scale : LEAVE_SCALE;
  const targetOpacity = goal.shown ? goal.opacity : 0;
  if (!m.placed) {
    if (!goal.shown) return false;
    m.placed = true;
    m.x = goal.x;
    m.y = goal.y;
    m.angle = goal.angle;
    m.scale = reduced ? targetScale : ENTER_SCALE;
    m.scaleVelocity = 0;
    m.opacity = reduced ? targetOpacity : 0;
    return !reduced;
  }
  if (reduced) {
    // Position and opacity only, at once.
    m.x = goal.x;
    m.y = goal.y;
    m.angle = goal.angle;
    m.scale = targetScale;
    m.scaleVelocity = 0;
    m.opacity = targetOpacity;
    if (!goal.shown) m.placed = false;
    return false;
  }
  const dt = Math.min(Math.max(dtMs, 0), MAX_DT_MS);
  // A leaving arrow stays where it was: it shrinks and fades at the edge rather than chasing its person inwards.
  if (goal.shown) {
    const k = ease(dt, GLIDE_MS);
    m.x += (goal.x - m.x) * k;
    m.y += (goal.y - m.y) * k;
    m.angle += shortestTurn(m.angle, goal.angle) * k;
  }
  const s = dt / 1000;
  const accel = SPRING_STIFFNESS * (targetScale - m.scale) - SPRING_DAMPING * m.scaleVelocity;
  m.scaleVelocity += accel * s;
  m.scale += m.scaleVelocity * s;
  m.opacity += (targetOpacity - m.opacity) * ease(dt, FADE_MS);

  const settled =
    (!goal.shown ||
      (Math.abs(goal.x - m.x) < 0.1 &&
        Math.abs(goal.y - m.y) < 0.1 &&
        Math.abs(shortestTurn(m.angle, goal.angle)) < 0.002)) &&
    Math.abs(targetScale - m.scale) < 0.002 &&
    Math.abs(m.scaleVelocity) < 0.01 &&
    Math.abs(targetOpacity - m.opacity) < 0.004;
  if (!settled) return true;
  if (goal.shown) {
    m.x = goal.x;
    m.y = goal.y;
    m.angle = goal.angle;
  } else {
    // Gone: the next arrival grows in afresh where it should be.
    m.placed = false;
  }
  m.scale = targetScale;
  m.scaleVelocity = 0;
  m.opacity = targetOpacity;
  return false;
}
