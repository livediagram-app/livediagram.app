// The whiteboard dock's tool model (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard shows"):
// which dock tool is in hand, derived from the editor's own canvas tool and
// armed intent so the two can never disagree, plus the intents the dock arms
// and the pen-versus-touch routing rule.
import type { CanvasTool } from '@/components/palette/CommandPalette.types';
import { INK_PEN_COLOUR, type Element } from '@livediagram/document';
import type { PendingDraw } from './draw-mode';
import type { WhiteboardPen } from './whiteboard-prefs';

// No highlighter: a whiteboard's pens are its markers (docs/specs/023-draw-mode/draw-mode.md).
export type WhiteboardTool = 'select' | 'pen' | 'path' | 'eraser' | 'sticky' | 'text' | 'shape';

export function activeWhiteboardTool(
  canvasTool: CanvasTool,
  pendingDraw: PendingDraw | null,
): WhiteboardTool {
  if (canvasTool === 'eraser') return 'eraser';
  switch (pendingDraw?.type) {
    case 'freehand':
      return pendingDraw.variant === 'whiteboard' ? 'pen' : 'select';
    case 'path':
      return 'path';
    case 'sticky':
      return 'sticky';
    case 'text':
      return 'text';
    case 'shape':
    case 'arrow':
      return 'shape';
    default:
      return 'select';
  }
}

export function whiteboardPenIntent(pen: WhiteboardPen, recognise: boolean): PendingDraw {
  return {
    type: 'freehand',
    variant: 'whiteboard',
    colour: pen.colour,
    width: pen.width,
    recognise,
  };
}

// The eraser's brush on a whiteboard, in screen px (docs/specs/023-draw-mode/draw-mode.md "Eraser").
export const WHITEBOARD_ERASER_RADIUS_PX: Readonly<Record<'stroke' | 'partial', number>> = {
  stroke: 10,
  partial: 16,
};

export type WhiteboardShapeId = 'rectangle' | 'ellipse' | 'diamond' | 'cylinder' | 'line' | 'arrow';

export const WHITEBOARD_SHAPES: readonly {
  id: WhiteboardShapeId;
  label: string;
  intent: PendingDraw;
}[] = [
  { id: 'rectangle', label: 'Rectangle', intent: { type: 'shape', kind: 'square' } },
  { id: 'ellipse', label: 'Ellipse', intent: { type: 'shape', kind: 'circle' } },
  { id: 'diamond', label: 'Diamond', intent: { type: 'shape', kind: 'diamond' } },
  { id: 'cylinder', label: 'Cylinder', intent: { type: 'shape', kind: 'cylinder' } },
  { id: 'line', label: 'Line', intent: { type: 'arrow', ends: 'none' } },
  { id: 'arrow', label: 'Arrow', intent: { type: 'arrow', ends: 'to' } },
];

// A dock shape (docs/specs/023-draw-mode/draw-mode.md "Shapes"). A pen is a separate tool: pens do
// not set the colour of the other tools, so a shape is armed plain.
export function whiteboardShapeIntent(id: WhiteboardShapeId): PendingDraw {
  const shape = WHITEBOARD_SHAPES.find((s) => s.id === id)!;
  return { ...shape.intent, board: true } as PendingDraw;
}

// A shape, line, arrow or path as Draw mode writes it (docs/specs/007-editor/editor-modes.md "One
// look"): an Ink outline (and label) stored by name and no fill, written on the element so it looks
// the same in Diagram mode and to every collaborator, at its default width until the quick style
// panel says otherwise. Notes and text boxes keep their own colours.
export function boardShape<T extends Element>(el: T): T {
  switch (el.type) {
    case 'shape':
      return {
        ...el,
        penColour: INK_PEN_COLOUR,
        penTextColour: INK_PEN_COLOUR,
        fillColor: 'transparent',
      };
    case 'path':
      return { ...el, penColour: INK_PEN_COLOUR, fillColor: 'transparent' };
    case 'arrow':
      return { ...el, penColour: INK_PEN_COLOUR };
    default:
      return el;
  }
}

// On a whiteboard only a note or a text box turns a keypress into typing
// (docs/specs/023-draw-mode/draw-mode.md "Keyboard shortcuts"): a shape just drawn stays selected,
// and R, O, D and the rest must still pick the next tool rather than label it.
export function whiteboardTakesTyping(el: Pick<Element, 'type'>): boolean {
  return el.type === 'sticky' || el.type === 'text';
}

// Microsoft Whiteboard's rule (docs/specs/023-draw-mode/draw-mode.md "Touch and pen input"): once a
// pen has been used on this device, a single finger pans rather than inks, so
// a resting palm or a guiding finger never draws. `inking` is true while a pen,
// the Path tool or the eraser is in hand.
export function whiteboardPointerRoute(input: {
  pointerType: string;
  penSeen: boolean;
  inking: boolean;
}): 'ink' | 'pan' {
  return input.pointerType === 'touch' && input.penSeen && input.inking ? 'pan' : 'ink';
}

// A pen stroke is picked by its drawn line, not its box (docs/specs/023-draw-mode/draw-mode.md
// "Selecting"): the line catches pointers this far either side of it, in SCREEN px.
export const STROKE_HIT_SCREEN_PX = 6;

/** The width, in canvas px, of the invisible line that catches pointers on a pen stroke. */
export function strokeHitWidth(penWidth: number, zoom: number): number {
  return penWidth + (2 * STROKE_HIT_SCREEN_PX) / (zoom || 1);
}
