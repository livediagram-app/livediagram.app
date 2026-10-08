// What a double-click on a whiteboard's bare board edits (docs/specs/023-draw-mode/draw-mode.md
// "Selecting"). A whiteboard shape is picked by its drawn outline, so a press in its empty inside
// reaches the board, not the shape; a double-click there still means the shape. So does the
// double-click on a selected shape whose first click put it down.
import {
  layerBands,
  opensInlineLabelEditor,
  pickedByOutline,
  pointInsideOutline,
  type Element,
  type Layer,
  type ShapeElement,
} from '@livediagram/document';
import { debugLog } from './debug-log';

type Point = { x: number; y: number };

/**
 * The topmost outline-picked shape whose drawn inside holds `p` (canvas px) and whose label can be
 * edited there, or null. `elements` is in paint order, bottom first; `inertIds` are on a hidden or
 * locked layer.
 */
export function shapeToEditAt(
  elements: readonly Element[],
  p: Point,
  inertIds: ReadonlySet<string>,
): ShapeElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]!;
    if (!pickedByOutline(el) || el.locked || inertIds.has(el.id)) continue;
    if (!opensInlineLabelEditor(el.shape)) continue;
    if (pointInsideOutline(el, p, 0)) return el;
  }
  return null;
}

/**
 * Routes a double-click on the bare board: on a whiteboard, inside a shape, it edits that shape;
 * anywhere else it does what the board's double-click does (a new text box).
 */
export function routeBoardDoubleClick(
  board: {
    whiteboard: boolean;
    elements: Element[];
    layers: Layer[] | undefined;
    inertIds: ReadonlySet<string>;
  },
  p: Point,
  to: { edit: (id: string) => void; board: (x: number, y: number) => void },
): void {
  const target = board.whiteboard
    ? shapeToEditAt(
        layerBands(board.elements, board.layers).flatMap((band) => band.elements),
        p,
        board.inertIds,
      )
    : null;
  if (!target) {
    to.board(p.x, p.y);
    return;
  }
  debugLog(`[whiteboard] double-click inside ${target.shape} edits it`);
  to.edit(target.id);
}
