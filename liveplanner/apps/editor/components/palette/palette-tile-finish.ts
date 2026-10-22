// Palette tiles in the tab's finish (docs/specs/008-canvas/finish.md "Where it shows"): every tile places an element,
// so every tile draws its glyph in the finish that element will land in, and the whole palette previews the tab.
// Professional squares and thins a line glyph; Sketch wobbles every glyph through the shared sketch filter
// (SketchFilterDefs); Marker draws a line glyph bold with round ends, a felt-tip's line.
import type { Finish } from '@liveplanner/project';

/** The id of the one SVG filter Sketch tiles are drawn through. */
export const SKETCH_TILE_FILTER_ID = 'lvd-sketch-tile';

/** How a tile enters (the flyout's cascade, the strip's): a pop-in, except under Sketch, where it fades. A Sketch glyph
 *  is drawn through an SVG filter, and Chrome could keep a filtered glyph rasterised at a pop-in's early, tiny scale,
 *  stretched into a blurred square once the tile reached full size: a different tile each time, as the frames fell. */
export function tileEnterAnimation(finish: Finish | undefined): string {
  return finish === 'sketch' ? 'animate-fade-in' : 'animate-pop-in';
}

/** The class a tile's glyph wrapper carries in a finish (globals.css); empty under Flexible. */
export function paletteFinishClass(finish: Finish | undefined): string {
  if (finish === 'sketch') return 'palette-finish-sketch';
  if (finish === 'marker') return 'palette-finish-marker';
  if (finish === 'professional') return 'palette-finish-professional';
  return '';
}
