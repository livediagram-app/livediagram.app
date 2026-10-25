'use client';

// The canvas parts that show the view, reading it where they draw it
// (docs/specs/008-canvas/blueprints/viewport-store.md "Inside the canvas"): what renders them takes no
// view, so a zoom tick renders these and not the layer or the chrome around them. The components they
// wrap stay pure renderers.

import { useCanvasCovered, useSheetCovering } from '@/hooks/plan/plan-cover-store';
import {
  setSheetZoom,
  SHEET_ZOOM_MAX,
  SHEET_ZOOM_MIN,
  stepSheetZoom,
  useSheetZoom,
} from '@/hooks/sheets/sheet-zoom';
import { useEffect, type ComponentProps } from 'react';
import { useCanvasZoom } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { RemoteCursor } from '@/components/canvas/RemoteCursor';
import { Minimap } from '@/components/canvas/Minimap';
import { ZoomControls } from '@/components/chrome/ZoomControls';
import { useViewportOf } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import type { View } from '@liveworkspace/workbench/lib/viewport-store';

const zoomOf = (v: View) => v.zoom;
const SHEET_ZOOM_RANGE = { min: SHEET_ZOOM_MIN, max: SHEET_ZOOM_MAX };
const wholeView = (v: View) => v;

export function ZoomedRemoteCursor(props: Omit<ComponentProps<typeof RemoteCursor>, 'zoom'>) {
  return <RemoteCursor {...props} zoom={useCanvasZoom()} />;
}

// The corner zoom controls. Only a Sheet zooms (docs/specs/029-sheets/sheet.md "Zoom"), its cells, Fit putting it back
// to 100%; on a Board, Dashboard or Form tab the zoom buttons are hidden, leaving Zen when it applies.
export function ViewZoomControls(
  props: Omit<ComponentProps<typeof ZoomControls>, 'zoom' | 'zoomHidden'>,
) {
  const canvasZoom = useViewportOf(zoomOf);
  const sheet = useSheetCovering();
  const sheetZoom = useSheetZoom();
  // Back to 100% once no Sheet covers the canvas, so the next one opens at its own size.
  useEffect(() => {
    if (!sheet) setSheetZoom(1);
  }, [sheet]);
  if (sheet)
    return (
      <ZoomControls
        {...props}
        zoom={sheetZoom}
        onZoomIn={() => stepSheetZoom(1)}
        onZoomOut={() => stepSheetZoom(-1)}
        onSetZoom={setSheetZoom}
        onFitToScreen={() => setSheetZoom(1)}
        zoomScope="sheet"
        zoomRange={SHEET_ZOOM_RANGE}
      />
    );
  return <ZoomControls {...props} zoom={canvasZoom} zoomHidden />;
}

// The Map, its view box following the view (its picture is memoised and does not redraw for it). Hidden while a Plan
// board or view covers the canvas (docs/specs/026-plan/plan-board.md "Maximised board"): there is no canvas to map.
export function ViewMinimap(
  props: Omit<ComponentProps<typeof Minimap>, 'viewportZoom' | 'viewportOffset'>,
) {
  const view = useViewportOf(wholeView);
  const covered = useCanvasCovered();
  if (covered) return null;
  return <Minimap {...props} viewportZoom={view.zoom} viewportOffset={view.offset} />;
}
