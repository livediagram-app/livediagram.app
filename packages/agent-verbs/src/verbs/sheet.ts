// The sheet verbs (docs/specs/029-sheets/sheet-store.md "Agents"): list a document's sheets, read one's cells by A1,
// set cells (or a CSV from a file or stdin), put a new Sheet on a tab, and insert or delete rows and columns, through
// the sheet engine the MCP's list_sheets, read_sheet, change_sheet and add_sheet share. Sheets are named by title
// or id, cells by A1, rows by number and columns by letter.
import { z } from 'zod';
import { parseCsv } from '@livediagram/sheets';
import { defineVerb, VerbRefusal, type Verb, type VerbContext } from '../define';
import { addSheet } from '../sheets/add-sheet';
import { changeSheet } from '../sheets/change-sheet';
import { listSheets } from '../sheets/sheet-listing';
import { readSheet } from '../sheets/read-sheet';
import type { SheetChange } from '../sheets/sheet-change-build';
import { columns, documentOf } from './shared';

const docArg = z.string().describe('A name, id prefix or livediagram URL');
const sheetArg = z.string().describe('The sheet, by title or id');
const LS_HINT = 'list the sheets with: livediagram sheet ls <doc>';

const refusal = (code: string, message: string) =>
  new VerbRefusal({ status: code === 'sheet_not_found' ? 404 : 400, code, message, hint: LS_HINT });

const changeOutput = z.object({
  sheetId: z.string(),
  title: z.string(),
  applied: z.array(z.string()),
  rev: z.number().nullable(),
});

// Changes through the engine, a refusal as the verb's.
async function changeVia(
  ctx: VerbContext,
  doc: string,
  sheet: string,
  changes: SheetChange[],
): Promise<z.infer<typeof changeOutput>> {
  const document = await documentOf(ctx, doc);
  const result = await changeSheet(ctx.api, document.id, { sheet, changes }, 'cli');
  // Each verb sends one change, so a refusal means nothing went through.
  if (result.refusal) throw refusal(result.refusal.code, result.refusal.message);
  return { sheetId: result.sheetId, title: result.title, applied: result.applied, rev: result.rev };
}

const changeText = ({ title, applied }: z.infer<typeof changeOutput>) =>
  applied.map((line) => `~ sheet ${JSON.stringify(title)}: ${line}`);

export const sheetLs = defineVerb({
  id: 'sheet.ls',
  summary: "List a document's sheets",
  description:
    'Lists the sheets on the tabs of a document: title, tab, the range in use and the id, one a line.',
  behaviour: 'read',
  input: z.object({ doc: docArg, tab: z.string().optional().describe('Only this tab id') }),
  output: z.object({
    sheets: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        tabId: z.string(),
        tabName: z.string(),
        rows: z.number(),
        cols: z.number(),
        filled: z.string().nullable(),
        elementId: z.string().nullable(),
      }),
    ),
  }),
  run: async (ctx, input) => {
    const document = await documentOf(ctx, input.doc);
    return listSheets(ctx.api, document.id, input.tab);
  },
  text: ({ sheets }) =>
    sheets.length
      ? columns(sheets.map((s) => [s.title, s.tabName, s.filled ?? 'empty', s.id]))
      : ['no sheets'],
  quiet: ({ sheets }) => sheets.map((s) => s.id),
  listKey: 'sheets',
  cli: {
    positionals: ['doc'],
    examples: ['livediagram sheet ls "Budget 2027"', 'livediagram sheet ls 3f9c --tab tab-one'],
    prints: '<title>  <tab>  <range in use>  <id>, one sheet a line',
  },
});

