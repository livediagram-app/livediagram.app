import {
  createFreehand,
  defaultStrokeColor,
  WHITEBOARD_INK,
  type Appearance,
  type CanvasSurface,
} from '@livediagram/document';

// The colour a pen with no colour of its own (Marker 1, the Freehand pencil, the Shape Pen) inks
// in, as the stroke being drawn and the pen cursor show it (docs/specs/008-canvas/two-pens.md
// "Ink"): on a whiteboard the board's ink; on a diagram tab the theme's element stroke, or the
// default a colourless freehand is drawn in on this canvas, so the stroke lands the colour it
// showed.
const SAMPLE_STROKE = createFreehand([], false);

export function penInkFor({
  whiteboard,
  appearance,
  themeStroke,
  surface,
}: {
  whiteboard: boolean;
  appearance: Appearance;
  themeStroke: string | undefined;
  surface: CanvasSurface;
}): string {
  if (whiteboard) return WHITEBOARD_INK[appearance];
  return themeStroke ?? defaultStrokeColor(SAMPLE_STROKE, surface);
}
