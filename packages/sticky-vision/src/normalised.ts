// Its own module, apart from the detector in detect.ts: the editor's photo draft reads a sticky's place with it on
// every load, and importing it from detect.ts drew the whole detector into the editor's first load.
import type { DetectedSticky } from './detect';

// The detector works in working-image pixels; the reconciler wants them
// normalised, so a downscale (or a different phone) means the same thing. BOTH
// axes are fractions of the image's WIDTH: the reconciler carries photo space
// onto the board with one scale, and a y in fractions of the height stretched
// every landscape wall's rows apart by its aspect ratio (docs/specs/021-event-storming/event-storming.md).
export function toNormalised(
  sticky: DetectedSticky,
  image: { width: number; height: number },
): { cx: number; cy: number; w: number; h: number } {
  return {
    cx: (sticky.x + sticky.w / 2) / image.width,
    cy: (sticky.y + sticky.h / 2) / image.width,
    w: sticky.w / image.width,
    h: sticky.h / image.width,
  };
}
