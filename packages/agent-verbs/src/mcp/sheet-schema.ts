// The sheet tools' input and output shapes (docs/specs/029-sheets/sheet-store.md "Agents", docs/specs/015-api/mcp-server.md
// §4.9c): list_sheets, read_sheet, change_sheet and add_sheet. A sheet is named by its title (or id), cells by A1,
// rows by number and columns by letter; never the ids of rows and columns.
import { z } from 'zod';
import {
  AGENT_READ_CELLS_MAX,
  AXIS_SIZE_MAX,
  COLUMN_WIDTH_MIN,
  COLUMN_WIDTH_NEW,
  ROW_HEIGHT_MIN,
  ROW_HEIGHT_NEW,
  CURRENCY_SYMBOLS,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  NUMBER_FORMATS,
  SHEET_ACCENTS,
  SHEET_COLS_MAX,
  SHEET_LOOKS,
  SHEET_ROWS_MAX,
} from '@livediagram/sheets';
import { CHART_TYPES } from '@livediagram/document';
import { BORDER_COLOUR_DEFAULT } from '../sheets/sheet-shape-change';
import { DESIGN_ACCENT_DEFAULT } from '../sheets/sheet-design';
import { SHEET_CHART_SIZE } from '../sheets/sheet-charts';

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

const designFormat = z
  .union([z.string(), formatArg])
  .describe(`A number format by name (${NUMBER_FORMATS.join(', ')}), or a format in words.`);

const chartType = z
  .enum(CHART_TYPES)
  .describe('column, bar, line, area, scatter, pie or doughnut.');

const designArg = z
  .object({
    heading: z.string().describe('The title in A1, large and in the accent, across the sheet.'),
    subtitle: z
      .string()
      .optional()
      .describe('A quiet line under it, in A2: what the sheet is for, what to type over.'),
    accent: z
      .enum(SHEET_ACCENTS)
      .optional()
      .describe(
        `The colour family of the header rows, title, totals and charts (default ${DESIGN_ACCENT_DEFAULT}).`,
      ),
    look: z
      .enum(SHEET_LOOKS)
      .optional()
      .describe(
        `banded (default: filled header, every other row tinted, ruled total), header, boxed (every cell lined), minimal (ruled, no gridlines) or plain.`,
      ),
    blocks: z
      .array(
        z.discriminatedUnion('kind', [
          z.object({
            kind: z.literal('table'),
            at: z
              .string()
              .optional()
              .describe('Its header row’s first cell ("A4"); stacked when left out.'),
            head: z.array(z.string()).min(1).describe('The header row: each column’s name.'),
            rows: rowsArg.describe('The body rows, values read as typed (a leading = a formula).'),
            total: z
              .array(cellValue)
              .optional()
              .describe(
                'A total row under the body, bold and ruled above ("Total", null, "=SUM(C5:C12)").',
              ),
            formats: z
              .record(z.string(), designFormat)
              .optional()
              .describe(
                'Formats by column name over the body and total: {"Amount": "currency", "Share": "percent"}.',
              ),
            inputs: z
              .array(z.string())
              .optional()
              .describe('Columns meant to be typed over, by name: tinted soft yellow.'),
            dropdowns: z
              .record(
                z.string(),
                z.object({
                  options: z.array(z.string()).min(1).max(500),
                  colors: z
                    .array(z.string().nullable())
                    .optional()
                    .describe('#rrggbb per option, or null.'),
                }),
              )
              .optional()
              .describe(
                'Dropdown columns by name, over the body rows: each value a chip in its option’s colour.',
              ),
            checkboxes: z
              .array(z.string())
              .optional()
              .describe('Checkbox columns by name (TRUE or FALSE values).'),
            chart: z
              .object({
                type: chartType,
                columns: z
                  .array(z.string())
                  .optional()
                  .describe(
                    'The columns charted by name, the first the labels; every column when left out.',
                  ),
                at: z
                  .string()
                  .optional()
                  .describe('The cell its top-left sits on; right of the table by default.'),
                width: z.number().optional().describe(`px, default ${SHEET_CHART_SIZE.width}.`),
                height: z.number().optional().describe(`px, default ${SHEET_CHART_SIZE.height}.`),
              })
              .optional()
              .describe(
                'A chart of the table’s header and body rows (never its total), live from its cells.',
              ),
          }),
          z.object({
            kind: z.literal('fields'),
            at: z.string().optional().describe('Its first cell; stacked when left out.'),
            heading: z.string().optional().describe('A ruled heading over them.'),
            items: z
              .array(
                z.object({
                  label: z.string().describe('In the first column, quiet.'),
                  value: cellValue.describe('In the column right of it.'),
                  kind: z
                    .enum(['input', 'value', 'result'])
                    .optional()
                    .describe(
                      'input: tinted to type over; result: larger, bold, in the accent; value (default).',
                    ),
                  format: designFormat.optional(),
                }),
              )
              .min(1),
          }),
          z.object({
            kind: z.literal('note'),
            at: z.string().optional(),
            text: z.string().describe('A quiet italic line.'),
          }),
        ]),
      )
      .min(1)
      .describe(
        'In order. Rows 1 to 3 are the heading, subtitle and a gap. A block without at starts on row 4 (the first) ' +
          'or after one blank row under the block before it, in column A; a table is its header row, then its rows, then its ' +
          'total; fields are their heading (if any), then one row per item. So formulas can name the cells their ' +
          'blocks land on. The answer names each block’s ranges.',
      ),
    widths: z
      .array(z.number())
      .optional()
      .describe('Column widths in px from A; each column fitted to its cells when left out.'),
    freeze: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .describe('Rows frozen at the top; through the first table’s header by default.'),
  })
  .describe('A sheet laid out as a template is, on an empty sheet.');

