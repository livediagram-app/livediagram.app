'use client';

// The canvas parts that show the view, reading it where they draw it
// (docs/specs/008-canvas/blueprints/viewport-store.md "Inside the canvas"): what renders them takes no
// view, so a zoom tick renders these and not the layer or the chrome around them. The components they
// wrap stay pure renderers.

import { useSyncExternalStore, type ComponentProps, type ComponentType } from 'react';
import type { ReadableStore } from '../../lib/state-store';
import { useCanvasZoom } from './CanvasZoomContext';
import { LaserOverlay } from './LaserOverlay';
import { useViewportOf } from '../../hooks/canvas/useViewportStore';
import type { View } from '../../lib/viewport-store';

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
// What an editor hands the readers: its zoom controls and minimap, with their props `Z` and `M`.
export type ViewReadersDeps<Z, M> = {
  ZoomControls: ComponentType<Z>;
  Minimap: ComponentType<M>;
};

/** The zoom controls and minimap reading the view store, made once per editor at module scope. */
export function createViewReaders<
  Z extends { zoom: number },
  M extends { viewportZoom: number; viewportOffset: View['offset'] },
>({ ZoomControls, Minimap }: ViewReadersDeps<Z, M>) {
  function ViewZoomControls(props: Omit<Z, 'zoom'>) {
    return <ZoomControls {...(props as Z)} zoom={useViewportOf(zoomOf)} />;
  }

  // The Map, its view box following the view (its picture is memoised and does not redraw for it).
  function ViewMinimap(props: Omit<M, 'viewportZoom' | 'viewportOffset'>) {
    const view = useViewportOf(wholeView);
    return <Minimap {...(props as M)} viewportZoom={view.zoom} viewportOffset={view.offset} />;
  }

  return { ViewZoomControls, ViewMinimap };
}
