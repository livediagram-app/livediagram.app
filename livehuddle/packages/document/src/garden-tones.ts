// The fixed colours of the Office Pod, the bar and the garden (docs/specs/009-elements/office.md "Office Pod" to
// "Garden Fence"), and the ground's own fills; office-garden.ts re-exports them.

// Fixed colours for what keeps its colour whatever the theme, as OFFICE_TONES: leaves, bark, stone, wood, glass,
// bottles and cans. Outlines stay the theme's stroke.
export const GARDEN_TONES = {
  leaf: '#63ad5c',
  leafDeep: '#428c46',
  leafDark: '#2f6e38',
  bark: '#8a5a32',
  barkDeep: '#5f3d22',
  stone: '#dedad3',
  stoneDeep: '#a39d94',
  pink: '#e58fb0',
  yellow: '#dfc05a',
  wood: '#b98352',
  woodDeep: '#7c4f2c',
  counter: '#4a4643',
  glass: '#dbe6ee',
  glassDeep: '#b9c8d4',
  cushion: '#8496bd',
  cushionDeep: '#64769f',
  picket: '#ffffff',
  // An office pod's acoustic walls, its trim, its carpet and its oak table.
  podWall: '#ece6dc',
  podTrim: '#cdbfa9',
  podCarpet: '#b9b2a6',
  oak: '#cf9d6b',
  bottles: ['#2f7d4a', '#a8642a', '#b5403a', '#3a86b8', '#7e5aa8', '#d5b043'],
  cans: ['#c8453d', '#3f74b8', '#3f9a5a', '#d28f36'],
} as const;

/** A garden path's gravel when it has no fill of its own: a warm sand, and its deep twin on dark paper. */
export const GARDEN_PATH_FILL = '#e7dcc4';
export const GARDEN_PATH_FILL_DARK = '#57534e';

/** Grass's lawn when it has no fill of its own: a fresh green, and its deep twin on dark paper. */
export const GRASS_FILL = '#9bd27a';
export const GRASS_FILL_DARK = '#2f4a2c';
