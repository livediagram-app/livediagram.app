// Small builders for the unit tests: fixed ids and geometry on the document factories' elements.
import {
  createFreehand,
  createPinnedArrow,
  createShape,
  type ArrowElement,
  type Element,
  type ShapeElement,
  type ShapeKind,
} from '@livehuddle/document';

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

// A stored shape of a kind livehuddle no longer has (docs/specs/002-project-scope/not-in-livehuddle.md "Retired
// elements"): a square's box carrying the old kind word and whatever fields it was stored with.
export function retiredShapeAt(
  kind: string,
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 50,
  extra: Record<string, unknown> = {},
): ShapeElement {
  return {
    ...shapeAt('square', id, x, y, width, height),
    shape: kind,
    ...extra,
  } as unknown as ShapeElement;
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

// A stored table (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 2): a retired element
// type, as the editor's table tool stored it, a 3x3 grid with a header row.
export function storedTableAt(x: number, y: number, extra: Record<string, unknown> = {}): Element {
  return {
    id: 'table',
    type: 'table',
    x,
    y,
    width: 360,
    height: 150,
    cells: Array.from({ length: 3 }, () => ['', '', '']),
    headerRow: true,
    textSize: 'md',
    ...extra,
  } as unknown as Element;
}
