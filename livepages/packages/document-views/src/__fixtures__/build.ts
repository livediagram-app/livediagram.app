// Small builders for the unit tests: fixed ids and geometry on the document factories' elements.
import {
  createFreehand,
  createPinnedArrow,
  createShape,
  type ArrowElement,
  type Element,
  type ShapeElement,
  type ShapeKind,
} from '@livediagram/document';

export function shapeAt(
  kind: ShapeKind,
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 50,
  extra: Partial<ShapeElement> = {},
): ShapeElement {
  return { ...createShape(kind, x, y), id, x, y, width, height, ...extra };
}

export function strokeAt(id: string, x: number, y: number, closed = false): Element {
  return {
    ...createFreehand(
      [
        { x, y },
        { x: x + 20, y: y + 10 },
      ],
      closed,
    ),
    id,
  };
}

export function arrowBetween(
  id: string,
  from: string,
  to: string,
  extra: Partial<ArrowElement> = {},
): ArrowElement {
  return { ...createPinnedArrow(from, 'e', to, 'w'), id, ...extra };
}
