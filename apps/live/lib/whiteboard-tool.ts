// The whiteboard dock's tool model (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard shows"):
// which dock tool is in hand, derived from the editor's own canvas tool and
// armed intent so the two can never disagree, plus the intents the dock arms
// and the pen-versus-touch routing rule.
import type { CanvasTool } from '@/components/palette/CommandPalette.types';
import type { PendingDraw } from './draw-mode';
import type { WhiteboardPen } from './whiteboard-prefs';

export type WhiteboardTool =
  'select' | 'pen' | 'highlighter' | 'eraser' | 'sticky' | 'text' | 'shape';

export function activeWhiteboardTool(
  canvasTool: CanvasTool,
  pendingDraw: PendingDraw | null,
): WhiteboardTool {
  if (canvasTool === 'eraser') return 'eraser';
  if (canvasTool === 'highlighter') return 'highlighter';
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

export type WhiteboardShapeId = 'rectangle' | 'ellipse' | 'triangle' | 'diamond' | 'line' | 'arrow';

export const WHITEBOARD_SHAPES: readonly {
  id: WhiteboardShapeId;
  label: string;
  intent: PendingDraw;
}[] = [
  { id: 'rectangle', label: 'Rectangle', intent: { type: 'shape', kind: 'square' } },
  { id: 'ellipse', label: 'Ellipse', intent: { type: 'shape', kind: 'circle' } },
  { id: 'triangle', label: 'Triangle', intent: { type: 'shape', kind: 'triangle' } },
  { id: 'diamond', label: 'Diamond', intent: { type: 'shape', kind: 'diamond' } },
  { id: 'line', label: 'Line', intent: { type: 'arrow', ends: 'none' } },
  { id: 'arrow', label: 'Arrow', intent: { type: 'arrow', ends: 'to' } },
];

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
