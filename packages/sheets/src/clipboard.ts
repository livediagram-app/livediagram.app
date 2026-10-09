// The clipboard (docs/specs/029-sheets/sheet.md "Clipboard"): a copied range as the sheet's own cells, as
// tab-separated text and as an HTML table, and pasted HTML or text read back into rows. Pasted HTML is scanned as
// text, never put in a DOM; only a few inline styles are read.
import { formatRange, type GridRange } from './address';
import { displayValue } from './number-format';
import { cellKey, type Cell, type CellFormat } from './sheet';
import { parseCsv, type ParsedCsv } from './csv';
import { SHEET_ROWS_MAX } from './limits';
import type { Workbook } from './engine/workbook';

export const SHEET_CLIP_TYPE = 'web application/x-livediagram-sheet+json';

export type SheetClip = {
  v: 1;
  rows: number;
  cols: number;
  cells: (Cell | null)[][];
  // What the cells show, for the text and HTML forms (and Paste Values Only).
  values: string[][];
  // Where it came from: a paste of the sheet's own cells shifts formulas by the distance moved.
  from: { sheetId: string; r: number; c: number; range: string };
  cut?: true;
};

export function clipFromRange(
  wb: Workbook,
  sheetId: string,
  range: GridRange,
  cut = false,
): SheetClip | null {
  const sheet = wb.sheet(sheetId);
  if (!sheet) return null;
  const cells: (Cell | null)[][] = [];
  const values: string[][] = [];
  for (let r = range.r1; r <= range.r2; r++) {
    const rowCells: (Cell | null)[] = [];
    const rowValues: string[] = [];
    for (let c = range.c1; c <= range.c2; c++) {
      const rowId = sheet.layout.rows[r];
      const colId = sheet.layout.cols[c];
      const cell = rowId && colId ? (sheet.cells.get(cellKey(rowId, colId)) ?? null) : null;
      rowCells.push(cell);
      rowValues.push(displayValue(wb.value(sheetId, r, c), cell?.format, wb.locale).text);
    }
    cells.push(rowCells);
    values.push(rowValues);
  }
  return {
    v: 1,
    rows: range.r2 - range.r1 + 1,
    cols: range.c2 - range.c1 + 1,
    cells,
    values,
    from: { sheetId, r: range.r1, c: range.c1, range: formatRange(range) },
    ...(cut ? { cut: true as const } : {}),
  };
}

