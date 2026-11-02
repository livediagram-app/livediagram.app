// A label's colour (docs/specs/026-plan/items.md "Fields"): one of the Plan swatches, the same for the same label
// everywhere it shows (the card panel's label editor, a card face's label chips).
export const LABEL_COLOURS = [
  '#2563eb',
  '#16a34a',
  '#7c3aed',
  '#d97706',
  '#0d9488',
  '#db2777',
  '#ea580c',
  '#0891b2',
];

// A chip tinted by its own colour (set as `--chip`): a 12% tint, inked with 70% of the colour mixed toward the page's
// ink (dark in light mode, white in dark), which reads at 4.5:1 for every swatch. The label chips' look, shared by a
// Choice field's option chips.
export const TINT_CHIP =
  'bg-[color-mix(in_srgb,var(--chip)_12%,transparent)] text-[color-mix(in_srgb,var(--chip)_70%,#0f172a)] dark:text-[color-mix(in_srgb,var(--chip)_70%,#ffffff)]';

export function labelColour(label: string): string {
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return LABEL_COLOURS[h % LABEL_COLOURS.length]!;
}
