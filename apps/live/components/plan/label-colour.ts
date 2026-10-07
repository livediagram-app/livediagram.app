// A label's colour (docs/specs/026-plan/items.md "Fields"): one of the Plan swatches, the same for the same label
// everywhere it shows (the card panel's label editor, a card face's label chips).
const LABEL_COLOURS = [
  '#2563eb',
  '#16a34a',
  '#7c3aed',
  '#d97706',
  '#0d9488',
  '#db2777',
  '#ea580c',
  '#0891b2',
];

export function labelColour(label: string): string {
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return LABEL_COLOURS[h % LABEL_COLOURS.length]!;
}
