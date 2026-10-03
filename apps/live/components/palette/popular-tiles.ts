// Infographic mode's Popular category (docs/specs/007-editor/editor-modes.md "The palette per
// mode"): twelve tiles an infographic is most often built from, picked from the categories the
// mode offers, in the order they are reached for: words and simple marks, a picture and a speech bubble,
// the charts, then the ready-made blocks. Tile ids only, so the catalogue resolves them
// (tilesForCategory) without importing it here.
export const POPULAR_TILE_IDS: readonly string[] = [
  'tools:text',
  'shapes:square',
  'shapes:circle',
  'tools:image',
  'shapes:speech-bubble',
  'data:pie',
  'data:bar',
  'data:progress-ring',
  'components:stat',
  'components:process',
  'tools:timeline',
  'components:callout',
];
