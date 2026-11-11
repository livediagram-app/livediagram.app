// change_sheet's changes (sheet-schema.ts): one object per op, applied in order. Rows by number, columns by letter.
import { z } from 'zod';
import {
  AXIS_SIZE_MAX,
  COLUMN_WIDTH_MIN,
  COLUMN_WIDTH_NEW,
  ROW_HEIGHT_MIN,
  ROW_HEIGHT_NEW,
} from '@liveplanner/sheets';
import { BORDER_COLOUR_DEFAULT } from '../sheets/sheet-shape-change';
import { SHEET_CHART_SIZE } from '../sheets/sheet-charts';
import {
  chartPalette,
  chartType,
  countArg,
  designArg,
  formatArg,
  rangeArg,
  rowsArg,
  scalePoint,
  sideArg,
} from './sheet-schema-args';

export const sheetChange = z.discriminatedUnion('op', [
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
        'Insert rows. They take the formats of the row above them (below, at the top), so a table keeps its look. ' +
          'Formulas, rules and charts reading a range grow with rows inserted inside it, not at its edge.',
      ),
    at: z.number().int().min(1).describe('The row number they go beside (1 is the first row).'),
    count: countArg,
    side: sideArg,
  }),
  z.object({
    op: z
      .literal('insert_cols')
      .describe(
        'Insert columns. They take the look of the column left of them (right, at the left edge), not its number ' +
          'format. Formulas, rules and charts reading a range grow with columns inserted inside it, not at its edge; ' +
          'charts keep to the cells they sit on.',
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
          type: z
            .literal('dropdown')
            .describe('A rule is a dropdown, dropdown_range, checkbox, number, date or text.'),
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
    palette: chartPalette,
  }),
  z.object({
    op: z
      .literal('clear_charts')
      .describe(
        'Take the sheet’s charts off its tab: those reading cells of a range, or every one.',
      ),
    range: rangeArg.optional().describe('Only the charts reading cells of this range.'),
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
