// The whiteboard dock's tool model (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard shows"):
// which dock tool is in hand, derived from the editor's own canvas tool and
// armed intent so the two can never disagree, plus the intents the dock arms
// and the pen-versus-touch routing rule.
import type { CanvasTool } from '@/components/palette/CommandPalette.types';
import { nearestBorderStroke, type ArrowElement, type Element } from '@livediagram/document';
import type { PendingDraw, WhiteboardPenInk } from './draw-mode';
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

// A dock shape armed with the pen in hand (docs/specs/023-whiteboard/whiteboard.md "Shapes"), so it
// is drawn, previewed and committed in that pen's colour and width.
export function whiteboardShapeIntent(id: WhiteboardShapeId, pen: WhiteboardPen): PendingDraw {
  const shape = WHITEBOARD_SHAPES.find((s) => s.id === id)!;
  return { ...shape.intent, pen: { colour: pen.colour, width: pen.width } } as PendingDraw;
}

// What a pen does to a shape or line drawn with it: its colour (none for Ink,
// so the board's ink shows), no fill, and its weight: the exact px on a line,
// the nearest border preset on a shape.
export function applyWhiteboardPen<T extends Element>(el: T, pen: WhiteboardPenInk): T {
  const colour = pen.colour ? { strokeColor: pen.colour } : {};
  if (el.type === 'arrow')
    return { ...(el as ArrowElement), strokeWidth: pen.width, ...colour } as T;
  if (el.type !== 'shape') return el;
  return {
    ...el,
    fillColor: 'transparent',
    strokeWidth: nearestBorderStroke(pen.width),
    ...colour,
  };
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
