// The clipboard (docs/specs/029-sheets/sheet.md "Clipboard"): a copied range as the sheet's own cells, as
// tab-separated text and as an HTML table, and pasted HTML or text read back into rows. Pasted HTML is scanned as
// text, never put in a DOM; only a few inline styles are read.
import { formatRange, type GridRange } from './address';
import { displayValue } from './number-format';
import { cellKey, type Cell, type CellFormat } from './sheet';
import { parseCsv, type ParsedCsv } from './csv';
import { SHEET_ROWS_MAX } from './limits';
import type { Workbook } from './engine/workbook';

export const SHEET_CLIP_TYPE = 'web application/x-liveplanner-sheet+json';

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

// A font id's family name, as another spreadsheet reads it from pasted HTML: the editor's fonts are named as their
// ids in Title Case (`space-grotesk` is Space Grotesk).
function fontFamilyName(id: string): string {
  return id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

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
  if (f.ff) out.push(`font-family:'${fontFamilyName(f.ff)}'`);
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
  return `<meta charset="utf-8"><table data-liveplanner-sheet="1">${rows.join('')}</table>`;
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

// The next tag of pasted HTML from `from`, read left to right: its name, whether it closes, and its attributes up to
// the `>` that ends it outside quotes. Google Sheets writes a cell's value and formula into attributes
// (`data-sheets-formula="=IF(R[0]C[1]>2,1,0)"`) where a browser may leave `>` unescaped, so the first `>` is not
// always the tag's end. An unclosed quote falls back to that first `>`, as a browser would recover.
type HtmlTag = { index: number; end: number; name: string; closing: boolean; attrs: string };
function isNameChar(code: number): boolean {
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}
function nextTag(
  html: string,
  from: number,
  lastQuote: { '"': number; "'": number },
): HtmlTag | null {
  for (let i = html.indexOf('<', from); i >= 0; i = html.indexOf('<', i + 1)) {
    let j = i + 1;
    const closing = html[j] === '/';
    if (closing) j++;
    const nameStart = j;
    while (j < html.length && isNameChar(html.charCodeAt(j))) j++;
    if (j === nameStart) continue;
    const firstGt = html.indexOf('>', j);
    if (firstGt < 0) return null;
    // A quote opens a value only straight after `=` (spaces allowed), as in a browser; its closing quote is
    // found by a jump, and one with none (after the last of its kind) ends the tag at the first `>` instead.
    let end = -1;
    let afterEquals = false;
    for (let k = j; k < html.length; k++) {
      const ch = html[k]!;
      if (ch === '>') {
        end = k;
        break;
      }
      if (afterEquals && (ch === '"' || ch === "'")) {
        if (k >= lastQuote[ch]) break;
        k = html.indexOf(ch, k + 1);
        afterEquals = false;
      } else if (ch === '=') afterEquals = true;
      else if (ch !== ' ' && ch !== '\t' && ch !== '\n' && ch !== '\r') afterEquals = false;
    }
    if (end < 0) end = firstGt;
    return {
      index: i,
      end: end + 1,
      name: html.slice(nameStart, j),
      closing,
      attrs: html.slice(j, end),
    };
  }
  return null;
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
  let row: PastedCell[] | null = null;
  let cell: {
    text: string;
    /** The cell's own style, then each inline span's, in project order. */
    styles: string[];
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
    // Source line breaks are spaces, except straight after a <br>, where Excel indents the next line's source
    // ("Two<br>\n  lines" is "Two" and "lines").
    const text = decode(
      cell.text
        .replace(/\s*\n\s*/g, ' ')
        .split('\u0001 ')
        .join('\u0001'),
    )
      .split('\u0001')
      .join('\n')
      .trim();
    const format = formatFromStyle(cell.styles.join(';'), cell.tags);
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
  const lastQuote = { '"': body.lastIndexOf('"'), "'": body.lastIndexOf("'") };
  for (let m = nextTag(body, 0, lastQuote); m; m = nextTag(body, m.end, lastQuote)) {
    const text = body.slice(last, m.index);
    last = m.end;
    if (cell) inner.push(text);
    const name = m.name.toLowerCase();
    const closing = m.closing;
    const attrs = m.attrs;
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
        styles: [a?.[2] ?? a?.[3] ?? a?.[4] ?? ''],
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
      const style = /style\s*=\s*"([^"]*)"/i.exec(attrs)?.[1];
      if (style !== undefined) cell.styles.push(style);
    }
  }
  finishCell();
  const width = Math.max(0, ...rows.map((r) => r.length));
  if (width === 0) return null;
  return rows.map((r) => [...r, ...Array.from({ length: width - r.length }, () => ({ text: '' }))]);
}

// Pasted plain text as rows: tab-separated when any line holds a tab; comma-separated when there are two lines or
// more and every one splits into the same number (more than one) of fields; else a line a row. One line is never
// read as commas: "Thanks, Sam" pasted on a cell is a sentence, not two columns.
export function readPastedText(text: string): string[][] {
  return parsePastedText(text).rows;
}

// The same, saying whether the text held more rows or columns than a sheet can (the paste is then cut, and says so).
export function parsePastedText(text: string): ParsedCsv {
  const trimmed = text.replace(/\r?\n$/, '');
  if (trimmed === '') return { rows: [['']], truncated: false };
  if (trimmed.includes('\t')) return parseCsv(trimmed, '\t');
  const csv = parseCsv(trimmed, ',');
  // Two LINES, not two records: one quoted record running over lines ("Line one\nline two",B) is CSV too.
  if (
    /\r?\n/.test(trimmed) &&
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
