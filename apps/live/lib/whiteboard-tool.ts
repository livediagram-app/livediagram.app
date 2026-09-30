// The whiteboard dock's tool model (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard shows"):
// which dock tool is in hand, derived from the editor's own canvas tool and
// armed intent so the two can never disagree, plus the intents the dock arms
// and the pen-versus-touch routing rule.
import type { CanvasTool } from '@/components/palette/CommandPalette.types';
import type { Element } from '@livediagram/document';
import type { PendingDraw } from './draw-mode';
import type { WhiteboardPen } from './whiteboard-prefs';

// No highlighter: a whiteboard's pens are its markers (docs/specs/023-whiteboard/whiteboard.md).
export type WhiteboardTool = 'select' | 'pen' | 'eraser' | 'sticky' | 'text' | 'shape';

export function activeWhiteboardTool(
  canvasTool: CanvasTool,
  pendingDraw: PendingDraw | null,
): WhiteboardTool {
  if (canvasTool === 'eraser') return 'eraser';
  switch (pendingDraw?.type) {
    case 'freehand':
      return pendingDraw.variant === 'whiteboard' ? 'pen' : 'select';
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

// The eraser's brush on a whiteboard, in screen px (docs/specs/023-whiteboard/whiteboard.md "Eraser").
export const WHITEBOARD_ERASER_RADIUS_PX: Readonly<Record<'stroke' | 'partial', number>> = {
  stroke: 10,
  partial: 16,
};

export type WhiteboardShapeId = 'rectangle' | 'ellipse' | 'diamond' | 'line' | 'arrow';

export const WHITEBOARD_SHAPES: readonly {
  id: WhiteboardShapeId;
  label: string;
  intent: PendingDraw;
}[] = [
  { id: 'rectangle', label: 'Rectangle', intent: { type: 'shape', kind: 'square' } },
  { id: 'ellipse', label: 'Ellipse', intent: { type: 'shape', kind: 'circle' } },
  { id: 'diamond', label: 'Diamond', intent: { type: 'shape', kind: 'diamond' } },
  { id: 'line', label: 'Line', intent: { type: 'arrow', ends: 'none' } },
  { id: 'arrow', label: 'Arrow', intent: { type: 'arrow', ends: 'to' } },
];

// A dock shape (docs/specs/023-whiteboard/whiteboard.md "Shapes"). A pen is a separate tool: pens do
// not set the colour of the other tools, so a shape is armed plain.
export function whiteboardShapeIntent(id: WhiteboardShapeId): PendingDraw {
  const shape = WHITEBOARD_SHAPES.find((s) => s.id === id)!;
  return { ...shape.intent, board: true } as PendingDraw;
}

// A whiteboard shape as committed: unfilled, and otherwise unpainted, so it is
// drawn in the board's ink at its default width until the quick style panel
// says otherwise.
export function boardShape<T extends Element>(el: T): T {
  return el.type === 'shape' ? { ...el, fillColor: 'transparent' } : el;
}

// On a whiteboard only a note or a text box turns a keypress into typing
// (docs/specs/023-whiteboard/whiteboard.md "Keyboard shortcuts"): a shape just drawn stays selected,
// and R, O, D and the rest must still pick the next tool rather than label it.
export function whiteboardTakesTyping(el: Pick<Element, 'type'>): boolean {
  return el.type === 'sticky' || el.type === 'text';
}

// Microsoft Whiteboard's rule (docs/specs/023-whiteboard/whiteboard.md "Touch and pen input"): once a
// pen has been used on this device, a single finger pans rather than inks, so
// a resting palm or a guiding finger never draws. `inking` is true while a pen,
// the highlighter or the eraser is in hand.
export function whiteboardPointerRoute(input: {
  pointerType: string;
  penSeen: boolean;
  inking: boolean;
}): 'ink' | 'pan' {
  return input.pointerType === 'touch' && input.penSeen && input.inking ? 'pan' : 'ink';
}
