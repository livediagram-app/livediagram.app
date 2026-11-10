// The colour maths (a written colour to channels, contrast, tint and shade, the paper a colour amounts to): one
// copy for every product, @liveworkspace/element-model/colour-math.
export * from '@liveworkspace/element-model/colour-math';
// The element defaults (the colours, padding and controls an element has when it stores none): one table for every
// product, @liveworkspace/element-model/element-colours. What is livediagram's own wraps them below.
export * from '@liveworkspace/element-model/element-colours';
import type { CanvasSurface } from '@liveworkspace/element-model/colour-math';
import {
  acceptsInlineIcon as acceptsInlineIconOf,
  DARK_INK,
  defaultFillColor as fillOf,
  defaultStrokeColor as strokeOf,
  defaultTextColor as textOf,
  OUTLINE_SKIN_LIGHT,
  positionsInlineIcon as positionsInlineIconOf,
  type ElementSkin,
} from '@liveworkspace/element-model/element-colours';
import type { BoxedElement, Element, ShapeElement, ShapeKind } from './index';
import { hasOwnFace } from './collab-shapes';
import { isRetiredElement } from './retired-elements';

const ownFace = (kind: string) => hasOwnFace(kind as ShapeKind);

// A retired piece (docs/specs/009-elements/retired-elements.md) draws its own placeholder card: no box, ink from the
// paper. Asked first, so an Avatar button (a mode-button kind) loses the button skin too.
function retiredSkin(element: BoxedElement, surface: CanvasSurface): ElementSkin | null {
  if (!isRetiredElement(element)) return null;
  return surface === 'dark'
    ? { fill: 'transparent', stroke: 'transparent', text: DARK_INK.text }
    : { fill: 'transparent', stroke: 'transparent', text: OUTLINE_SKIN_LIGHT.text };
}

export function defaultTextColor(element: BoxedElement, surface: CanvasSurface = 'light'): string {
  return retiredSkin(element, surface)?.text ?? textOf(element, surface);
}

export function defaultFillColor(element: BoxedElement, surface: CanvasSurface = 'light'): string {
  return retiredSkin(element, surface)?.fill ?? fillOf(element, surface);
}

export function defaultStrokeColor(
  element: BoxedElement,
  surface: CanvasSurface = 'light',
): string {
  return retiredSkin(element, surface)?.stroke ?? strokeOf(element, surface);
}

// The Behaviour and Collaborate elements that draw their own face (hasOwnFace: the collaboration cards, the buttons,
// the picker, the reveal cover, a retired piece...) never render an inline icon, so one folded in would be invisible.
export function acceptsInlineIcon(element: Element): element is ShapeElement {
  return acceptsInlineIconOf(element, ownFace);
}

/** Whether a shape's inline icon goes where `iconPosition` says, so offering that choice does something. */
export function positionsInlineIcon(element: Element): boolean {
  return positionsInlineIconOf(element, ownFace);
}
