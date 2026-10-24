// An ink readable on what it is drawn over (a table header's, a progress readout's): the ink is lifted or deepened
// until it meets WCAG AA on what is behind it. Pure; table headers and progress readouts read it.
import { contrastRatio, hexToRgb, MIN_TEXT_CONTRAST } from './colors';
import { mixHex } from './svg-render-face-kit';

// How far one step moves an ink toward white or black while it falls short.
const INK_STEP = 0.1;

// `ink` moved toward white (on a dark `behind`) or black (on a light one) until it reads at AA, keeping its hue as
// long as it can; the input when it already reads or cannot be parsed.
export function readableInk(ink: string, behind: string): string {
  if (!hexToRgb(ink) || !hexToRgb(behind)) return ink;
  if (contrastRatio(ink, behind) >= MIN_TEXT_CONTRAST) return ink;
  const toward =
    contrastRatio(behind, '#000000') > contrastRatio(behind, '#ffffff') ? '#000000' : '#ffffff';
  for (let t = INK_STEP; t < 1; t += INK_STEP) {
    const next = mixHex(toward, ink, t);
    if (contrastRatio(next, behind) >= MIN_TEXT_CONTRAST) return next;
  }
  return toward;
}
