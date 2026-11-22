// A layout's text slots on a livedocuments page (docs/specs/024-agents/pages-for-agents.md "Text slots"): the slots
// read from the layout as built, and the change's words written into them, through the code livedesign's layouts
// share (@liveworkspace/edit-operations/layout-slots). A headline given longer words is refitted as the layout fits
// its own.
import {
  fillLayoutSlots,
  layoutSlots,
  type LayoutText,
  type LayoutTextSlot,
  type SlotElement,
} from '@liveworkspace/edit-operations/layout-slots';
import { labelFontPx, type Element, type TextSize } from '@livedocuments/document';
import { headlineTextScale } from '@livedocuments/templates';

/** The px a text's words draw at: its size, scaled. */
export function textPxOf(el: SlotElement): number {
  const { textSize, textScale } = el as { textSize?: TextSize; textScale?: unknown };
  return labelFontPx(textSize) * (typeof textScale === 'number' ? textScale : 1);
}

// A headline the layout kit fitted to its box (large type, scaled, centred down its box): refitted to its new words,
// never grown past the layout's own size.
function relabel(el: Element, label: string, slot: string): Element {
  const fields = el as { textSize?: unknown; textScale?: unknown; textAlignY?: unknown };
  const headline =
    slot === 'title' &&
    el.type === 'text' &&
    fields.textSize === 'lg' &&
    typeof fields.textScale === 'number' &&
    fields.textAlignY === 'middle';
  if (!headline) return { ...el, label };
  const fitted = headlineTextScale(el.width, el.height, label);
  return { ...el, label, textScale: Math.min(fields.textScale as number, fitted) };
}

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
