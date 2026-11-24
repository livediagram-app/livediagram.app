// The Magnifier lens's arithmetic (docs/specs/008-canvas/blueprints/magnifier.md "Interfaces and contracts"),
// pure so it is tested without a browser: where the lens sits for a pointer, where its enlarged copy of the canvas
// sits inside it, and what a wheel turn changes.

import { clampSize, clampZoom, type MagnifierConfig } from '@/lib/magnifier-config';

// The gap between a fingertip and the bottom of the lens above it (blueprint D133).
export const TOUCH_LIFT_PX = 24;

// How far a wheel turn moves the magnification: exp(-delta / this), so a mouse notch (~100) is about 28%.
const ZOOM_WHEEL_SCALE = 400;
// How many lens pixels one wheel pixel moves the size.
const SIZE_WHEEL_RATE = 0.5;

export type LensPlacement = {
  // The lens's top-left corner, relative to the canvas surface (<main>).
  left: number;
  top: number;
  // The enlarged copy's offset inside the lens: the canvas point under the pointer lands at the lens's centre.
  stageX: number;
  stageY: number;
};

export function lensPlacement({
  x,
  y,
  size,
  zoom,
  touch,
}: {
  // The pointer, relative to <main>.
  x: number;
  y: number;
  size: number;
  zoom: number;
  // A finger: the lens sits above it (below when there is no room), so the finger never covers it.
  touch: boolean;
}): LensPlacement {
  const half = size / 2;
  const left = x - half;
  let top = y - half;
  if (touch) {
    top = y - size - TOUCH_LIFT_PX;
    if (top < 0) top = y + TOUCH_LIFT_PX;
  }
  return { left, top, stageX: half - x * zoom, stageY: half - y * zoom };
}

// What one wheel event changes while the lens is up: the magnification, or with Shift the size. A Shift wheel on
// some mice reports its turn as deltaX, so either axis counts.
export function wheelChange(
  config: MagnifierConfig,
  e: { deltaX: number; deltaY: number; shiftKey: boolean },
): Partial<MagnifierConfig> {
  if (e.shiftKey) {
    const delta = e.deltaY || e.deltaX;
    return { size: clampSize(config.size - delta * SIZE_WHEEL_RATE) };
  }
  return { zoom: clampZoom(config.zoom * Math.exp(-e.deltaY / ZOOM_WHEEL_SCALE)) };
}
