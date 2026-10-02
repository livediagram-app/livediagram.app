// Text laid over a filled shape (docs/specs/020-import-export/drawio-import.md "Legible labels on own
// fills", blueprint step 15.8): draw.io groups a title onto a note or a label onto a panel as a
// separate text cell, drawn on that shape's fill rather than on the canvas. Such a text with no colour
// of its own takes the ink that reads on the nearest shape below it that holds it wholly.

import { isBoxed, type BoxedElement, type Element } from '@livediagram/document';
import { debugLog } from '@/lib/debug-log';
import { inkOnFill } from './vertex-props';

const holds = (outer: BoxedElement, inner: BoxedElement) =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  outer.x + outer.width >= inner.x + inner.width &&
  outer.y + outer.height >= inner.y + inner.height;

const ownFill = (el: BoxedElement): string | undefined => {
  const fill = (el as { fillColor?: string }).fillColor;
  return fill && fill.startsWith('#') ? fill : undefined;
};

/** The elements, each bare text over a filled shape given that fill's ink; the rest unchanged. */
export function inkOverFills(elements: Element[]): Element[] {
  return elements.map((el, i) => {
    if (el.type !== 'text' || el.textColor || !el.label) return el;
    for (let j = i - 1; j >= 0; j--) {
      const below = elements[j]!;
      if (!isBoxed(below) || below.type === 'text' || !holds(below, el)) continue;
      const ink = inkOnFill(ownFill(below));
      debugLog('[drawio-ink] text over fill', { id: el.id, ink: ink ?? 'theme' });
      return ink ? { ...el, textColor: ink } : el;
    }
    return el;
  });
}
