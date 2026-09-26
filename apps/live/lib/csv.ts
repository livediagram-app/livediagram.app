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
// The field parser handles quoted cells, escaped quotes (""), commas inside
// quotes, and CR/LF line endings. Non-numeric value cells fall back to 0.
// Returns null when there's nothing usable (no header + at least one data row).

import type { LineSeries } from '@livediagram/diagram';

// Soft caps so a pasted spreadsheet can't mint a pathologically huge chart.
const MAX_SERIES = 12;
const MAX_CATEGORIES = 200;

export function parseCsvLineData(
  text: string,
): { categories: string[]; series: LineSeries[] } | null {
  const rows = parseCsvRows(text);
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
      const n = Number((row[s + 1] ?? '').trim());
      series[s]!.values.push(Number.isFinite(n) ? n : 0);
    }
  }
  if (categories.length === 0) return null;
  return { categories, series };
}

function parseCsvRows(text: string): string[][] {
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
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
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