export const sheetGet = defineVerb({
  id: 'sheet.get',
  summary: "Read a sheet's cells",
  description:
    "Prints a range's non-empty cells (the range in use by default), one a line: the cell, its input as typed and, for a formula, what it works out to.",
  behaviour: 'read',
  input: z.object({
    doc: docArg,
    sheet: sheetArg,
    range: z.string().optional().describe('A cell or range in A1 form, like A1:D20'),
  }),
  output: z.object({
    title: z.string(),
    range: z.string(),
    cells: z.array(
      z.object({
        at: z.string(),
        input: z.string(),
        value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
        display: z.string(),
      }),
    ),
    note: z.string().optional(),
  }),
  run: async (ctx, input) => {
    const document = await documentOf(ctx, input.doc);
    const read = await readSheet(ctx.api, document.id, {
      sheet: input.sheet,
      ...(input.range ? { range: input.range } : {}),
    });
    if (!read.ok) throw refusal(read.code, read.message);
    return {
      title: read.title,
      range: read.range,
      cells: read.cells,
      ...(read.note ? { note: read.note } : {}),
    };
  },
  text: ({ cells, note }) => [
    ...columns(
      cells.map((c) => [
        c.at,
        c.input.startsWith('=') || !c.input ? `${c.input}  → ${c.display}` : c.input,
      ]),
    ),
    ...(note ? [note] : []),
  ],
  quiet: ({ cells }) => cells.map((c) => c.display),
  listKey: 'cells',
  cli: {
    positionals: ['doc', 'sheet', 'range'],
    examples: [
      'livediagram sheet get "Budget 2027" Costs',
      'livediagram sheet get 3f9c Costs B2:D40',
    ],
    prints: '<cell>  <input>, and → <value> after a formula, one cell a line',
  },
});

export const sheetSet = defineVerb({
  id: 'sheet.set',
  summary: 'Set cells of a sheet',
  description:
    'Writes values across a row from a cell, or the rows of a CSV file (stdin with --csv -) from it, read as typed: a leading = is a formula.',
  behaviour: 'destructive',
  input: z.object({
    doc: docArg,
    sheet: sheetArg,
    at: z.string().describe('The first cell, in A1 form'),
    values: z.array(z.string()).describe('Values for the row, left to right'),
    csv: z.string().optional().describe('A CSV file to write from the cell, or - for stdin'),
  }),
  output: changeOutput,
  run: async (ctx, input) => {
    const rows =
      input.csv !== undefined ? parseCsv(await ctx.readInput(input.csv)).rows : [input.values];
    if (!rows.length || rows.every((r) => r.length === 0))
      throw new VerbRefusal({
        status: 400,
        code: 'usage',
        message: 'nothing to write: give values after the cell, or --csv <file>',
        hint: 'for example: livediagram sheet set Budget Costs B2 1200 =B2*12',
      });
    return changeVia(ctx, input.doc, input.sheet, [{ op: 'set', at: input.at, rows }]);
  },
  text: changeText,
  quiet: ({ sheetId }) => [sheetId],
  cli: {
    positionals: ['doc', 'sheet', 'at', '...values'],
    examples: [
      'livediagram sheet set "Budget 2027" Costs B2 1200 =B2*12',
      'cat costs.csv | livediagram sheet set 3f9c Costs A1 --csv -',
    ],
    prints: '~ sheet "<title>": set <range>',
  },
});

export const sheetAdd = defineVerb({
  id: 'sheet.add',
  summary: 'Put a new Sheet on a tab',
  description:
    'Puts a new Sheet beside what a tab holds, titled uniquely on the tab, blank or filled from a CSV file (or stdin) from A1.',
  behaviour: 'write',
  input: z.object({
    doc: docArg,
    tab: z
      .string()
      .optional()
      .describe('The tab id; the first tab with a sheet, else the first tab'),
    title: z.string().optional().describe('The title (made unique on the tab)'),
    csv: z.string().optional().describe('A CSV file to fill it from, or - for stdin'),
  }),
  output: z.object({
    tabId: z.string(),
    sheetId: z.string(),
    elementId: z.string(),
    title: z.string(),
    filled: z.string().nullable(),
  }),
  run: async (ctx, input) => {
    const document = await documentOf(ctx, input.doc);
    const csv = input.csv !== undefined ? await ctx.readInput(input.csv) : undefined;
    const result = await addSheet(
      ctx.api,
      document.id,
      {
        ...(input.tab ? { tabId: input.tab } : {}),
        ...(input.title ? { title: input.title } : {}),
        ...(csv !== undefined ? { csv } : {}),
      },
      'cli',
    );
    if (!result.ok) throw refusal(result.code, result.message);
    if (result.truncated) ctx.notice('the CSV was cut at 10,000 rows or 200 columns');
    const { tabId, sheetId, elementId, title, filled } = result;
    return { tabId, sheetId, elementId, title, filled };
  },
  text: ({ title, filled }) => [`+ sheet ${JSON.stringify(title)}${filled ? `: ${filled}` : ''}`],
  quiet: ({ sheetId }) => [sheetId],
  cli: {
    positionals: ['doc'],
    examples: [
      'livediagram sheet add "Budget 2027" --title Costs',
      'livediagram sheet add 3f9c --tab tab-one --csv costs.csv',
    ],
    prints: '+ sheet "<title>": <range filled>',
  },
});

