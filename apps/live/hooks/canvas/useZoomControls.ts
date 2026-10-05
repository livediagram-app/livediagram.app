'use client';

// The discrete zoom-button handlers (the +/- steps and the preset levels
// in the canvas corner chrome), lifted out of Canvas. Pinch + wheel zoom
// are handled separately (useCanvasPinchZoom / the wheel listener); this
// is just the buttons, clamped to the shared zoom bounds.

import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { track } from '@/lib/telemetry';
import { ZOOM_MIN, ZOOM_MAX } from '@/lib/canvas';

const ZOOM_STEP = 0.1;
const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

// Steps are updaters, applied to the zoom as it is when pressed: the handlers depend on no zoom value,
// so they keep their identity across zooms (docs/specs/008-canvas/blueprints/viewport-store.md).
export function useZoomControls(setZoom: Dispatch<SetStateAction<number>>) {
  return useMemo(
    () => ({
      zoomIn: () => {
        setZoom((z) => clampZoom(z + ZOOM_STEP));
        track('Canvas', 'Zoomed', 'In');
      },
      zoomOut: () => {
        setZoom((z) => clampZoom(z - ZOOM_STEP));
        track('Canvas', 'Zoomed', 'Out');
      },
      // Jump straight to a preset level (the hover popover on the zoom
      // percentage button: 25% … 150%).
      setZoomTo: (z: number) => {
        setZoom(clampZoom(z));
        track('Canvas', 'Zoomed', 'Preset');
      },
    }),
    [setZoom],
  );
}
