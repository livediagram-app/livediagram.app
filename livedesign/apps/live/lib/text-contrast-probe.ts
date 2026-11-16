// What the element menu's Text row judges its colours against (docs/specs/004-interface-design/
// colour-picker.md "Reading on its ground"): the ground under the label, whether it is large text, the
// colour it is drawn in now, and how each swatch would be drawn there. Pure.
import {
  canvasSurface,
  defaultTextColor,
  isBoxed,
  isHexColour,
  isLargeText,
  isPenColourName,
  labelDrawnPx,
  labelIsBold,
  penColourHex,
  textGroundOf,
  type CanvasSurface,
  type Element,
  type Tab,
  type TextGround,
} from '@livedesign/design';

export type TextContrastProbe = {
  ground: TextGround;
  large: boolean;
  // The label's colour as drawn on its ground; null when it can't be read.
  current: string | null;
  // A swatch's colour as it would be drawn there: a stock name in its version for the ground.
  colourOf: (id: string) => string | null;
};

type ProbeTab = Pick<Tab, 'elements' | 'layers'> & { pages?: unknown; pageOrientation?: unknown };

/** The Text row's probe for `el`, or null where nothing can be judged (a picture, off every page). */
export function textContrastProbe(
  el: Element,
  tab: ProbeTab,
  surface: CanvasSurface,
): TextContrastProbe | null {
  if (!isBoxed(el)) return null;
  const ground = textGroundOf(el, tab, surface);
  if (!ground) return null;
  // Stock colours are tuned per paper: judged in the version for a ground of this lightness.
  const board = canvasSurface(ground.tones[0]);
  const colourOf = (id: string): string | null => {
    if (isPenColourName(id)) return penColourHex(id, board);
    return isHexColour(id) ? id.toLowerCase() : null;
  };
  const own = el as { textColor?: string; penTextColour?: string };
  const current =
    own.textColor !== undefined
      ? colourOf(own.textColor)
      : own.penTextColour !== undefined
        ? colourOf(own.penTextColour)
        : colourOf(defaultTextColor(el, board));
  return {
    ground,
    large: isLargeText(labelDrawnPx(el), labelIsBold(el)),
    current,
    colourOf,
  };
}
