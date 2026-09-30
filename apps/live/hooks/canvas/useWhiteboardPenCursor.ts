'use client';

// The canvas cursor for a whiteboard pen in hand (docs/specs/023-whiteboard/whiteboard.md "Pens"): the
// look chosen in the dock's More flyout, in the pen's colour (the main pen: the board's ink), drawn
// for the board's appearance. Null for anything else, which keeps its draw-intent cursor.

import { useMemo } from 'react';
import { WHITEBOARD_INK } from '@livediagram/document';
import type { PendingDraw } from '@/lib/draw-mode';
import { penCursor, type PenCursorVariant } from '@/lib/whiteboard-pen-cursor';
import { useAppearance } from '@/hooks/ui/useAppearance';

export function useWhiteboardPenCursor(
  pendingDraw: PendingDraw | null,
  variant: PenCursorVariant | undefined,
): string | null {
  const { appearance } = useAppearance();
  const pen =
    pendingDraw?.type === 'freehand' && pendingDraw.variant === 'whiteboard' ? pendingDraw : null;
  const colour = pen ? (pen.colour ?? WHITEBOARD_INK[appearance]) : null;
  return useMemo(
    () => (colour && variant ? penCursor(variant, colour, appearance) : null),
    [colour, variant, appearance],
  );
}
