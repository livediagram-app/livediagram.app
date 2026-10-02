'use client';

// The canvas cursor for a whiteboard pen in hand (docs/specs/023-whiteboard/whiteboard.md "Pens"): the
// look chosen in the dock's More flyout, in the pen's colour (the main pen: the board's ink), drawn
// for the board's appearance. Null for anything else, which keeps its draw-intent cursor.

import { useMemo } from 'react';
import { WHITEBOARD_INK, penColourCss } from '@livediagram/document';
import type { PendingDraw } from '@/lib/draw-mode';
import { penCursor, type PenCursorVariant } from '@/lib/whiteboard-pen-cursor';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';

export function useWhiteboardPenCursor(
  pendingDraw: PendingDraw | null,
  variant: PenCursorVariant | undefined,
  // The canvas zoom: the dot is the stroke's width on screen.
  zoom: number,
): string | null {
  // The canvas the stock colours are drawn for (docs/specs/007-editor/editor-modes.md "One look").
  const appearance = useCanvasSurface();
  const pen =
    pendingDraw?.type === 'freehand' && pendingDraw.variant === 'whiteboard' ? pendingDraw : null;
  // A named colour in its version for this board (docs/specs/023-whiteboard/whiteboard.md).
  const colour = pen ? penColourCss(pen.colour, appearance, WHITEBOARD_INK[appearance]) : null;
  const strokePx = pen ? pen.width * zoom : 0;
  return useMemo(
    () => (colour && variant ? penCursor(variant, colour, appearance, strokePx) : null),
    [colour, variant, appearance, strokePx],
  );
}
