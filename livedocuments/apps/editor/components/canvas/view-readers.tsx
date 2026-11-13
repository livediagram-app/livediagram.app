'use client';

// The canvas parts that show the view, reading it where they draw it
// (docs/specs/008-canvas/blueprints/viewport-store.md "Inside the canvas"): what renders them takes no
// view, so a zoom tick renders these and not the layer or the chrome around them. The components they
// wrap stay pure renderers.

import { useSyncExternalStore, type ComponentProps } from 'react';
import type { ReadableStore } from '@liveworkspace/workbench/lib/state-store';
import { useCanvasZoom } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { LaserOverlay } from '@liveworkspace/workbench/components/canvas/LaserOverlay';
import { Minimap } from '@/components/canvas/Minimap';
import { ZoomControls } from '@/components/chrome/ZoomControls';
import { useViewportOf } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import type { View } from '@liveworkspace/workbench/lib/viewport-store';

const zoomOf = (v: View) => v.zoom;
const wholeView = (v: View) => v;

// The laser trails, read from their store here: a peer's trail moving renders this overlay alone, never the canvas
// layer or the editor (docs/specs/008-canvas/canvas-performance.md).
export function ZoomedLaserOverlay({
  trails,
  ...props
}: Omit<ComponentProps<typeof LaserOverlay>, 'zoom' | 'trails'> & {
  trails: ReadableStore<ComponentProps<typeof LaserOverlay>['trails']>;
}) {
  const shown = useSyncExternalStore(trails.subscribe, trails.get, trails.get);
  return <LaserOverlay {...props} trails={shown} zoom={useCanvasZoom()} />;
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
