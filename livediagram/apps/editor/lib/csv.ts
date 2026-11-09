// CSV -> line-chart data (docs/specs/009-elements/pie-chart.md). The expected layout is a header row whose
// first cell labels the category column and whose remaining cells name the
// series, then one row per category (its label + a value per series):
//
//   Month,Sales,Costs
//   Jan,10,5
//   Feb,20,8
//
// -> categories ['Jan','Feb'], series [{Sales,[10,20]},{Costs,[5,8]}].
//
// The field parser handles quoted cells, escaped quotes (""), separators inside
// quotes, and CR/LF line endings. The separator is whichever of `,` `;` and tab
// the header uses most. A value keeps the number a spreadsheet formatted
// (`"1,234"`, `$10`, `25%`, `1.234,5` in a `;` file); anything else non-numeric
// falls back to 0. Returns null when there's nothing usable (no header + at
// least one data row).

import type { LineSeries } from '@livediagram/document';

// Soft caps so a pasted spreadsheet can't mint a pathologically huge chart.
const MAX_SERIES = 12;
const MAX_CATEGORIES = 200;

export function parseCsvLineData(
  text: string,
): { categories: string[]; series: LineSeries[] } | null {
  const sep = separatorOf(text);
  const rows = parseCsvRows(text, sep);
  if (rows.length < 2) return null;
  const header = rows[0]!;
  const seriesNames = header.slice(1, 1 + MAX_SERIES).map((h, i) => h.trim() || `Series ${i + 1}`);
  if (seriesNames.length === 0) return null;

  const categories: string[] = [];
  const series: LineSeries[] = seriesNames.map((name) => ({ name, values: [] }));
  for (let r = 1; r < rows.length && categories.length < MAX_CATEGORIES; r++) {
    const row = rows[r]!;
    if (row.every((c) => c.trim() === '')) continue; // skip blank lines
    categories.push((row[0] ?? '').trim() || `#${categories.length + 1}`);
    for (let s = 0; s < seriesNames.length; s++) {
      series[s]!.values.push(cellNumber(row[s + 1] ?? '', sep === ';'));
    }
  }
  if (categories.length === 0) return null;
  return { categories, series };
}

type Separator = ',' | ';' | '\t';

// The separator the header row (its first line, outside quotes) uses most; a comma on a tie or when it uses none.
function separatorOf(text: string): Separator {
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"') quoted = !quoted;
    else if (!quoted && c === '\n') break;
    else if (!quoted && (c === ',' || c === ';' || c === '\t')) counts[c] += 1;
  }
  if (counts[';'] > counts[','] && counts[';'] >= counts['\t']) return ';';
  if (counts['\t'] > counts[',']) return '\t';
  return ',';
}

// A value cell as the number a spreadsheet wrote it as. Spaces, a currency sign before or after the number (`$10`,
// `10 €`) and a trailing `%` are formatting; a `,` is a thousands separator, or, in a file `;` separates, the decimal
// point (its `.`s the thousands, so `1.234` there is 1234). Blank or anything else non-numeric reads 0.
function cellNumber(cell: string, decimalComma: boolean): number {
  let s = cell
    .replace(/[\s\u00a0\u202f]/g, '')
    .replace(/^([+-]?)[$€£¥]/, '$1')
    .replace(/%$/, '')
    .replace(/(\d)[$€£¥]$/, '$1');
  if (decimalComma && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (decimalComma && /^[+-]?\d{1,3}(?:\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  else if (/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function parseCsvRows(text: string, sep: Separator): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"' && field === '') {
      // Only a field's first character opens quotes (RFC 4180): a stray `"` mid-field (`5" monitor`)
      // is a character, never a quoted run that swallows the commas and lines after it.
      inQuotes = true;
    } else if (c === sep) {
      endField();
    } else if (c === '\n') {
      endRow();
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}
