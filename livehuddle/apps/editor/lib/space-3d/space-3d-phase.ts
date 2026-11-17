// The 3D view's phases (docs/specs/008-canvas/3d-view.md "Turning it on and off"; blueprint: 3d-view.md "Behaviour and
// state"): flat, rising (mounted flat, about to tilt), tilted, falling (flattening, about to unmount). Pure.

export type Space3DPhase = 'flat' | 'rising' | 'tilted' | 'falling';

/**
 * The phase after `phase` when the view is (or is not) wanted. `settled` is the timer or frame the phase waits on
 * having passed (two frames for `rising`, the tilt's length for `falling`); reduced motion skips both waits.
 */
export function nextSpace3DPhase(
  phase: Space3DPhase,
  want: boolean,
  { reducedMotion = false, settled = false }: { reducedMotion?: boolean; settled?: boolean } = {},
): Space3DPhase {
  switch (phase) {
    case 'flat':
      return want ? (reducedMotion ? 'tilted' : 'rising') : 'flat';
    case 'rising':
      if (!want) return 'flat';
      return settled || reducedMotion ? 'tilted' : 'rising';
    case 'tilted':
      return want ? 'tilted' : reducedMotion ? 'flat' : 'falling';
    case 'falling':
      if (want) return 'tilted';
      return settled || reducedMotion ? 'flat' : 'falling';
  }
}
