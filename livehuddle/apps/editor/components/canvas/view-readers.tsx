'use client';

// The canvas parts that show the view, reading it where they draw it
// (docs/specs/008-canvas/blueprints/viewport-store.md "Inside the canvas"): what renders them takes no
// view, so a zoom tick renders these and not the layer or the chrome around them. The components they
// wrap stay pure renderers.

import type { ComponentProps } from 'react';
import { ZoomControls } from '@/components/chrome/ZoomControls';
import { ViewDial } from '@/components/chrome/ViewDial';
import { useViewportOf } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import type { View } from '@liveworkspace/workbench/lib/viewport-store';

const zoomOf = (v: View) => v.zoom;

// The corner zoom controls, showing the zoom from the viewport store.
export function ViewZoomControls(props: Omit<ComponentProps<typeof ZoomControls>, 'zoom'>) {
  return <ZoomControls {...props} zoom={useViewportOf(zoomOf)} />;
}

// The view dial (docs/specs/008-canvas/3d-view.md "The view dial"), showing the zoom from the viewport store.
export function ViewDialReader(props: Omit<ComponentProps<typeof ViewDial>, 'zoom'>) {
  return <ViewDial {...props} zoom={useViewportOf(zoomOf)} />;
}
