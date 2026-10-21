// Motion tokens as numbers (docs/specs/004-interface-design/motion.md), for code that
// needs milliseconds: exit holds, FLIP transitions, JS cascades. The same values are
// declared in theme.css as `--transition-duration-*`; a test keeps the two equal.

/** The three chrome durations. */
export const MOTION_MS = { micro: 150, short: 200, long: 250 } as const;

/** The most any chrome motion may take, delay included. */
export const MOTION_CEILING_MS = MOTION_MS.long;

/** The most a hover (or small fade) may take. */
export const MOTION_HOVER_CEILING_MS = MOTION_MS.micro;

/** The beat between two items of a cascade. */
export const MOTION_CASCADE_STEP_MS = 10;

/** The largest delay a cascade item takes: a `micro` item then lands by the ceiling. */
export const MOTION_CASCADE_CAP_MS = MOTION_MS.long - MOTION_MS.micro;

/** The entry delay of the item at `index` in a cascade. */
export function cascadeDelayMs(index: number): number {
  const i = Number.isNaN(index) ? 0 : Math.max(0, Math.floor(index));
  return Math.min(i * MOTION_CASCADE_STEP_MS, MOTION_CASCADE_CAP_MS);
}
