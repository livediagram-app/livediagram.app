// The category dropdown's bands, in order (docs/specs/010-palette/palette-top-level-categories.md).
// Tabs are listed in band order in the caller's `tabs` array, so the grid renders them under
// these headings without a sort.
export const CATEGORY_BANDS: Record<number, string> = {
  0: 'Common',
  // Structure (docs/specs/010-palette/palette-top-level-categories.md): the elements you lay a diagram OUT with — Build's
  // containers, the ready-made Components, the device frames. They sit above
  // Decorate because arranging the canvas comes before dressing it.
  1: 'Structure',
  2: 'Decorate',
  3: 'Dynamic',
  // Workshop mode's session kit (docs/specs/012-collaboration/workshop-mode.md "The palette"): the
  // six Collaborate categories, under the name the elements go by rather than Dynamic.
  6: 'Collaborate',
};
