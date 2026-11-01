// A concept graphic's colours (docs/specs/009-elements/concept-graphics.md "Colours"): kept apart from concept.ts,
// which the validator and the shape factory load early, because the readable-colour helpers sit in an import cycle
// with them.

import { mixHex } from '@liveworkspace/model-core/color-wash';
import { contrastRatio } from './colors';
import { THEME_TEXT_CONTRAST, labelOn } from './readable-colour';

const HEX = /^#[0-9a-f]{6}$/i;

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

/** The ink for words on a disc drawn in the element's own fill (a cycle's later stages, a hub's satellites): the
 *  element's ink where it reads on that fill, else the label that reads on the fill, as the ramp's own discs take.
 *  The ink is picked for the canvas, since it also writes a cycle's centre words there, so a pale fill on the dark
 *  canvas sank the stage names. */
export function conceptDiscInk(ink: string, fill: string): string {
  if (!HEX.test(ink) || !HEX.test(fill)) return ink;
  return contrastRatio(ink, fill) >= THEME_TEXT_CONTRAST ? ink : labelOn(fill);
}
