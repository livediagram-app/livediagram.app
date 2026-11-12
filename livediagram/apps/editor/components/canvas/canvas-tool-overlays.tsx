// The screen-space tool overlays (docs/specs/008-canvas/canvas-and-palette.md, eraser-panel.md): the
// spotlight's shroud and the eraser's brush ring, siblings of the transformed world so they never pan or
// zoom with it. A plain function Canvas calls in its render, so it adds no component level.
import { EraserBrushRing } from '@liveworkspace/workbench/components/canvas/EraserBrushRing';
import { SpotlightOverlay } from '@liveworkspace/workbench/components/canvas/SpotlightOverlay';
import { DEFAULT_ERASER_CONFIG, eraserRadius } from '@/lib/eraser-config';
import { WHITEBOARD_ERASER_RADIUS_PX } from '@/lib/whiteboard-tool';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import type { useCanvasPointer } from './useCanvasPointer';

type Pointer = ReturnType<typeof useCanvasPointer>;

export function canvasToolOverlays({
  canvasTool,
  eraserPos,
  spotlight,
  spotlightLook,
  whiteboardDock,
  eraserConfig,
}: Pick<CanvasProps, 'canvasTool' | 'whiteboardDock' | 'eraserConfig'> &
  Pick<Pointer, 'eraserPos' | 'spotlight' | 'spotlightLook'>) {
  return (
    <>
      {/* Spotlight presenter shroud (docs/specs/008-canvas/canvas-and-palette.md). Screen-space sibling of the
          transformed wrapper so the light stays fixed on screen while the
          canvas pans / zooms underneath. Rendered before CanvasChrome so the
          palette + chrome paint ON TOP and stay reachable to switch tools
          back; pointer-events-none lets clicks fall through to <main>. */}
      {/* The eraser's brush ring (docs/specs/008-canvas/eraser-panel.md): the same screen-space layer as
          the shroud, for the same reason: it must not pan or zoom with the
          canvas, and it must never take a pointer event. */}
      {canvasTool === 'eraser' ? (
        <EraserBrushRing
          pos={eraserPos}
          // A whiteboard's brush is fixed per mode (docs/specs/023-draw-mode/draw-mode.md "Eraser").
          radius={
            whiteboardDock
              ? WHITEBOARD_ERASER_RADIUS_PX[whiteboardDock.prefs.eraserMode]
              : eraserRadius(eraserConfig ?? DEFAULT_ERASER_CONFIG)
          }
          filtered={
            !whiteboardDock && (eraserConfig ?? DEFAULT_ERASER_CONFIG).target !== 'anything'
          }
        />
      ) : null}
      {canvasTool === 'spotlight' ? (
        <SpotlightOverlay
          pos={spotlight.pos}
          radius={spotlight.radius}
          config={spotlightLook.config}
        />
      ) : null}
    </>
  );
}
