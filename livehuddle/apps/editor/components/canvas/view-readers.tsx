'use client';

// The canvas parts that show the view, reading it where they draw it
// (docs/specs/008-canvas/blueprints/viewport-store.md "Inside the canvas"): what renders them takes no
// view, so a zoom tick renders these and not the layer or the chrome around them. The components they
// wrap stay pure renderers.

import type { ComponentProps } from 'react';
import { Minimap } from '@/components/canvas/Minimap';
import { ZoomControls } from '@/components/chrome/ZoomControls';
import { PathEditToolbar } from '@/components/canvas/path/PathEditToolbar';
import { useViewportOf } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import type { View } from '@liveworkspace/workbench/lib/viewport-store';

const zoomOf = (v: View) => v.zoom;
const wholeView = (v: View) => v;

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

// A path's edit toolbar, floating in the view like the canvas it edits.
export function ViewPathEditToolbar(
  props: Omit<ComponentProps<typeof PathEditToolbar>, 'zoom' | 'viewportOffset'>,
) {
  const view = useViewportOf(wholeView);
  return <PathEditToolbar {...props} zoom={view.zoom} viewportOffset={view.offset} />;
}
