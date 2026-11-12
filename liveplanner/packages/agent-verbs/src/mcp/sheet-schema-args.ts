// The building blocks the sheet tools' shapes share (sheet-schema.ts): a range, rows of values, a cell format, a
// design and the small arguments the changes reuse, kept apart so the change union and the tool shapes read alone.
import { z } from 'zod';
import {
  CURRENCY_SYMBOLS,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  NUMBER_FORMATS,
  SHEET_ACCENTS,
  SHEET_COLS_MAX,
  SHEET_LOOKS,
  SHEET_ROWS_MAX,
} from '@liveplanner/sheets';
import { CHART_PALETTES, CHART_TYPES, type ChartPaletteId } from '@liveplanner/project';
import { DESIGN_ACCENT_DEFAULT } from '../sheets/sheet-design';
import { SHEET_CHART_SIZE } from '../sheets/sheet-charts';

export const rangeArg = z.string().describe('A cell or range in A1 form: "B4", "A1:D20".');

const cellValue = z
  .union([z.string(), z.number(), z.boolean(), z.null()])
  .describe(
    'A value: text is read as typed in en-GB (a leading = is a formula, "12%" a percent, "03/04/2026" the ' +
      '3rd of April), a JSON number or boolean is kept as it is, null clears the cell.',
  );

export const rowsArg = z
  .array(z.array(cellValue).max(SHEET_COLS_MAX).describe('One row, left to right.'))
  .max(SHEET_ROWS_MAX)
  .describe(
    'Rows of values, top to bottom; the sheet grows to fit, up to 10,000 rows and 200 columns.',
  );

export const formatArg = z
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
  .describe(
    `A number format by name (${NUMBER_FORMATS.join(', ')}; number, currency and percent show 2 decimals), or a format in words ({"numberFormat": "number", "decimals": 0} for whole numbers).`,
  );

export const chartType = z
  .enum(CHART_TYPES)
  .describe(
    'column, bar, pie and doughnut draw one series (the first value column); line, area and scatter draw every value column.',
  );

export const chartPalette = z
  .enum(CHART_PALETTES.map((p) => p.id) as [ChartPaletteId, ...ChartPaletteId[]])
  .optional()
  .describe(
    'Its colours. Left out: the family of its table’s header (a design’s accent: emerald and teal forest; sky, blue, indigo and cyan ocean; amber and orange sunset; rose, violet, purple and fuchsia berry), else vivid; a line, area or scatter chart of several series vivid, so its lines tell apart.',
  );

export const designArg = z
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
            kind: z.literal('table').describe('A block is a table, fields or a note.'),
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
                palette: chartPalette,
              })
              .optional()
              .describe(
                'A chart of the table’s header and body rows (never its total), live from its cells.',
              ),
          }),
          z.object({
            kind: z.literal('fields').describe('Labels and values, two columns.'),
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
            kind: z.literal('note').describe('One quiet line.'),
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
      .describe(
        'Rows frozen at the top; by default through the header of the table with the most rows, when it starts by row 12.',
      ),
  })
  .describe('A sheet laid out as a template is, on an empty sheet.');

export const sideArg = z
  .enum(['before', 'after'])
  .optional()
  .describe('Before (the default) or after it.');
export const countArg = z
  .number()
  .int()
  .min(1)
  .max(1000)
  .optional()
  .describe('How many (default 1).');

export const scalePoint = z.object({
  color: z.string().describe('#rrggbb'),
  type: z.enum(['min', 'max', 'number', 'percent', 'percentile']),
  value: z.number().optional().describe('For number, percent and percentile.'),
});
