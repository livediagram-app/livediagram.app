// The commit smoothing of the diagram pencil and the highlighter
// (docs/specs/008-canvas/canvas-and-palette.md "Pencil"): RDP simplification of the raw
// samples at a screen-px tolerance; the curve through what is left is drawn by
// catmullRomToBezierPath. A whiteboard pen does not use it: its live stroke pipeline
// (lib/live-stroke) smooths while it draws.
import { simplifyPolyline } from '@livediagram/document';

type Point = { x: number; y: number };

// Visible jitter smoothed away, in SCREEN px: the canvas tolerance is this
// divided by the zoom, so a stroke is as smooth zoomed in as out.
export const PEN_SIMPLIFY_SCREEN_PX = 1.2;

export function simplifyPenStroke(points: Point[], zoom: number): Point[] {
  return simplifyPolyline(points, PEN_SIMPLIFY_SCREEN_PX / (zoom || 1));
}