export function clipToTsv(values: readonly (readonly string[])[]): string {
  return values
    .map((row) => row.map((v) => (/[\t\n"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join('\t'))
    .join('\n');
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ESCAPES[c]!);

function styleOf(f: CellFormat | undefined): string {
  if (!f) return '';
  const out: string[] = [];
  if (f.b) out.push('font-weight:bold');
  if (f.i) out.push('font-style:italic');
  const deco = [f.u ? 'underline' : '', f.st ? 'line-through' : ''].filter(Boolean).join(' ');
  if (deco) out.push(`text-decoration:${deco}`);
  if (f.fc) out.push(`color:${f.fc}`);
  if (f.bg) out.push(`background-color:${f.bg}`);
  if (f.ha) out.push(`text-align:${f.ha === 'l' ? 'left' : f.ha === 'c' ? 'center' : 'right'}`);
  if (f.fs) out.push(`font-size:${f.fs}pt`);
  return out.length ? ` style="${out.join(';')}"` : '';
}

export function clipToHtml(clip: SheetClip): string {
  const rows = clip.values.map(
    (row, r) =>
      `<tr>${row
        .map(
          (v, c) =>
            `<td${styleOf(clip.cells[r]![c]?.format)}>${escapeHtml(v).replace(/\n/g, '<br>')}</td>`,
        )
        .join('')}</tr>`,
  );
  return `<meta charset="utf-8"><table data-livediagram-sheet="1">${rows.join('')}</table>`;
}

export type PastedCell = { text: string; format?: CellFormat };

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code =
        e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

function colourOf(v: string): string | undefined {
  const t = v.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(t);
  if (hex) {
    const h = hex[1]!;
    return `#${h.length === 3 ? [...h].map((c) => c + c).join('') : h}`;
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(t);
  if (rgb)
    return `#${[rgb[1], rgb[2], rgb[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('')}`;
  const names: Record<string, string> = {
    black: '#000000',
    white: '#ffffff',
    red: '#ff0000',
    blue: '#0000ff',
    green: '#008000',
  };
  return names[t];
}

function formatFromStyle(style: string, tags: Set<string>): CellFormat | undefined {
  const f: CellFormat = {};
  for (const part of style.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const k = part.slice(0, i).trim().toLowerCase();
    const v = part
      .slice(i + 1)
      .trim()
      .toLowerCase();
    if (k === 'font-weight' && (v === 'bold' || Number(v) >= 600)) f.b = true;
    if (k === 'font-style' && v === 'italic') f.i = true;
    if (k === 'text-decoration' || k === 'text-decoration-line') {
      if (v.includes('underline')) f.u = true;
      if (v.includes('line-through')) f.st = true;
    }
    if (k === 'color') {
      const c = colourOf(v);
      if (c && c !== '#000000') f.fc = c;
    }
    if (k === 'background-color' || k === 'background') {
      const c = colourOf(v);
      if (c && c !== '#ffffff') f.bg = c;
    }
    if (k === 'text-align') {
      if (v === 'center') f.ha = 'c';
      if (v === 'right') f.ha = 'r';
      if (v === 'left') f.ha = 'l';
    }
  }
  if (tags.has('b') || tags.has('strong')) f.b = true;
  if (tags.has('i') || tags.has('em')) f.i = true;
  if (tags.has('u')) f.u = true;
  if (tags.has('s') || tags.has('strike') || tags.has('del')) f.st = true;
  return Object.keys(f).length ? f : undefined;
}

// The first <table> of pasted HTML as rows of cells, colspan and rowspan filled with empty cells; null when there
// is no table.
export function readPastedHtml(html: string): PastedCell[][] | null {
  const start = html.search(/<table[\s>]/i);
  if (start < 0) return null;
  const end = html.search(/<\/table>/i);
  const body = html.slice(start, end < 0 ? undefined : end);
  const rows: PastedCell[][] = [];
  const pendingRowSpans: Map<number, number>[] = [];
  const tagRe = /<\/?([a-z0-9]+)([^>]*)>/gi;
  let row: PastedCell[] | null = null;
  let cell: {
    text: string;
    style: string;
    tags: Set<string>;
    colspan: number;
    rowspan: number;
  } | null = null;
  let last = 0;
  const inner: string[] = [];
  const finishCell = () => {
    if (!cell || !row) return;
    cell.text += inner.join('');
    inner.length = 0;
    const text = decode(cell.text.replace(/\s*\n\s*/g, ' '))
      .split('\u0001')
      .join('\n')
      .trim();
    const format = formatFromStyle(cell.style, cell.tags);
    const ri = rows.length;
    while (pendingRowSpans[ri]?.has(row.length)) row.push({ text: '' });
    row.push(format ? { text, format } : { text });
    for (let k = 1; k < cell.colspan; k++) row.push({ text: '' });
    for (let k = 1; k < cell.rowspan; k++) {
      const m = (pendingRowSpans[ri + k] ??= new Map());
      for (let j = 0; j < cell.colspan; j++) m.set(row.length - cell.colspan + j, 1);
    }
    cell = null;
  };
  for (let m = tagRe.exec(body); m; m = tagRe.exec(body)) {
    const text = body.slice(last, m.index);
    last = tagRe.lastIndex;
    if (cell) inner.push(text);
    const name = m[1]!.toLowerCase();
    const closing = m[0][1] === '/';
    const attrs = m[2] ?? '';
    if (name === 'tr' && !closing) {
      finishCell();
      row = [];
      rows.push(row);
    } else if ((name === 'td' || name === 'th') && !closing) {
      finishCell();
      if (!row) {
        row = [];
        rows.push(row);
      }
      const attr = (n: string) =>
        new RegExp(`${n}\\s*=\\s*("([^"]*)"|'([^']*)'|(\\S+))`, 'i').exec(attrs);
      const a = attr('style');
      const span = (n: string) => {
        const v = attr(n);
        const x = Number(v?.[2] ?? v?.[3] ?? v?.[4] ?? 1);
        return Number.isInteger(x) && x > 0 ? Math.min(x, 200) : 1;
      };
      cell = {
        text: '',
        style: a?.[2] ?? a?.[3] ?? a?.[4] ?? '',
        tags: new Set(),
        colspan: span('colspan'),
        rowspan: span('rowspan'),
      };
    } else if ((name === 'td' || name === 'th') && closing) {
      finishCell();
    } else if (cell && !closing && name === 'br') {
      inner.push('\u0001');
    } else if (
      cell &&
      !closing &&
      name !== 'span' &&
      name !== 'div' &&
      name !== 'p' &&
      name !== 'font'
    ) {
      cell.tags.add(name);
    } else if (cell && !closing && (name === 'span' || name === 'font')) {
      const st = /style\s*=\s*"([^"]*)"/i.exec(attrs);
      if (st) cell.style += `;${st[1]}`;
    }
  }
  finishCell();
  const width = Math.max(0, ...rows.map((r) => r.length));
  if (width === 0) return null;
  return rows.map((r) => [...r, ...Array.from({ length: width - r.length }, () => ({ text: '' }))]);
}

// Pasted plain text as rows: tab-separated when any line holds a tab; comma-separated when every line splits into
// the same number (more than one) of fields; else a line a row.
export function readPastedText(text: string): string[][] {
  return parsePastedText(text).rows;
}

// The same, saying whether the text held more rows or columns than a sheet can (the paste is then cut, and says so).
export function parsePastedText(text: string): ParsedCsv {
  const trimmed = text.replace(/\r?\n$/, '');
  if (trimmed === '') return { rows: [['']], truncated: false };
  if (trimmed.includes('\t')) return parseCsv(trimmed, '\t');
  const csv = parseCsv(trimmed, ',');
  if (
    csv.rows.length > 0 &&
    csv.rows[0]!.length > 1 &&
    csv.rows.every((r) => r.length === csv.rows[0]!.length)
  )
    return csv;
  const lines = trimmed.split(/\r?\n/);
  return {
    rows: lines.slice(0, SHEET_ROWS_MAX).map((l) => [l]),
    truncated: lines.length > SHEET_ROWS_MAX,
  };
}
