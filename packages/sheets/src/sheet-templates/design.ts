// A sheet template's design (docs/specs/029-sheets/sheet.md "Sheet templates"): what it holds and where, by role, so
// one compile step (compile.ts) draws every template the same way in whichever look and canvas it is made in. Pure
// data and a few helpers for writing it; the designs live in money.ts, work.ts and people.ts.
import type { StarterCell } from '../sheet-starters';
import type { FormatPatch } from '../format';
import type { SheetAccent } from './accents';

// A cell position, 0-based: [row, column].
export type At = readonly [number, number];

// A table: a header row, its body rows (every other one tinted under Banded) and, below, a total row (bold, ruled
// above). `formats[j]` is column j's number format and alignment over its body and total.
export type TableBlock = {
  kind: 'table';
  at: At;
  head: readonly string[];
  rows: readonly (readonly StarterCell[])[];
  total?: readonly StarterCell[];
  formats?: readonly (FormatPatch | null)[];
  // Columns typed over (the habit ticks, a deal's probability): shown as inputs.
  inputs?: readonly number[];
};

// A field: its label (quiet) left of its value. An input is meant to be typed over (a soft yellow fill); a result
// is what the sheet works out and worth reading first (larger, in the accent).
export type Field = {
  label: string;
  value: StarterCell;
  f?: FormatPatch;
  kind?: 'input' | 'value' | 'result';
};

// A column of fields under an optional heading (a section).
export type FieldsBlock = { kind: 'fields'; at: At; heading?: string; items: readonly Field[] };

// A quiet line of text (a note under a table).
export type NoteBlock = { kind: 'note'; at: At; text: string };

export type DesignBlock = TableBlock | FieldsBlock | NoteBlock;

// A chart over the sheet's cells (sheet.md "Charts"), reading table `table` (its header and body rows, never its
// total), only columns `cols` of it when given (table-relative), its top-left at cell `at`.
export type DesignChart = {
  kind: 'pie-chart' | 'bar-chart' | 'line-chart';
  table: number;
  cols?: readonly number[];
  at: At;
  width: number;
  height: number;
};

// (The sheet's name is its template's name, catalogue.ts.)
export type SheetDesign = {
  // The title line in A1 (merged across `span` columns) and the line under it.
  heading: string;
  subtitle: string;
  span: number;
  accent: SheetAccent;
  blocks: readonly DesignBlock[];
  // Column widths in px, from A.
  widths: readonly number[];
  // Rows frozen: through the main table's header; 0 for a sheet read as a page (an invoice).
  freeze: number;
  charts?: readonly DesignChart[];
  // Ranges of checkboxes, by position [r1, c1, r2, c2] (data-validation.md): each a Checkbox rule.
  checkboxes?: readonly (readonly [number, number, number, number])[];
};

// Where a design's rows start: A1 the title, A2 the subtitle, row 3 a gap, row 4 the main table's header.
export const TITLE_ROW = 0;
export const SUBTITLE_ROW = 1;
export const GAP_ROW = 2;
export const HEAD_ROW = 3;

// Heights of the title, subtitle, gap (the least a row may be) and header rows, in px.
export const TITLE_ROW_PX = 46;
export const SUBTITLE_ROW_PX = 24;
export const GAP_ROW_PX = 18;
export const HEAD_ROW_PX = 32;
// The title's size in points.
export const TITLE_SIZE = 18;
// A result field's size in points.
export const RESULT_SIZE = 13;

// Formats the designs share.
export const MONEY: FormatPatch = { nf: 'currency', dp: 2 };
export const WHOLE_MONEY: FormatPatch = { nf: 'currency', dp: 0 };
export const PERCENT: FormatPatch = { nf: 'percent', dp: 0 };
export const NUMBER1: FormatPatch = { nf: 'number', dp: 1 };
export const WHOLE: FormatPatch = { nf: 'number', dp: 0 };
export const DATE: FormatPatch = { nf: 'date' };
export const CENTRE: FormatPatch = { ha: 'c' };

// A date cell, `days` from `today` (a date serial).
export const day = (today: number, days = 0): StarterCell => ({ n: today + days, date: true });
// Literal text, never read as a number or a date (a phone number, an invoice number).
export const text = (s: string): StarterCell => ({ s });

// Body rows of a table at `head` row: sheet row numbers (1-based) of its first and last body row.
export function bodyRows(head: number, count: number): { first: number; last: number } {
  return { first: head + 2, last: head + 1 + count };
}
