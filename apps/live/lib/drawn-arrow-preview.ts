import {
  resolveStockColours,
  type ArrowElement,
  type CanvasSurface,
  type Element,
} from '@livediagram/document';
import type { ThemeDefinition } from '@livediagram/document';
import type { PendingDraw } from '@/lib/draw-mode';
import { buildDressedDrawnArrow } from '@/lib/draw-commit';

// The preview's one id: the markers and the pass-behind mask the arrow renderer keys on it stay
// put for the whole drag.
export const DRAWN_ARROW_PREVIEW_ID = 'drawn-arrow-preview';

// The line or arrow a draw gesture would land if released now, as the canvas would then show it
// (docs/specs/023-whiteboard/whiteboard.md "Shapes"): the commit's own builder and dressing, its
// stock colours (Draw mode's Ink) drawn in their version for the canvas, as the canvas draws them.
export function drawnArrowAsShown(
  intent: Extract<PendingDraw, { type: 'arrow' }>,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  board: {
    elements: Element[];
    theme: ThemeDefinition;
    whiteboard: boolean;
    styleNewElement: <T extends Element>(el: T) => T;
    surface: CanvasSurface;
  },
): ArrowElement {
  const landed = buildDressedDrawnArrow(
    intent,
    startX,
    startY,
    endX,
    endY,
    board,
    board.styleNewElement,
  );
  return { ...resolveStockColours(landed, board.surface), id: DRAWN_ARROW_PREVIEW_ID };
}
