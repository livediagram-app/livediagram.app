// The sheet tools' input and output shapes (docs/specs/029-sheets/sheet-store.md "Agents", docs/specs/015-api/mcp-server.md
// §4.9c): list_sheets, read_sheet, change_sheet and add_sheet. A sheet is named by its title (or id), cells by A1,
// rows by number and columns by letter; never the ids of rows and columns.
import { z } from 'zod';
import {
  AGENT_READ_CELLS_MAX,
  CURRENCY_SYMBOLS,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  NUMBER_FORMATS,
  SHEET_COLS_MAX,
  SHEET_ROWS_MAX,
} from '@livediagram/sheets';

const url = z.string().describe('Link that opens the document in the livediagram editor.');
const documentId = z.string().describe('The document (from find_documents).');
const sheetArg = z
  .string()
  .describe('The sheet, by its title ("Budget") or id. list_sheets lists them.');
const rangeArg = z.string().describe('A cell or range in A1 form: "B4", "A1:D20".');

const cellValue = z
  .union([z.string(), z.number(), z.boolean(), z.null()])
  .describe(
    'A value: text is read as typed in en-GB (a leading = is a formula, "12%" a percent, "03/04/2026" the ' +
      '3rd of April), a JSON number or boolean is kept as it is, null clears the cell.',
  );

const rowsArg = z
  .array(z.array(cellValue).max(SHEET_COLS_MAX).describe('One row, left to right.'))
  .max(SHEET_ROWS_MAX)
  .describe(
    'Rows of values, top to bottom; the sheet grows to fit, up to 10,000 rows and 200 columns.',
  );

const formatArg = z
  .object({
    bold: z.boolean().optional().describe('Bold on (true) or off (false).'),
    italic: z.boolean().optional().describe('Italic on or off.'),
    underline: z.boolean().optional().describe('Underline on or off.'),
    strikethrough: z.boolean().optional().describe('Strikethrough on or off.'),
    color: z.string().nullable().optional().describe('Text colour, #rrggbb; null for the default.'),
    background: z.string().nullable().optional().describe('Fill colour, #rrggbb; null for none.'),
    fontSize: z
      .number()
      .nullable()
      .optional()
      .describe(
        `Font size in points, a whole number from ${FONT_SIZE_MIN} to ${FONT_SIZE_MAX}; null for the default.`,
      ),
    align: z
      .enum(['left', 'center', 'right'])
      .nullable()
      .optional()
      .describe('Horizontal alignment; null for automatic (numbers right, text left).'),
    verticalAlign: z
      .enum(['top', 'middle', 'bottom'])
      .nullable()
      .optional()
      .describe('Vertical alignment; null for the default (bottom).'),
    wrap: z
      .enum(['overflow', 'wrap', 'clip'])
      .nullable()
      .optional()
      .describe('Long text runs over empty neighbours, wraps, or is clipped; null for overflow.'),
    numberFormat: z
      .string()
      .nullable()
      .optional()
      .describe(`How numbers show: ${NUMBER_FORMATS.join(', ')}; null for auto.`),
    decimals: z
      .number()
      .int()
      .min(0)
      .max(10)
      .nullable()
      .optional()
      .describe('Decimal places, 0 to 10; null for the format’s own.'),
    currency: z
      .string()
      .nullable()
      .optional()
      .describe(`The currency symbol: ${CURRENCY_SYMBOLS.join(' ')}; null for the default.`),
  })
  .describe('The parts of the format to set; parts left out are kept.');

const sideArg = z
  .enum(['before', 'after'])
  .optional()
  .describe('Before (the default) or after it.');
const countArg = z.number().int().min(1).max(1000).optional().describe('How many (default 1).');

const sheetChange = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('set').describe('Write rows of values from a cell.'),
    at: z.string().describe('The top-left cell, in A1 form ("A1").'),
    rows: rowsArg,
  }),
  z.object({
    op: z.literal('clear').describe('Clear a range.'),
    range: rangeArg,
    what: z
      .enum(['inputs', 'formats', 'all'])
      .optional()
      .describe('What to clear: inputs, formats, or all (the default).'),
  }),
  z.object({
    op: z.literal('format').describe('Format a range.'),
    range: rangeArg,
    format: formatArg,
  }),
  z.object({
    op: z.literal('insert_rows').describe('Insert rows.'),
    at: z.number().int().min(1).describe('The row number they go beside (1 is the first row).'),
    count: countArg,
    side: sideArg,
  }),
  z.object({
    op: z.literal('insert_cols').describe('Insert columns.'),
    at: z.string().describe('The column letter they go beside ("C").'),
    count: countArg,
    side: sideArg,
  }),
  z.object({
    op: z.literal('delete_rows').describe('Delete rows, and their cells.'),
    rows: z.string().describe('A row number or a span: "3", "3:5".'),
  }),
  z.object({
    op: z.literal('delete_cols').describe('Delete columns, and their cells.'),
    cols: z.string().describe('A column letter or a span: "C", "C:E".'),
  }),
  z.object({
    op: z.literal('rename').describe('Rename the sheet.'),
    title: z.string().describe('The new title, 1 to 60 characters, unique on its tab.'),
  }),
  z.object({
    op: z.literal('sort').describe('Sort rows by a column.'),
    by: z.string().describe('The column to sort by, by letter ("B").'),
    range: rangeArg
      .optional()
      .describe(
        'Only this range’s cells move. Left out, the whole sheet’s rows are reordered (frozen rows stay).',
      ),
    descending: z.boolean().optional().describe('Z to A, largest first (default A to Z).'),
    header: z.boolean().optional().describe('The range’s first row is a header and stays put.'),
  }),
  z.object({
    op: z.literal('freeze').describe('Freeze rows and columns at the top and left.'),
    rows: z.number().int().min(0).max(100).optional().describe('Rows to freeze; 0 unfreezes.'),
    cols: z.number().int().min(0).max(26).optional().describe('Columns to freeze; 0 unfreezes.'),
  }),
]);