const sideArg = z
  .enum(['before', 'after'])
  .optional()
  .describe('Before (the default) or after it.');
const countArg = z.number().int().min(1).max(1000).optional().describe('How many (default 1).');

const scalePoint = z.object({
  color: z.string().describe('#rrggbb'),
  type: z.enum(['min', 'max', 'number', 'percent', 'percentile']),
  value: z.number().optional().describe('For number, percent and percentile.'),
});

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
    op: z
      .literal('insert_rows')
      .describe(
        'Insert rows. They take the formats of the row above them (below, at the top), so a table keeps its look.',
      ),
    at: z.number().int().min(1).describe('The row number they go beside (1 is the first row).'),
    count: countArg,
    side: sideArg,
  }),
  z.object({
    op: z
      .literal('insert_cols')
      .describe(
        'Insert columns. They take the formats of the column left of them (right, at the left edge).',
      ),
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
  z.object({
    op: z
      .literal('validate')
      .describe(
        'Set what a range may hold (a dropdown, a checkbox, a number, date or text rule); it replaces the rules ' +
          'the range covered.',
      ),
    range: rangeArg,
    rule: z
      .discriminatedUnion('type', [
        z.object({
          type: z.literal('dropdown'),
          options: z.array(z.string()).min(1).max(500).describe('The values offered, in order.'),
          colors: z
            .array(z.string().nullable())
            .optional()
            .describe('A colour per option, #rrggbb, or null.'),
          display: z
            .enum(['chip', 'arrow', 'plain'])
            .optional()
            .describe('How it shows (default chip).'),
        }),
        z.object({
          type: z.literal('dropdown_range'),
          source: rangeArg.describe(
            'The cells (on this sheet) whose values are offered, "A2:A20".',
          ),
          display: z.enum(['chip', 'arrow', 'plain']).optional(),
        }),
        z.object({ type: z.literal('checkbox') }),
        z.object({
          type: z.enum(['number', 'date', 'text']),
          condition: z
            .string()
            .describe(
              'number: between, not_between, greater_than, greater_than_or_equal, less_than, less_than_or_equal, ' +
                'equal, not_equal. date: valid, before, on_or_before, after, on_or_after, on, between, ' +
                'not_between. text: contains, not_contains, exactly, email, url.',
            ),
          value: z
            .union([z.number(), z.string()])
            .optional()
            .describe('A number, a date (YYYY-MM-DD) or text.'),
          value2: z
            .union([z.number(), z.string()])
            .optional()
            .describe('The second value of between.'),
        }),
      ])
      .describe('The rule.'),
    reject: z
      .boolean()
      .optional()
      .describe('Refuse a value it does not allow (default true); false keeps it and marks it.'),
    help: z.string().max(255).optional().describe('Said when a value is refused.'),
  }),
  z.object({
    op: z.literal('clear_validation').describe('Take a range out of every validation rule.'),
    range: rangeArg,
  }),
  z.object({
    op: z
      .literal('conditional_format')
      .describe(
        'Add a format rule (last in the list): a condition and a style, or a colour scale.',
      ),
    range: rangeArg,
    when: z
      .object({
        condition: z
          .string()
          .describe(
            'empty, not_empty, contains, not_contains, starts_with, ends_with, exactly, date_before, ' +
              'date_after, date_on, greater_than, greater_than_or_equal, less_than, less_than_or_equal, ' +
              'between, equal, not_equal, or formula.',
          ),
        value: z.union([z.string(), z.number()]).optional(),
        value2: z
          .union([z.string(), z.number()])
          .optional()
          .describe('The second value of between.'),
        formula: z
          .string()
          .optional()
          .describe("formula's: written for the range's top-left cell, like =$C2>100."),
      })
      .optional(),
    style: z
      .object({
        bold: z.boolean().optional(),
        italic: z.boolean().optional(),
        underline: z.boolean().optional(),
        strikethrough: z.boolean().optional(),
        color: z.string().optional().describe('#rrggbb'),
        background: z.string().optional().describe('#rrggbb'),
      })
      .optional()
      .describe("when's style."),
    scale: z
      .object({
        min: scalePoint,
        mid: scalePoint.optional(),
        max: scalePoint,
      })
      .optional()
      .describe('A colour scale instead of when: each number shaded between the points.'),
    first: z
      .boolean()
      .optional()
      .describe('Put it first in the list (default last): the first rule a cell meets draws it.'),
  }),
  z.object({
    op: z
      .literal('design')
      .describe(
        'Lay an empty sheet out as a template is: its heading, tables, fields and notes, in a look and an accent, with charts.',
      ),
    design: designArg,
  }),
  z.object({
    op: z
      .literal('chart')
      .describe(
        'Put a chart over the sheet’s cells, reading a range live (it grows with rows inserted inside it).',
      ),
    type: chartType,
    range: rangeArg.describe(
      'Its header row (the series’ names) and data rows, the first column the labels: "A4:C12".',
    ),
    columns: z
      .array(z.string())
      .optional()
      .describe('Only these columns of it, by letter (["A", "D"]), the first the labels.'),
    at: z
      .string()
      .optional()
      .describe('The cell its top-left sits on; right of the range, a column clear, by default.'),
    width: z.number().optional().describe(`px, default ${SHEET_CHART_SIZE.width}.`),
    height: z.number().optional().describe(`px, default ${SHEET_CHART_SIZE.height}.`),
  }),
  z.object({
    op: z
      .literal('resize')
      .describe('Size columns (px, or fit to what their cells show) or rows (px).'),
    cols: z.string().optional().describe('Columns, "C" or "A:F".'),
    rows: z.string().optional().describe('Rows, "3" or "4:20".'),
    px: z
      .number()
      .optional()
      .describe(
        `Width or height in px: columns ${COLUMN_WIDTH_MIN} to ${AXIS_SIZE_MAX}, rows ${ROW_HEIGHT_MIN} to ${AXIS_SIZE_MAX}. A new sheet's are ${COLUMN_WIDTH_NEW} by ${ROW_HEIGHT_NEW}.`,
      ),
    fit: z
      .boolean()
      .optional()
      .describe(
        'Columns only: each as wide as the widest value it shows (a dropdown chip’s room included), 56 to 360 px; a cell merged across columns does not count.',
      ),
  }),
  z.object({
    op: z
      .literal('merge')
      .describe(
        'Merge a range into one cell showing its top-left value; other values in it are cleared.',
      ),
    range: rangeArg,
    across: z.boolean().optional().describe('Merge each row of the range on its own instead.'),
  }),
  z.object({
    op: z.literal('unmerge').describe('Unmerge every merge touching a range.'),
    range: rangeArg,
  }),
  z.object({
    op: z.literal('border').describe('Draw borders on a range.'),
    range: rangeArg,
    sides: z
      .enum(['all', 'outer', 'inner', 'top', 'bottom', 'left', 'right', 'none'])
      .optional()
      .describe('Which lines (default all); none takes them off.'),
    color: z.string().optional().describe(`#rrggbb (default ${BORDER_COLOUR_DEFAULT}).`),
    width: z
      .union([z.literal(1), z.literal(2), z.literal(3)])
      .optional()
      .describe('1 (default) to 3 px.'),
    style: z.enum(['solid', 'dashed', 'dotted']).optional().describe('Default solid.'),
  }),
  z.object({
    op: z
      .literal('filter')
      .describe(
        'Turn the filter on over a range (its first row the header, each column filterable), or off.',
      ),
    range: rangeArg.nullable().optional().describe('The range; left out or null turns it off.'),
  }),
  z.object({
    op: z
      .literal('clear_conditional_formats')
      .describe('Remove the format rules touching a range, or every one.'),
    range: rangeArg.optional(),
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
