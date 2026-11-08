// The whiteboard's shape tools (docs/specs/023-draw-mode/draw-mode.md "Shapes"): the shapes a board
// arms, and how a shape drawn on a board looks. The pens, the Path and Fill tools and the board's
// Line and Arrow left livehuddle with the element engine's part 4
// (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine").
import { INK_PEN_COLOUR, type Element } from '@livehuddle/document';
import type { PendingDraw } from './draw-mode';

export type WhiteboardShapeId = 'rectangle' | 'ellipse' | 'diamond' | 'cylinder';

export const WHITEBOARD_SHAPES: readonly {
  id: WhiteboardShapeId;
  label: string;
  intent: PendingDraw;
}[] = [
  { id: 'rectangle', label: 'Rectangle', intent: { type: 'shape', kind: 'square' } },
  { id: 'ellipse', label: 'Ellipse', intent: { type: 'shape', kind: 'circle' } },
  { id: 'diamond', label: 'Diamond', intent: { type: 'shape', kind: 'diamond' } },
  { id: 'cylinder', label: 'Cylinder', intent: { type: 'shape', kind: 'cylinder' } },
];

// A dock shape (docs/specs/023-draw-mode/draw-mode.md "Shapes"), armed plain.
export function whiteboardShapeIntent(id: WhiteboardShapeId): PendingDraw {
  const shape = WHITEBOARD_SHAPES.find((s) => s.id === id)!;
  return { ...shape.intent, board: true } as PendingDraw;
}

// A shape as Draw mode writes it (docs/specs/007-editor/editor-modes.md "One look"): an Ink outline
// (and label) stored by name and no fill, written on the element so it looks the same in Diagram
// mode and to every collaborator, at its default width until the quick style panel says otherwise.
// Notes and text boxes keep their own colours.
export function boardShape<T extends Element>(el: T): T {
  if (el.type !== 'shape') return el;
  return {
    ...el,
    penColour: INK_PEN_COLOUR,
    penTextColour: INK_PEN_COLOUR,
    fillColor: 'transparent',
  };
}

// On a whiteboard only a note or a text box turns a keypress into typing
// (docs/specs/023-draw-mode/draw-mode.md "Keyboard shortcuts"): a shape just drawn stays selected,
// and R, O, D and the rest must still pick the next tool rather than label it.
export function whiteboardTakesTyping(el: Pick<Element, 'type'>): boolean {
  return el.type === 'sticky' || el.type === 'text';
}

// A whiteboard shape is picked by its drawn outline (docs/specs/023-draw-mode/draw-mode.md
// "Selecting"): the outline catches pointers this far either side of it, in SCREEN px.
export const STROKE_HIT_SCREEN_PX = 6;

/** The width, in canvas px, of the invisible line that catches pointers on a drawn outline. */
export function strokeHitWidth(lineWidth: number, zoom: number): number {
  return lineWidth + (2 * STROKE_HIT_SCREEN_PX) / (zoom || 1);
}