export const listSheetsShape = {
  documentId,
  tabId: z.string().optional().describe('Only this tab’s sheets.'),
};

export const readSheetShape = {
  documentId,
  sheet: sheetArg,
  range: rangeArg
    .optional()
    .describe(
      `The cells to read, in A1 form ("A1:F40"). Left out: the filled range. At most ${AGENT_READ_CELLS_MAX} ` +
        'cells a read; the answer says where to read on.',
    ),
};

export const changeSheetShape = {
  documentId,
  sheet: sheetArg,
  changes: z
    .array(sheetChange)
    .min(1)
    .max(50)
    .describe(
      'Applied in order; each sees the sheet as the ones before it left it (an inserted row moves the rows ' +
        'below it). A refused change stops the rest.',
    ),
};

export const addSheetShape = {
  documentId,
  tabId: z
    .string()
    .optional()
    .describe('The tab to put it on; defaults to the first tab with a sheet, else the first tab.'),
  title: z
    .string()
    .optional()
    .describe('The sheet’s title (made unique on the tab); "Sheet 1", "Sheet 2"... when left out.'),
  rows: rowsArg.optional().describe('Its first cells, from A1: rows of values, read as typed.'),
  csv: z
    .string()
    .optional()
    .describe(
      'Its first cells as CSV text instead (a tab in the first line reads as TSV), from A1.',
    ),
};

const listedSheet = z.object({
  id: z.string().describe('The sheet id.'),
  title: z.string().describe('Its title: what read_sheet and change_sheet take.'),
  tabId: z.string().describe('The tab it is on.'),
  tabName: z.string().describe('That tab’s name.'),
  rows: z.number().describe('Rows in use (to the last row with an input).'),
  cols: z.number().describe('Columns in use (to the last column with an input).'),
  filled: z.string().nullable().describe('The range in use, "A1:D12"; null when empty.'),
  elementId: z
    .string()
    .nullable()
    .describe('The Sheet element that frames it on its tab; null when none does.'),
});

export const listSheetsOutput = {
  sheets: z.array(listedSheet).describe('The sheets, in tab order, then by title.'),
  url,
};

const readCell = z.object({
  at: z.string().describe('The cell, in A1 form.'),
  input: z
    .string()
    .describe('What was typed: a formula with its =; empty for a value spilled from a formula.'),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.null()])
    .describe(
      'The worked-out value: a number (dates and times as serial numbers), text, a boolean, or an error as text (#REF!).',
    ),
  display: z.string().describe('What the cell shows, in its number format.'),
});

export const readSheetOutput = {
  sheetId: z.string().describe('The sheet id.'),
  title: z.string().describe('Its title.'),
  tabId: z.string().describe('The tab it is on.'),
  range: z.string().describe('The range read, in A1 form.'),
  rows: z.number().describe('Rows in use in the whole sheet.'),
  cols: z.number().describe('Columns in use in the whole sheet.'),
  cells: z.array(readCell).describe('Every non-empty cell of the range, row by row.'),
  truncated: z.boolean().describe('Whether the read stopped before the end of the range.'),
  note: z.string().optional().describe('Where to read on, when it stopped early.'),
  frozen: z
    .object({
      rows: z.number().describe('Frozen rows at the top.'),
      cols: z.number().describe('Frozen columns at the left.'),
    })
    .describe('What stays in view when the sheet scrolls.'),
  merges: z
    .array(z.string())
    .describe('Merged ranges, in A1 form; a merge shows its top-left cell.'),
  filter: z.string().nullable().describe('The filtered range, in A1 form; null when none.'),
  url,
};

export const changeSheetOutput = {
  sheetId: z.string().describe('The sheet id.'),
  title: z.string().describe('Its title now.'),
  applied: z.array(z.string()).describe('One line per change, in order.'),
  rev: z
    .number()
    .nullable()
    .describe('The sheet revision after them; null when nothing was written.'),
  url,
};

export const addSheetOutput = {
  tabId: z.string().describe('The tab it was put on.'),
  sheetId: z.string().describe('The new sheet’s id.'),
  elementId: z.string().describe('The Sheet element that frames it.'),
  title: z
    .string()
    .describe('Its title, unique on the tab: what read_sheet and change_sheet take.'),
  filled: z.string().nullable().describe('The cells filled, in A1 form; null for a blank sheet.'),
  truncated: z
    .boolean()
    .describe('Whether the first cells were cut at the sheet’s 10,000 rows or 200 columns.'),
  changesetId: z
    .string()
    .nullable()
    .describe('The changeset that placed the element (revertible).'),
  rev: z.number().nullable().describe('The tab revision after it.'),
  url,
};
