// The canvas surface's own style (docs/specs/008-canvas/canvas-and-palette.md): the paper the hollow
// arrowheads fill with, the sticky notes' peel, the tab's pattern in world space and the cursor a pending
// draw, a whiteboard pen or the path tool shows. Pure: Canvas hands it what it read this render.
import type { CSSProperties } from 'react';
import { tabBackgroundStyle, worldPatternOrigin } from '@/lib/canvas-backgrounds';
import { drawIntentCursor } from '@/lib/draw-mode';
import type { CanvasProps } from '@/components/canvas/Canvas.types';

export function canvasMainStyle({
  tabBackgroundPattern,
  tabBackgroundColor,
  tabPatternColor,
  tabBackgroundOpacity,
  tabBackgroundPatternScale,
  stickyPeel,
  viewportOffset,
  viewportZoom,
  mainSize,
  pendingDraw,
  penCursorValue,
  pathCursor,
}: Pick<
  CanvasProps,
  | 'tabBackgroundPattern'
  | 'tabBackgroundColor'
  | 'tabPatternColor'
  | 'tabBackgroundOpacity'
  | 'tabBackgroundPatternScale'
  | 'pendingDraw'
> & {
  stickyPeel: Readonly<Record<string, string>>;
  viewportOffset: { x: number; y: number };
  viewportZoom: number;
  mainSize: { width: number; height: number };
  // A whiteboard pen's own cursor, over the draw intent's.
  penCursorValue: string | null;
  pathCursor: string | null | undefined;
}): CSSProperties {
  return {
    // The paper hollow arrowheads fill with (arrow-defs.tsx).
    ['--lvd-canvas-paper' as string]: tabBackgroundColor,
    // The sticky notes' paper peel, as a picture (sticky-peel-image.ts).
    ...stickyPeel,
    // In world space: the pattern pans and zooms with the elements, so
    // they stay on the same dots at any zoom (worldPatternOrigin).
    ...tabBackgroundStyle(
      tabBackgroundPattern,
      worldPatternOrigin(viewportOffset, viewportZoom, {
        w: mainSize.width,
        h: mainSize.height,
      }),
      tabBackgroundColor,
      tabPatternColor,
      tabBackgroundOpacity,
      tabBackgroundPatternScale * viewportZoom,
    ),
    // Mirror the inner-wrapper cursor on <main>. The inner div is
    // `absolute inset-0` but its CSS transform scales it (zoom),
    // so when zoom is below 1 the hit area shrinks and the
    // surrounding "letterbox" gap falls through to <main>. Without
    // setting cursor here too, the user would see the OS default
    // arrow in that gap while a draw-to-size intent is pending.
    ...(pendingDraw ? { cursor: penCursorValue ?? drawIntentCursor(pendingDraw) } : null),
    ...(pathCursor ? { cursor: pathCursor } : null),
  };
}
