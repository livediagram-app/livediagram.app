// What a text colour picker judges its colours against (docs/specs/004-interface-design/
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
  type TextGround,
} from '@livedesign/design';
import { textGroundMemo, type GroundOf, type ProbeTab } from './text-ground-memo';

export type TextContrastProbe = {
  ground: TextGround;
  large: boolean;
  // Judged on the page as it exports, not as drawn: a page ground on a dark canvas, whose plain paper is
  // drawn dark but exports white.
  exported: boolean;
  // The label's colour as drawn on its ground; null when it can't be read.
  current: string | null;
  // A swatch's colour as it would be drawn there: a stock name in its version for the ground.
  colourOf: (id: string) => string | null;
};

/** The Text row's probe for `el`, or null where nothing can be judged (a picture, off every page). */
export function textContrastProbe(
  el: Element,
  tab: ProbeTab,
  surface: CanvasSurface,
  groundOf: GroundOf = textGroundOf,
): TextContrastProbe | null {
  if (!isBoxed(el)) return null;
  const ground = groundOf(el, tab, surface);
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
    exported: surface === 'dark' && ground.on === 'page',
    current,
    colourOf,
  };
}

/**
 * The probes for every element of `els` whose ground can be judged (several grounds: the worst counts),
 * each ground memoised in `memo`; undefined when none can be judged.
 */
export function textContrastProbes(
  els: readonly Element[],
  tab: ProbeTab,
  surface: CanvasSurface,
  memo: ReturnType<typeof textGroundMemo> = textGroundMemo(),
): TextContrastProbe[] | undefined {
  const groundOf = memo.batch();
  const probes: TextContrastProbe[] = [];
  for (const el of els) {
    const probe = textContrastProbe(el, tab, surface, groundOf);
    if (probe) probes.push(probe);
  }
  return probes.length > 0 ? probes : undefined;
}
