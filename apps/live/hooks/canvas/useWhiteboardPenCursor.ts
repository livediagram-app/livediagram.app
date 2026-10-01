'use client';

// The canvas cursor for a pen in hand (a whiteboard pen, a marker, the diagram pencil or Shape Pen) (docs/specs/023-whiteboard/whiteboard.md "Pens"): the
// look chosen in the dock's More flyout, in the pen's colour (the main pen: the board's ink), drawn
// for the board's appearance. Null for anything else, which keeps its draw-intent cursor.

import { useMemo } from 'react';
import { WHITEBOARD_INK, penColourCss } from '@livediagram/document';
import { inkPenOf, type PendingDraw } from '@/lib/draw-mode';
import { penCursor, type PenCursorVariant } from '@/lib/whiteboard-pen-cursor';
import { useAppearance } from '@/hooks/ui/useAppearance';

export function useWhiteboardPenCursor(
  pendingDraw: PendingDraw | null,
  variant: PenCursorVariant | undefined,
  // The canvas zoom: the dot is the stroke's width on screen.
  zoom: number,
  // The colour a colourless pen inks in on this tab (lib/pen-ink); the board's ink by default.
  ink?: string,
): string | null {
  const { appearance } = useAppearance();
  // Every pen, the diagram pencil and Shape Pen included (docs/specs/008-canvas/two-pens.md "Ink").
  const pen = inkPenOf(pendingDraw);
  // A named colour in its version for this board (docs/specs/023-whiteboard/whiteboard.md).
  const colour = pen
    ? penColourCss(pen.colour, appearance, ink ?? WHITEBOARD_INK[appearance])
    : null;
  const strokePx = pen ? pen.width * zoom : 0;
  return useMemo(
    () => (colour && variant ? penCursor(variant, colour, appearance, strokePx) : null),
    [colour, variant, appearance, strokePx],
  );
}
