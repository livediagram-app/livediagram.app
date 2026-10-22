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
  // Boards and Cards, listed first in a layout that offers them, straight after Popular.
  4: 'Boards & Cards',
  // Sheets, after Boards & Cards.
  5: 'Spreadsheets',
  // The session kit: the six Collaborate categories, under the name the elements go by rather than
  // Dynamic.
  6: 'Collaborate',
  // A wireframe page's own band (docs/specs/007-editor/wireframe-pages.md "The Elements palette"):
  // Components and Elements, first, set apart from the rest.
  7: 'Screen',
};
