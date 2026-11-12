// The screen-space tool overlays (docs/specs/008-canvas/canvas-and-palette.md, eraser-panel.md,
// docs/specs/007-editor/wireframe-pages.md "Inspect"): the spotlight's shroud, the eraser's brush ring and
// Inspect's outlines, siblings of the transformed world so they never pan or zoom with it. A plain function
// Canvas calls in its render, so it adds no component level.
import type { RefObject } from 'react';
import { EraserBrushRing } from '@liveworkspace/workbench/components/canvas/EraserBrushRing';
import { SpotlightOverlay } from '@liveworkspace/workbench/components/canvas/SpotlightOverlay';
import { DEFAULT_ERASER_CONFIG, eraserRadius } from '@/lib/eraser-config';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { InspectOverlay } from './inspect/InspectOverlay';
import type { useCanvasPointer } from './useCanvasPointer';

type Pointer = ReturnType<typeof useCanvasPointer>;

export function canvasToolOverlays({
  canvasTool,
  eraserPos,
  spotlight,
  spotlightLook,
  eraserConfig,
  inspecting,
  elements,
  pages,
  wrapperRef,
  mainSize,
}: Pick<CanvasProps, 'canvasTool' | 'eraserConfig' | 'elements'> &
  Pick<Pointer, 'eraserPos' | 'spotlight' | 'spotlightLook'> & {
    inspecting: boolean;
    pages: Parameters<typeof InspectOverlay>[0]['pages'];
    wrapperRef: RefObject<HTMLDivElement | null>;
    mainSize: { width: number; height: number };
  }) {
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
          radius={eraserRadius(eraserConfig ?? DEFAULT_ERASER_CONFIG)}
          filtered={(eraserConfig ?? DEFAULT_ERASER_CONFIG).target !== 'anything'}
        />
      ) : null}
      {canvasTool === 'spotlight' ? (
        <SpotlightOverlay
          pos={spotlight.pos}
          radius={spotlight.radius}
          config={spotlightLook.config}
        />
      ) : null}
      {/* Inspect's outlines and measured lines (docs/specs/007-editor/wireframe-pages.md). */}
      {inspecting ? (
        <InspectOverlay
          elements={elements}
          pages={pages}
          wrapperRef={wrapperRef}
          mainSize={mainSize}
        />
      ) : null}
    </>
  );
}
