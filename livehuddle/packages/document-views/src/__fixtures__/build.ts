// Small builders for the unit tests: fixed ids and geometry on the document factories' elements.
import {
  createShape,
  type Element,
  type RetiredAnchor,
  type RetiredArrowElement,
  type ShapeElement,
  type ShapeKind,
} from '@livehuddle/document';

// A stored arrow pinned at both ends (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4):
// a retired element, kept as stored. The id is a placeholder the caller replaces.
export function createPinnedArrow(
  from: string,
  fromAnchor: RetiredAnchor,
  to: string,
  toAnchor: RetiredAnchor,
): RetiredArrowElement {
  return {
    id: 'arrow',
    type: 'arrow',
    from: { kind: 'pinned', elementId: from, anchor: fromAnchor },
    to: { kind: 'pinned', elementId: to, anchor: toAnchor },
  };
}

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
// elements"): a signpost's box carrying the old kind word and whatever fields it was stored with.
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
    ...shapeAt('signpost', id, x, y, width, height),
    shape: kind,
    ...extra,
  } as unknown as ShapeElement;
}

// A stored pen stroke (part 4): a retired element on its box.
export function strokeAt(id: string, x: number, y: number, closed = false): Element {
  return {
    id,
    type: 'freehand',
    x,
    y,
    width: 20,
    height: 10,
    closed,
    packedPoints: 'AQAAAAAA',
  } as unknown as Element;
}

export function arrowBetween(
  id: string,
  from: string,
  to: string,
  extra: Record<string, unknown> = {},
): RetiredArrowElement {
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
