// The one smoothing a pen stroke gets, shared by the stroke being drawn and the
// stroke that lands (docs/specs/023-whiteboard/whiteboard.md "What you draw is what lands"): RDP
// simplification of the samples at a screen-px tolerance, then a Catmull-Rom
// curve through what is left. Both run it, so releasing never reshapes a line.
import { simplifyPolyline } from '@livediagram/document';

type Point = { x: number; y: number };

// Visible jitter smoothed away, in SCREEN px: the canvas tolerance is this
// divided by the zoom, so a stroke is as smooth zoomed in as out.
export const PEN_SIMPLIFY_SCREEN_PX = 1.2;

export function simplifyPenStroke(points: Point[], zoom: number): Point[] {
  return simplifyPolyline(points, PEN_SIMPLIFY_SCREEN_PX / (zoom || 1));
}
