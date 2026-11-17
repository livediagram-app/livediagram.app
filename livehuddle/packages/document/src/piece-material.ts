// What an office piece is made of when it has no fill of its own (docs/specs/009-elements/furniture-art-style.md
// "Materials"): the colour its unpainted parts take, solid so a piece never shows the floor through it. Shelves
// and cabinets are wood, columns stone, planters concrete, and machines a soft appliance white. Seating has its own
// fabric (seatFabric); a rug its own fill. Pure.

const MATERIAL: Readonly<Record<string, string>> = {
  bookshelf: '#b98352',
  'drinks-cabinet': '#b98352',
  'world-clock': '#b98352',
  'notice-board': '#b98352',
  lockers: '#9aa3ad',
  pillar: '#e4ded3',
  column: '#e4ded3',
  'outdoor-plant': '#c9c4bb',
  'garden-path': '#cfc9bf',
  'umbrella-stand': '#59616d',
  'coat-rack': '#7c4f2c',
};

/** The appliance white a machine is made of: a printer, a fridge, a water cooler. */
export const APPLIANCE_WHITE = '#e6e9ee';

/** A piece's own fill, or its kind's material when it has none (or `transparent`). */
export function pieceMaterial(kind: string, fillColor: string | undefined): string {
  if (fillColor && fillColor !== 'transparent') return fillColor;
  return MATERIAL[kind] ?? APPLIANCE_WHITE;
}
