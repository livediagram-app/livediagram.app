// Factories for every element type EXCEPT shapes, one copy for every product in
// @liveworkspace/element-model/factories, typed here as this product's elements. The shape kind table and
// createShape live in './shape-factory', re-exported here so every `from './factories'` import and the
// package barrel resolve exactly as before. Function declarations, so a module that
// reads one while the package's index cycle settles finds it bound.
import * as shared from '@liveworkspace/element-model/factories';
import type {
  Anchor,
  AnnotationElement,
  ArrowElement,
  Element,
  ElementId,
  EmbedProvider,
  FreehandElement,
  ImageElement,
  LinkCardElement,
  StickyElement,
  TableElement,
  TextElement,
  VideoElement,
} from './index';

export { SHAPE_DEFAULT_SIZE, createShape } from './shape-factory';

export function createText(x: number, y: number): TextElement {
  return shared.createText(x, y);
}

export function createTable(x: number, y: number): TableElement {
  return shared.createTable(x, y);
}

export function createSticky(x: number, y: number): StickyElement {
  return shared.createSticky(x, y);
}

export function createAnnotation(x: number, y: number): AnnotationElement {
  return shared.createAnnotation(x, y);
}

export function createLinkCard(x: number, y: number): LinkCardElement {
  return shared.createLinkCard(x, y);
}

export function createVideo(x: number, y: number, provider?: EmbedProvider): VideoElement {
  return shared.createVideo(x, y, provider);
}

export function scaleElements(elements: Element[], ox: number, oy: number, s: number): Element[] {
  return shared.scaleElements(elements, ox, oy, s);
}

export function createImage(x: number, y: number): ImageElement {
  return shared.createImage(x, y);
}

export function createFreehand(
  rawPoints: readonly { x: number; y: number }[],
  closed: boolean,
  pressures?: readonly number[],
): FreehandElement {
  return shared.createFreehand(rawPoints, closed, pressures);
}

export function createArrow(fromX: number, fromY: number, toX: number, toY: number): ArrowElement {
  return shared.createArrow(fromX, fromY, toX, toY);
}

export function createPinnedArrow(
  fromId: ElementId,
  fromAnchor: Anchor,
  toId: ElementId,
  toAnchor: Anchor,
): ArrowElement {
  return shared.createPinnedArrow(fromId, fromAnchor, toId, toAnchor);
}
