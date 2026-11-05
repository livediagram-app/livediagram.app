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
  // The meeting palette's Space categories and Selection Mode (docs/specs/012-collaboration/workshop-mode.md "The
  // palette"): what a Space is built from and walked round.
  6: 'Meet',
  // Travel, apart from the furnishing (docs/specs/010-palette/palette-top-level-categories.md "The strip's order").
  7: 'Travel',
};
