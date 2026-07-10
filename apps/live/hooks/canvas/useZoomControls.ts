'use client';

// The discrete zoom-button handlers (the +/- steps and the preset levels
// in the canvas corner chrome), lifted out of Canvas. Pinch + wheel zoom
// are handled separately (useCanvasPinchZoom / the wheel listener); this
// is just the buttons, clamped to the shared zoom bounds.

import { track } from '@/lib/telemetry';
import { ZOOM_MIN, ZOOM_MAX } from '@/lib/canvas';

const ZOOM_STEP = 0.1;
const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

export function useZoomControls(zoom: number, setZoom: (z: number) => void) {
  const zoomIn = () => {
    setZoom(clampZoom(zoom + ZOOM_STEP));
    track('Canvas', 'Zoomed', 'In');
  };
  const zoomOut = () => {
    setZoom(clampZoom(zoom - ZOOM_STEP));
    track('Canvas', 'Zoomed', 'Out');
  };
  // Jump straight to a preset level (the hover popover on the zoom
  // percentage button: 25% … 150%).
  const setZoomTo = (z: number) => {
    setZoom(clampZoom(z));
    track('Canvas', 'Zoomed', 'Preset');
  };
  return { zoomIn, zoomOut, setZoomTo };
}
