import * as THREE from 'three';

// Where the chip over a character's head sits in real 3D (docs/specs/008-canvas/3d-engine.md "Chips over heads"):
// the 3D scene measures how far the head (its hair, or a prop worn on it) rises over the feet as the camera draws it,
// and hands the overlay that height as `--avatar-head-rise`, so the chip stands clear of the head the scene really
// drew rather than of a constant figure height.

/** Air between the head's top and the chip's foot, canvas px. */
export const HEAD_CHIP_CLEAR = 3;

const a = new THREE.Vector3();
const b = new THREE.Vector3();

/**
 * How high the head's top stands over the feet on the screen, in the chip's own px (the overlay card's, before the
 * canvas's zoom and the card's flat scale): the feet at `ground` and the head's top `top` canvas px above them
 * projected through the scene's camera (`projection`, world to clip), their screen gap divided by the card's scale.
 * Null when either projects to nothing (behind the camera, or a degenerate view).
 */
export function headRisePx(
  projection: THREE.Matrix4,
  feet: { x: number; y: number },
  ground: number,
  top: number,
  viewHeight: number,
  cardScale: number,
): number | null {
  a.set(feet.x, feet.y, 0).applyMatrix4(projection);
  b.set(feet.x, feet.y, ground + top).applyMatrix4(projection);
  if (!Number.isFinite(a.y) || !Number.isFinite(b.y) || cardScale <= 0) return null;
  const screen = ((b.y - a.y) * viewHeight) / 2;
  return screen / cardScale + HEAD_CHIP_CLEAR;
}

/** Writes a figure's head rise to its box and its own chip box (a spread row's), only when it moved half a px. */
export function writeHeadRise(
  boxes: readonly HTMLElement[],
  rise: number | null,
  last: { rise: number | null },
): void {
  if (rise === null) {
    if (last.rise === null) return;
    last.rise = null;
    for (const el of boxes) el.style.removeProperty('--avatar-head-rise');
    return;
  }
  if (last.rise !== null && Math.abs(last.rise - rise) < 0.5) return;
  last.rise = rise;
  const v = `${rise.toFixed(1)}px`;
  for (const el of boxes) el.style.setProperty('--avatar-head-rise', v);
}