// Inserting or deleting rows or columns: one change a call.
function axisVerb(
  id: string,
  summary: string,
  description: string,
  where: z.ZodType<string>,
  build: (input: { where: string; count?: string; after?: boolean }) => SheetChange,
  examples: [string, string],
): Verb {
  const inserts = id.includes('insert');
  return defineVerb({
    id,
    summary,
    description,
    behaviour: inserts ? 'write' : 'destructive',
    input: z.object({
      doc: docArg,
      sheet: sheetArg,
      where,
      ...(inserts
        ? {
            count: z.string().optional().describe('How many (default 1)'),
            after: z.boolean().optional().describe('After it rather than before'),
          }
        : {}),
    }),
    output: changeOutput,
    run: async (ctx, input) => {
      const { doc, sheet, ...rest } = input as { doc: string; sheet: string; where: string };
      const count = (rest as { count?: string }).count;
      if (count !== undefined && !/^[1-9][0-9]{0,3}$/.test(count))
        throw new VerbRefusal({
          status: 400,
          code: 'usage',
          message: `--count takes 1 to 1000, got ${JSON.stringify(count)}`,
          hint: examples[1],
        });
      return changeVia(ctx, doc, sheet, [build(rest)]);
    },
    text: changeText,
    quiet: ({ sheetId }) => [sheetId],
    cli: {
      positionals: ['doc', 'sheet', 'where'],
      examples,
      prints: '~ sheet "<title>": <what changed>',
    },
  }) as Verb;
}

const side = (after?: boolean) => (after ? 'after' : 'before') as 'after' | 'before';
const count = (c?: string) => (c ? Math.min(1000, Number(c)) : 1);

export const sheetInsertRows = axisVerb(
  'sheet.insert-rows',
  'Insert rows into a sheet',
  'Inserts rows before (or with --after, after) a row, by number; formulas keep reading the cells they read.',
  z.string().describe('The row number'),
  (i) => ({ op: 'insert_rows', at: Number(i.where), count: count(i.count), side: side(i.after) }),
  [
    'livediagram sheet insert-rows Budget Costs 4',
    'livediagram sheet insert-rows 3f9c Costs 4 --count 3 --after',
  ],
);

export const sheetInsertCols = axisVerb(
  'sheet.insert-cols',
  'Insert columns into a sheet',
  'Inserts columns before (or with --after, after) a column, by letter; formulas keep reading the cells they read.',
  z.string().describe('The column letter'),
  (i) => ({ op: 'insert_cols', at: i.where, count: count(i.count), side: side(i.after) }),
  [
    'livediagram sheet insert-cols Budget Costs C',
    'livediagram sheet insert-cols 3f9c Costs C --count 2 --after',
  ],
);

export const sheetRmRows = axisVerb(
  'sheet.rm-rows',
  'Delete rows from a sheet',
  'Deletes a row or a span of rows ("3:5") and their cells; a formula reading a deleted cell reads #REF!.',
  z.string().describe('A row number or span, like 3:5'),
  (i) => ({ op: 'delete_rows', rows: i.where }),
  ['livediagram sheet rm-rows Budget Costs 7', 'livediagram sheet rm-rows 3f9c Costs 3:5'],
);

export const sheetRmCols = axisVerb(
  'sheet.rm-cols',
  'Delete columns from a sheet',
  'Deletes a column or a span of columns ("C:E") and their cells; a formula reading a deleted cell reads #REF!.',
  z.string().describe('A column letter or span, like C:E'),
  (i) => ({ op: 'delete_cols', cols: i.where }),
  ['livediagram sheet rm-cols Budget Costs D', 'livediagram sheet rm-cols 3f9c Costs C:E'],
);

export const sheetVerbs: readonly Verb[] = [
  sheetLs,
  sheetGet,
  sheetSet,
  sheetAdd,
  sheetInsertRows,
  sheetInsertCols,
  sheetRmRows,
  sheetRmCols,
] as Verb[];
