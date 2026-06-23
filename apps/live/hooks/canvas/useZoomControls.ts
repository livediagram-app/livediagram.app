'use client';

// The discrete zoom-button handlers (the +/-/reset controls in the canvas
// corner chrome), lifted out of Canvas. Pinch + wheel zoom are handled
// separately (useCanvasPinchZoom / the wheel listener); this is just the
// stepped buttons, clamped to the shared zoom bounds.

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
  const resetZoom = () => {
    setZoom(1);
    track('Canvas', 'Zoomed', 'Reset');
  };
  return { zoomIn, zoomOut, resetZoom };
}
