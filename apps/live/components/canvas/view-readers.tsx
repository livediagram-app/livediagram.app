'use client';

// The canvas parts that show the view, reading it where they draw it
// (docs/specs/008-canvas/blueprints/viewport-store.md "Inside the canvas"): what renders them takes no
// view, so a zoom tick renders these and not the layer or the chrome around them. The components they
// wrap stay pure renderers.

import { useCanvasCovered, useSheetCovering } from '@/hooks/plan/plan-cover-store';
import { setSheetZoom, stepSheetZoom, useSheetZoom } from '@/hooks/sheets/sheet-zoom';
import { useEffect, type ComponentProps } from 'react';
import { useCanvasZoom } from '@/components/canvas/CanvasZoomContext';
import { LaserOverlay } from '@/components/canvas/LaserOverlay';
import { RemoteCursor } from '@/components/canvas/RemoteCursor';
import { Minimap } from '@/components/canvas/Minimap';
import { ZoomControls } from '@/components/chrome/ZoomControls';
import { useViewportOf } from '@/hooks/canvas/useViewportStore';
import type { View } from '@/lib/viewport-store';

const zoomOf = (v: View) => v.zoom;
const wholeView = (v: View) => v;

export function ZoomedRemoteCursor(props: Omit<ComponentProps<typeof RemoteCursor>, 'zoom'>) {
  return <RemoteCursor {...props} zoom={useCanvasZoom()} />;
}

export function ZoomedLaserOverlay(props: Omit<ComponentProps<typeof LaserOverlay>, 'zoom'>) {
  return <LaserOverlay {...props} zoom={useCanvasZoom()} />;
}

// The corner zoom controls, showing the zoom from the viewport store; off while a Plan element covers the canvas
// (docs/specs/026-plan/plan-board.md "Maximised board": the canvas cannot zoom then), except a Sheet, whose cells they
// zoom instead (docs/specs/029-sheets/sheet.md "Zoom"), Fit putting it back to 100%.
export function ViewZoomControls(
  props: Omit<ComponentProps<typeof ZoomControls>, 'zoom' | 'zoomOff'>,
) {
  const canvasZoom = useViewportOf(zoomOf);
  const covered = useCanvasCovered();
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
      />
    );
  return <ZoomControls {...props} zoom={canvasZoom} zoomOff={covered} />;
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
