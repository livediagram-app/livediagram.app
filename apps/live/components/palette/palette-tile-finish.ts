// Palette tiles in the tab's finish (docs/specs/008-canvas/finish.md "Where it shows"): a tile that places an
// element with a finish draws its glyph in the finish that element will land in, so the palette previews the
// tab. Professional squares and thins the glyph; Sketch wobbles it through the shared sketch filter
// (SketchFilterDefs). Icons, media, faces and tools keep their glyphs, as their elements keep their looks.
import { SELF_PAINTING_SHAPES, type Finish } from '@livediagram/document';
import type { PaletteTileDef } from './palette-tile-defs';

/** The id of the one SVG filter Sketch tiles are drawn through. */
export const SKETCH_TILE_FILTER_ID = 'lvd-sketch-tile';

/** Whether a tile places an element that is drawn in a finish. */
export function tileTakesFinish(action: PaletteTileDef['action']): boolean {
  if (action.type === 'shape')
    return action.kind !== 'icon' && !SELF_PAINTING_SHAPES.has(action.kind);
  return (
    action.type === 'sticky' ||
    action.type === 'text' ||
    action.type === 'table' ||
    action.type === 'arrow'
  );
}

/** The class a finish-taking tile's glyph wrapper carries (globals.css); empty under Flexible. */
export function paletteFinishClass(finish: Finish | undefined): string {
  return finish === 'professional'
    ? 'palette-finish-professional'
    : finish === 'sketch'
      ? 'palette-finish-sketch'
      : '';
}
