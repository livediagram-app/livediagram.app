// A mind node grows to fit its label (docs/specs/009-elements/mind-node.md "A node grows to fit
// its label"). The geometry around a measured block of text: the size the label is laid out at,
// the padding around it, and the height the node needs. The measuring is the DOM's
// (components/canvas/text-hug-measure.ts), handed in as a function, as for a hugging text box;
// growing the node and keeping its map tidy is the document package's (fitMindNodeHeight).

import {
  labelFontPx,
  PADDING_PX,
  defaultPadding,
  fitMindNodeHeight,
  isMindNode,
  type Element,
  type ElementId,
  type ShapeElement,
} from '@liveplanner/document';
import type { MeasureTextBlock } from '@/lib/text-hug';

// The px a mind node's label is laid out at: its size preset's fixed px. Auto ('scale') draws
// fitted to the box once committed, but is typed at the middling fixed px, which is what has to
// fit while typing, so it is measured at that.
export function mindLabelFontPx(el: ShapeElement): number {
  return labelFontPx(el.textSize ?? 'scale');
}

// Canvas px between the node's edge and its label, on every side (as BoxedElementView pads it).
export function mindLabelPadding(el: ShapeElement): number {
  return PADDING_PX[el.padding ?? defaultPadding(el)];
}

// The height the node needs for its label: the lines laid out at the node's width less its
// padding, plus the padding above and below, rounded up to a whole pixel.
export function mindLabelHeight(el: ShapeElement, measure: MeasureTextBlock): number {
  const pad = mindLabelPadding(el);
  const block = measure(Math.max(1, el.width - 2 * pad), true);
  return Math.ceil(block.height) + 2 * pad;
}

// `elements` with mind node `id` grown to fit its label as it now stands (a no-op for anything
// else, and for a label that already fits). Runs inside a commit, after the label is written.
export function fitMindLabel(
  elements: Element[],
  id: ElementId,
  measureFor: (el: ShapeElement) => MeasureTextBlock,
): Element[] {
  const el = elements.find((e) => e.id === id);
  if (!el || !isMindNode(el)) return elements;
  return fitMindNodeHeight(elements, id, mindLabelHeight(el, measureFor(el)));
}
