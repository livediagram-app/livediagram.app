// Viewport zoom bounds, shared by the +/- buttons and the pinch / wheel zoom so the two can never
// drift apart: 0.1 = 10%, 5 = 500%. Each product's lib/canvas.ts re-exports them; the ceiling in
// force is the `zoomMax` binding (livedesign raises it for a photo page).
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 5;
