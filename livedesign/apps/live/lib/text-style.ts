// Switching a text's style (docs/specs/008-canvas/canvas-and-palette.md "Text styles"): the Text menu's Text Style
// writes the style's size, weight, slant and box (applyTextPreset), then hugs the box to the words at that size in
// the same step, so a Paragraph turned into a Heading is a heading's box at once, never a frame late. The measuring
// is the DOM's (text-hug-measure.ts), handed in, so this stays pure.

import {
  applyTextPreset,
  type Element,
  type TextElement,
  type TextPresetId,
} from '@livedesign/design';
import { hugsText, hugTextSize, type MeasureTextBlock } from '@/lib/text-hug';

/** The mapper a Text Style row previews and commits over the selection: a text restyled and re-hugged; anything else
 *  as it was. */
export function restyleTextAs(
  id: TextPresetId,
  measure: (el: TextElement) => MeasureTextBlock,
): (el: Element) => Element {
  return (el) => {
    const next = applyTextPreset(el, id);
    if (next === el || !hugsText(next)) return next;
    return { ...next, ...hugTextSize(next, measure(next)) };
  };
}
