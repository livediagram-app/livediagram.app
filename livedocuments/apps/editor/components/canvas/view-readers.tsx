'use client';

// The canvas parts that show the view, reading it where they draw it
// (docs/specs/008-canvas/blueprints/viewport-store.md "Inside the canvas"): what renders them takes no
// view, so a zoom tick renders these and not the layer or the chrome around them. The components they
// wrap stay pure renderers.

import type { ComponentProps } from 'react';
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

// The corner zoom controls, showing the zoom from the viewport store.
export function ViewZoomControls(props: Omit<ComponentProps<typeof ZoomControls>, 'zoom'>) {
  return <ZoomControls {...props} zoom={useViewportOf(zoomOf)} />;
}

// The Map, its view box following the view (its picture is memoised and does not redraw for it).
export function ViewMinimap(
  props: Omit<ComponentProps<typeof Minimap>, 'viewportZoom' | 'viewportOffset'>,
) {
  const view = useViewportOf(wholeView);
  return <Minimap {...props} viewportZoom={view.zoom} viewportOffset={view.offset} />;
}
