// CSV (docs/specs/029-sheets/sheet.md "CSV"): RFC 4180 both ways, cut at the grid's limits.
import { SHEET_COLS_MAX, SHEET_ROWS_MAX } from './limits';

export type ParsedCsv = { rows: string[][]; truncated: boolean };

// Rows of fields. `sep` defaults to a tab when the first line holds one, else a comma.
export function parseCsv(text: string, sep?: string): ParsedCsv {
  const body = text.startsWith('﻿') ? text.slice(1) : text;
  const firstLine = body.slice(0, body.search(/\r?\n|$/));
  const d = sep ?? (firstLine.includes('\t') ? '\t' : ',');
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

export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((r) => r.map(quote).join(',')).join('\r\n') + (rows.length ? '\r\n' : '');
}
