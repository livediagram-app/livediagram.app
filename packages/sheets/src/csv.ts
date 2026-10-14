// CSV (docs/specs/029-sheets/sheet.md "CSV"): RFC 4180 both ways, cut at the grid's limits.
import { SHEET_COLS_MAX, SHEET_ROWS_MAX } from './limits';

export type ParsedCsv = { rows: string[][]; truncated: boolean };

// Rows of fields. `sep` defaults to a tab when the first line holds one, a semicolon when it holds semicolons and
// no comma (Excel's CSV in locales whose decimal mark is a comma), else a comma.
export function parseCsv(text: string, sep?: string): ParsedCsv {
  const body = text.startsWith('﻿') ? text.slice(1) : text;
  const firstLine = body.slice(0, body.search(/\r?\n|$/));
  const d =
    sep ??
    (firstLine.includes('\t')
      ? '\t'
      : firstLine.includes(';') && !firstLine.includes(',')
        ? ';'
        : ',');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let truncated = false;
  let i = 0;
  const endRow = () => {
    row.push(field);
    field = '';
    if (row.length > SHEET_COLS_MAX) {
      row = row.slice(0, SHEET_COLS_MAX);
      truncated = true;
    }
    rows.push(row);
    row = [];
  };
  while (i < body.length) {
    const ch = body[i]!;
    if (quoted) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === '') {
      quoted = true;
      i++;
      continue;
    }
    if (ch === d) {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      endRow();
      if (ch === '\r' && body[i + 1] === '\n') i++;
      i++;
      if (rows.length >= SHEET_ROWS_MAX) {
        truncated = i < body.length;
        return { rows, truncated };
      }
      continue;
    }
    field += ch;
    i++;
  }
  if (field !== '' || row.length > 0) endRow();
  return { rows, truncated };
}

function quote(field: string): string {
  return /[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

// A field a spreadsheet would run as a formula when the file is opened (CSV injection): one starting with = + - @, a
// tab or a carriage return. A number as shown ("-1,200.50", "-£45", "+3%") is left as it is.
const FORMULA_START = /^[=+\-@\t\r]/;
// Each run of spaces has one place to match (after the sign, after a leading currency sign, before a trailing one), so
// a long run of spaces is read once, never backtracked over (a field is user input).
const SHOWN_NUMBER = /^[+-]?\s*(?:\p{Sc}\s*)?[\d.,]+(?:\s*\p{Sc})?%?$/u;

// A field made inert for a download: prefixed with ' so a spreadsheet opening the file shows it as text.
export function csvSafeField(field: string): string {
  return FORMULA_START.test(field) && !SHOWN_NUMBER.test(field) ? `'${field}` : field;
}

// `safe` (every download leaving the app, never a sheet's own round trip): each field a spreadsheet would run as a
// formula is made inert (csvSafeField).
export function toCsv(rows: readonly (readonly string[])[], opts: { safe?: boolean } = {}): string {
  const field = opts.safe ? (f: string) => quote(csvSafeField(f)) : quote;
  return rows.map((r) => r.map(field).join(',')).join('\r\n') + (rows.length ? '\r\n' : '');
}
