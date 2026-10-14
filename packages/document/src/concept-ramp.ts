// A concept graphic's colours (docs/specs/009-elements/concept-graphics.md "Colours"): kept apart from concept.ts,
// which the validator and the shape factory load early, because the readable-colour helpers sit in an import cycle
// with them.

import { mixHex } from './color-wash';
import { labelOn } from './readable-colour';

const RAMP_FLOOR = 0.22;

/** Each row's fill (the accent for the first, mixing toward the element's fill down to 22% accent for the last) and the
 *  text that reads on it. */
export function conceptRamp(
  n: number,
  accent: string,
  fill: string,
): { fill: string; text: string }[] {
  return Array.from({ length: n }, (_, i) => {
    const share = 1 - (1 - RAMP_FLOOR) * (i / Math.max(1, n - 1));
    const rowFill = mixHex(accent, fill, share);
    return { fill: rowFill, text: labelOn(rowFill) };
  });
}
