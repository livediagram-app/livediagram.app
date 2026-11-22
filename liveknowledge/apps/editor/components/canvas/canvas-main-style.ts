// The canvas surface's own style (docs/specs/008-canvas/canvas-and-palette.md): the paper the hollow
// arrowheads fill with, the sticky notes' peel, the tab's pattern in world space and a pending draw's
// cursor; and the world wrapper's, the view's transform over the pages and elements. Pure: Canvas hands
// them what it read this render.
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
    ...(pendingDraw ? { cursor: drawIntentCursor(pendingDraw) } : null),
  };
}

/** The world wrapper's style: the view's pan and zoom, the white under each picture and a pending draw's cursor. */
export function canvasWorldStyle(
  viewportZoom: number,
  viewportOffset: { x: number; y: number },
  pendingDraw: CanvasProps['pendingDraw'],
): CSSProperties {
  return {
    // Translate is in canvas-coords (applied first); scale is centred
    // on the wrapper so zooming keeps the viewport centre stable.
    transform: `scale(${viewportZoom}) translate(${viewportOffset.x}px, ${viewportOffset.y}px)`,
    // Draw-mode cursor: every intent gets a custom inline-SVG
    // cursor (crosshair at the pointer tip plus a small glyph
    // hinting at what's about to land). Without this, tool
    // intents inherited the default arrow cursor because the
    // wrapper drops its Tailwind cursor- class above when
    // pendingDraw is set, leaving no cursor specified at all.
    ...(pendingDraw ? { cursor: drawIntentCursor(pendingDraw) } : null),
  };
}
