// Stored elements of the kinds the element engine retired in part 4 (docs/specs/002-project-scope/not-in-livehuddle.md
// "The element engine"), for tests: an arrow or line, a pen stroke, a path and an annotation, as a board saved before
// part 4 holds them. livehuddle no longer makes any of these, so tests build them as literals.

import type { Element } from '@livehuddle/document';

type Anchor = 'n' | 'e' | 's' | 'w' | 'nw' | 'ne' | 'se' | 'sw';

/** A stored arrow with free ends. */
export function storedArrow(
  id: string,
  from: { x: number; y: number },
  to: { x: number; y: number },
  extra: Record<string, unknown> = {},
): Element {
  return {
    id,
    type: 'arrow',
    from: { kind: 'free', x: from.x, y: from.y },
    to: { kind: 'free', x: to.x, y: to.y },
    ...extra,
  } as unknown as Element;
}

/** A stored arrow pinned at both ends. */
export function storedPinnedArrow(
  id: string,
  fromId: string,
  fromAnchor: Anchor,
  toId: string,
  toAnchor: Anchor,
  extra: Record<string, unknown> = {},
): Element {
  return {
    id,
    type: 'arrow',
    from: { kind: 'pinned', elementId: fromId, anchor: fromAnchor },
    to: { kind: 'pinned', elementId: toId, anchor: toAnchor },
    ...extra,
  } as unknown as Element;
}

/** A stored freehand stroke: a pen line, or a highlighter's with `{ pen: 'highlighter' }` in `extra`. */
export function storedFreehand(
  id: string,
  box: { x: number; y: number; width: number; height: number },
  extra: Record<string, unknown> = {},
): Element {
  return {
    id,
    type: 'freehand',
    ...box,
    points: [
      { x: 0, y: 0 },
      { x: box.width, y: box.height },
    ],
    ...extra,
  } as unknown as Element;
}

/** A stored path. */
export function storedPath(
  id: string,
  box: { x: number; y: number; width: number; height: number },
  extra: Record<string, unknown> = {},
): Element {
  return {
    id,
    type: 'path',
    ...box,
    closed: false,
    nodes: [
      { nx: 0, ny: 0, mode: 'corner' },
      { nx: 1, ny: 1, mode: 'corner' },
    ],
    ...extra,
  } as unknown as Element;
}

/** A stored annotation. */
export function storedAnnotation(
  id: string,
  box: { x: number; y: number; width: number; height: number },
  extra: Record<string, unknown> = {},
): Element {
  return { id, type: 'annotation', ...box, label: 'Note', ...extra } as unknown as Element;
}
