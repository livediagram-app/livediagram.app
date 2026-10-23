// A marker's armed intent (docs/specs/023-draw-mode/drawing-tools.md "Markers"), the Pen's path as
// it lands, and how a pen stroke is picked by its drawn line.
import { INK_PEN_COLOUR, type PathElement } from '@livedesign/design';
import type { PendingDraw } from './draw-mode';
import type { WhiteboardPen, WhiteboardPrefs } from './whiteboard-prefs';

export function whiteboardPenIntent(
  pen: WhiteboardPen,
): Extract<PendingDraw, { variant: 'whiteboard' }> {
  return {
    type: 'freehand',
    variant: 'whiteboard',
    colour: pen.colour,
    width: pen.width,
    penId: pen.id,
  };
}

/** The marker in hand: the one the armed intent names, else none. */
export function heldMarker(
  intent: PendingDraw | null,
  prefs: WhiteboardPrefs,
): WhiteboardPen | null {
  if (intent?.type !== 'freehand' || intent.variant !== 'whiteboard') return null;
  return prefs.pens.find((p) => p.id === intent.penId) ?? null;
}

// A path as the Pen writes it (docs/specs/023-draw-mode/path-tool.md "Drawing"): an Ink outline
// stored by name and no fill, so it looks the same to every collaborator, until the quick style
// panel says otherwise.
export function inkPath<T extends PathElement>(el: T): T {
  return { ...el, penColour: INK_PEN_COLOUR, fillColor: 'transparent' };
}

// A pen stroke is picked by its drawn line, not its box (docs/specs/023-draw-mode/drawing-tools.md
// "Selecting"): the line catches pointers this far either side of it, in SCREEN px.
export const STROKE_HIT_SCREEN_PX = 6;

/** The width, in canvas px, of the invisible line that catches pointers on a pen stroke. */
export function strokeHitWidth(penWidth: number, zoom: number): number {
  return penWidth + (2 * STROKE_HIT_SCREEN_PX) / (zoom || 1);
}
