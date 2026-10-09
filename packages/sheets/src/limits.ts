// Every bound the sheets engine, the sheet store and the editor share
// (docs/specs/029-sheets/blueprints/sheets-engine.md "Constants and configuration"). Provenance and safe ranges
// are in the blueprint's table; change a value there first.

// A new sheet's grid.
export const SHEET_ROWS_NEW = 100;
export const SHEET_COLS_NEW = 26;

// The grid's ceiling.
export const SHEET_ROWS_MAX = 10_000;
export const SHEET_COLS_MAX = 200;

// Cells with an input or a format, and their stored bytes, per sheet and per document.
export const SHEET_CELLS_MAX = 50_000;
export const SHEET_BYTES_MAX = 4 * 1024 * 1024;
export const DOCUMENT_SHEETS_MAX = 200;
export const DOCUMENT_CELLS_MAX = 200_000;

// One cell's input, and a formula's length and nesting.
export const INPUT_MAX = 10_000;
export const FORMULA_MAX = 8_000;
export const FORMULA_DEPTH_MAX = 64;

export const SHEET_TITLE_MAX = 60;
// The most rows and columns a freeze keeps in place (more would leave no room to scroll in a Sheet's frame).
export const SHEET_FREEZE_ROWS_MAX = 100;
export const SHEET_FREEZE_COLS_MAX = 26;
export const SHEET_MERGES_MAX = 1_000;
export const SHEET_SIZED_AXES_MAX = 5_000;

// One write's size: the editor splits a larger paste, fill or import.
export const SHEET_WRITE_CELLS_MAX = 5_000;
export const SHEET_WRITE_BYTES_MAX = 1024 * 1024;

// The evaluator's budgets: a hostile sheet costs at most this much per recalculation.
export const RECALC_READS_MAX = 5_000_000;
export const RANGE_CELLS_MAX = 1_000_000;
export const ARRAY_CELLS_MAX = 100_000;
export const TEXT_RESULT_MAX = 10_000;
export const REGEX_WORK_MAX = 10_000_000;

// A new sheet's sizes, and the smallest a person can drag to.
export const COLUMN_WIDTH_NEW = 120;
export const ROW_HEIGHT_NEW = 28;
export const COLUMN_WIDTH_MIN = 24;
export const ROW_HEIGHT_MIN = 18;
export const AXIS_SIZE_MAX = 2_000;
// Card tables (sheet.md "Card tables"): how many a sheet holds, and how many rows each links.
export const CARD_TABLES_MAX = 8;
// Named ranges (docs/specs/029-sheets/sheet.md "Named ranges"): a name's length and how many a sheet holds.
export const RANGE_NAME_MAX = 60;
export const RANGE_NAMES_MAX = 100;
export const CARD_TABLE_ROWS_MAX = 2_000;
// A card table's Controls column's width (Save and Cancel, two 24 px buttons).
export const CARD_CONTROLS_COL_PX = 72;

// Decimals a number format may show.
export const DECIMALS_MAX = 10;
