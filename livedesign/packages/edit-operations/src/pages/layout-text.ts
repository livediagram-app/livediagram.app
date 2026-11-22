// A layout's text slots on a livedesign page (docs/specs/024-agents/pages-for-agents.md "Text slots"): the slots
// read from the layout as built, and the change's words written into them, through the code livedocuments' slides
// share (@liveworkspace/edit-operations/layout-slots). A wireframe's and a logo's texts wrap in their own boxes, so a
// slot's words are set as given.
import {
  fillLayoutSlots,
  layoutSlots,
  type LayoutText,
  type LayoutTextSlot,
  type SlotElement,
} from '@liveworkspace/edit-operations/layout-slots';
import { labelFontPx, type Element, type TextSize } from '@livedesign/design';

/** The px a text's words draw at: its size, scaled. */
export function textPxOf(el: SlotElement): number {
  const { textSize, textScale } = el as { textSize?: TextSize; textScale?: unknown };
  return labelFontPx(textSize) * (typeof textScale === 'number' ? textScale : 1);
}

const relabel = (el: Element, label: string): Element => ({ ...el, label });

/** The layout's elements with the change's words in their slots, the lines for what they could not hold, and the
 *  slots of the texts left. */
export function layoutTextOf(
  built: readonly Element[],
  text: LayoutText | undefined,
): { elements: Element[]; lines: string[]; slots: LayoutTextSlot[] } {
  if (!text)
    return {
      elements: [...built],
      lines: [],
      slots: layoutSlots(built, textPxOf).map((s) => ({ ...s, sample: true as const })),
    };
  return fillLayoutSlots(built, text, textPxOf, relabel);
}
