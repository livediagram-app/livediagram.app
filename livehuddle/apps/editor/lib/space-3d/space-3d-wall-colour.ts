// A tab's wall colour as the 3D view's wall properties (docs/specs/008-canvas/3d-view.md "Themes"): the face in the
// colour, its shade a third darker, its top edge a quarter lighter, a fifth deeper in evening light on a dark canvas,
// and the ink drawn on a wall (a room's sign) dark or light, whichever reads at 4.5:1 on the face. Unset or not a
// colour, none: the walls keep space-3d.css's plaster. Pure, so the walls layer sets it as one style.
import { MIN_TEXT_CONTRAST, contrastRatio, mixHex } from '@livehuddle/document';

const BLACK = '#000000';
const WHITE = '#ffffff';
const DARK_INK = '#2b241d';
const LIGHT_INK = '#f7f3ec';
const SHADE = 1 / 3;
const TOP = 1 / 4;
const EVENING = 1 / 5;
const HEX = /^#[0-9a-f]{6}$/i;

export type WallColourVars = {
  '--space-wall': string;
  '--space-wall-shade': string;
  '--space-wall-top': string;
  '--space-wall-ink': string;
};

export function wallColourVars(
  color: string | undefined,
  darkCanvas: boolean,
): WallColourVars | undefined {
  if (!color || !HEX.test(color)) return undefined;
  const face = darkCanvas ? mixHex(color, BLACK, EVENING) : color.toLowerCase();
  // The ink that reads better: dark wherever it reaches 4.5:1, light on a wall too dark for it.
  const ink =
    contrastRatio(DARK_INK, face) >= Math.min(MIN_TEXT_CONTRAST, contrastRatio(LIGHT_INK, face))
      ? DARK_INK
      : LIGHT_INK;
  return {
    '--space-wall': face,
    '--space-wall-shade': mixHex(face, BLACK, SHADE),
    '--space-wall-top': mixHex(face, WHITE, TOP),
    '--space-wall-ink': ink,
  };
}
