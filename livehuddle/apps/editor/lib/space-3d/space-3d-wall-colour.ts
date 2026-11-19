// A tab's wall colour as the 3D view's wall properties (docs/specs/008-canvas/3d-view.md "Themes"): the face in the
// colour, its shade a third darker, its top edge a quarter lighter, a touch deeper in evening light on a dark canvas
// (its lightness down a tenth, never more than 0.06, so the chosen hue stays recognisable), and the ink drawn on a
// wall (a room's sign) dark or light, whichever reads at 4.5:1 on the face. Unset or not a colour, none: the walls
// keep space-3d.css's plaster. Pure, so the walls layer sets it as one style.
import { MIN_TEXT_CONTRAST, contrastRatio, mixHex } from '@livehuddle/document';

const BLACK = '#000000';
const WHITE = '#ffffff';
const DARK_INK = '#2b241d';
const LIGHT_INK = '#f7f3ec';
const SHADE = 1 / 3;
const TOP = 1 / 4;
// Evening light: the face's HSL lightness drops by a tenth of itself, capped at 0.06 of the scale. Mixing toward
// black keeps the hue and HSL saturation, so only the lightness moves. (mixHex weights its first colour by the share,
// so these amounts go through `toward`; passing them straight once left a red wall four fifths black in 3D Walk.)
const EVENING_SHARE = 1 / 10;
const EVENING_MAX_DROP = 0.06;
const HEX = /^#[0-9a-f]{6}$/i;

export type WallColourVars = {
  '--space-wall': string;
  '--space-wall-shade': string;
  '--space-wall-top': string;
  '--space-wall-ink': string;
};

// `color` moved `amount` of the way to `target`.
function toward(color: string, target: string, amount: number): string {
  return mixHex(color, target, 1 - amount);
}

// The share toward black that lowers `color`'s HSL lightness by a tenth, or by 0.06 where a tenth would be more.
function eveningShare(color: string): number {
  const n = Number.parseInt(color.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lightness = (Math.max(...channels) + Math.min(...channels)) / 2 / 255;
  return lightness === 0 ? 0 : Math.min(EVENING_SHARE, EVENING_MAX_DROP / lightness);
}

export function wallColourVars(
  color: string | undefined,
  darkCanvas: boolean,
): WallColourVars | undefined {
  if (!color || !HEX.test(color)) return undefined;
  const face = darkCanvas ? toward(color, BLACK, eveningShare(color)) : color.toLowerCase();
  // The ink that reads better: dark wherever it reaches 4.5:1, light on a wall too dark for it.
  const ink =
    contrastRatio(DARK_INK, face) >= Math.min(MIN_TEXT_CONTRAST, contrastRatio(LIGHT_INK, face))
      ? DARK_INK
      : LIGHT_INK;
  return {
    '--space-wall': face,
    '--space-wall-shade': toward(face, BLACK, SHADE),
    '--space-wall-top': toward(face, WHITE, TOP),
    '--space-wall-ink': ink,
  };
}
