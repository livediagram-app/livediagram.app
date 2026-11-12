// The sheet tools' input and output shapes (docs/specs/029-sheets/sheet-store.md "Agents", docs/specs/015-api/mcp-server.md
// §4.9c): list_sheets, read_sheet, change_sheet and add_sheet. A sheet is named by its title (or id), cells by A1,
// rows by number and columns by letter; never the ids of rows and columns.
import { z } from 'zod';
import { AGENT_READ_CELLS_MAX } from '@liveplanner/sheets';
import { designArg, rangeArg, rowsArg } from './sheet-schema-args';
import { sheetChange } from './sheet-change-schema';

const url = z.string().describe('Link that opens the plan in the liveplanner editor.');
const projectId = z.string().describe('The plan (from find_projects).');
const sheetArg = z
  .string()
  .describe('The sheet, by its title ("Budget") or id. list_sheets lists them.');

export const listSheetsShape = {
  projectId,
  tabId: z.string().optional().describe('Only this tab’s sheets.'),
};

export const readSheetShape = {
  projectId,
  sheet: sheetArg,
  range: rangeArg
    .optional()
    .describe(
      `The cells to read, in A1 form ("A1:F40"). Left out: the filled range. At most ${AGENT_READ_CELLS_MAX} ` +
        'cells a read; the answer says where to read on.',
    ),
};

export const changeSheetShape = {
  projectId,
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
  projectId,
  tabId: z
    .string()
    .optional()
    .describe(
      'The tab to put it on, which must be in Plan; defaults to the first tab with a sheet, else the first tab.',
    ),
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
  design: designArg
    .optional()
    .describe(
      'Or the sheet laid out as a template is (the same design change_sheet takes); the Sheet is made large enough to show it.',
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
  invalid: z
    .string()
    .optional()
    .describe('Set when its validation rule does not allow the value: what the rule allows.'),
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
  validation: z
    .array(z.record(z.string(), z.unknown()))
    .describe('Validation rules: range, type, options or condition, what it allows, reject, help.'),
  conditionalFormats: z
    .array(z.record(z.string(), z.unknown()))
    .describe(
      'Format rules in list order (the first met draws a cell): range, rule, style or scale.',
    ),
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
  laidOut: z
    .string()
    .optional()
    .describe('What a design laid out: each block’s ranges in A1, and its charts.'),
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
