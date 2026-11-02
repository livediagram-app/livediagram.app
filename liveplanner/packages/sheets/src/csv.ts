// CSV (docs/specs/029-sheets/sheet.md "CSV"): RFC 4180 both ways, cut at the grid's limits.
import { SHEET_COLS_MAX, SHEET_ROWS_MAX } from './limits';

export type ParsedCsv = { rows: string[][]; truncated: boolean };

// How many lines `separatorOf` reads to choose.
const SEPARATOR_SAMPLE_LINES = 20;

// The separator a file was written with: a tab when the first line holds one; a semicolon (Excel's CSV in locales
// whose decimal mark is a comma) when the first lines, read as RFC 4180 with semicolons, split into the same number
// of fields (more than one) on every line, and read with commas they do not, or into no more (a tie is a
// semicolon file: a comma file holding a semicolon on every line, the same number on each, is the rarer); else a comma. Reading
// the fields rather than counting characters keeps a quoted comma or semicolon out of it, and lets a comma-decimal
// value ("Tea;3,50") or header ("Amount, EUR") stand on a semicolon line.
function separatorOf(body: string): string {
  if (firstRecordHasTab(body)) return '\t';
  let end = -1;
  for (let n = 0; n < SEPARATOR_SAMPLE_LINES; n++) {
    const next = body.indexOf('\n', end + 1);
    if (next < 0) {
      end = body.length;
      break;
    }
    end = next;
  }
  const sample = body.slice(0, end).replace(/\r$/, '');
  if (!sample.includes(';')) return ',';
  const width = (d: string) => {
    const read = readCsv(sample, d);
    // A reading that leaves a quote outside RFC 4180's quoting has cut a quoted field apart: not this separator.
    if (read.stray) return 0;
    // A blank line splits no way at all, so it takes no part.
    const rows = read.rows.filter((r) => r.length > 1 || r[0] !== '');
    const n = rows[0]?.length ?? 0;
    return n > 1 && rows.every((r) => r.length === n) ? n : 0;
  };
  const semicolons = width(';');
  return semicolons > 0 && semicolons >= width(',') ? ';' : ',';
}

// Whether the first record holds a tab outside quotes: one inside a quoted field is the field's, not a separator. A
// quote opens and closes a field, and a doubled one inside it turns twice, so it reads as one record does. Stops at the
// first line break outside quotes, so it costs one record.
function firstRecordHasTab(body: string): boolean {
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '"') quoted = !quoted;
    else if (quoted) continue;
    else if (ch === '\t') return true;
    else if (ch === '\n' || ch === '\r') return false;
  }
  return false;
}

// Rows of fields, split by `sep`, else by the separator the text was written with (separatorOf).
export function parseCsv(text: string, sep?: string): ParsedCsv {
  const body = text.startsWith('\ufeff') ? text.slice(1) : text;
  const { rows, truncated } = readCsv(body, sep ?? separatorOf(body));
  return { rows, truncated };
}

// RFC 4180 read by `d`. `stray`: a quote was taken as text (one mid-field, or text after a field's closing quote),
// which a file written with `d` never holds.
function readCsv(body: string, d: string): ParsedCsv & { stray: boolean } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closed = false;
  let stray = false;
  let truncated = false;
  let i = 0;
  const endRow = () => {
    row.push(field);
    field = '';
    closed = false;
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
        closed = true;
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
      closed = false;
      i++;
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      endRow();
      if (ch === '\r' && body[i + 1] === '\n') i++;
      i++;
      if (rows.length >= SHEET_ROWS_MAX) {
        truncated = i < body.length;
        return { rows, truncated, stray };
      }
      continue;
    }
    if (ch === '"' || closed) stray = true;
    field += ch;
    i++;
  }
  if (field !== '' || row.length > 0) endRow();
  return { rows, truncated, stray };
}

// A semicolon and a tab are quoted too, though the file is comma-separated: a sheet whose cells hold one would
// otherwise read back as semicolon- or tab-separated (separatorOf).
function quote(field: string): string {
  return /[",;\t\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

// A field a spreadsheet would run as a formula when the file is opened (CSV injection): one starting with = + - @, a
// tab or a carriage return. A number as shown ("-1,200.50", "-£45", "+3%") is left as it is.
const FORMULA_START = /^[=+\-@\t\r]/;
// Each run of spaces has one place to match (after the sign, after a leading currency sign, before a trailing one), so
// a long run of spaces is read once, never backtracked over (a field is user input).
const SHOWN_NUMBER = /^[+-]?\s*(?:\p{Sc}\s*)?[\d.,]+(?:\s*\p{Sc})?%?$/u;

// A phone number as typed (docs/specs/029-sheets/sheet.md "CSV"): a + then only digits, spaces, brackets and dashes,
// at least 3 digits. No letter, quote or other sign, so it names no function, cell or command: it is written as text,
// keeping its +, never with a '. One character class, so nothing backtracks.
const PHONE_NUMBER = /^\+[\d ()-]+$/;
export const isCsvPhoneNumber = (field: string): boolean =>
  PHONE_NUMBER.test(field) && field.replace(/\D/g, '').length >= 3;

// A field made inert for a download: prefixed with ' so a spreadsheet opening the file shows it as text.
export function csvSafeField(field: string): string {
  return FORMULA_START.test(field) && !SHOWN_NUMBER.test(field) && !isCsvPhoneNumber(field)
    ? `'${field}`
    : field;
}

// A download's field: inert, and quoted when it is a phone number so a reader takes it as text.
function safeField(field: string): string {
  return isCsvPhoneNumber(field) ? `"${field}"` : quote(csvSafeField(field));
}

// `safe` (every download leaving the app, never a sheet's own round trip): each field a spreadsheet would run as a
// formula is made inert (csvSafeField), and a phone number is written as quoted text.
export function toCsv(rows: readonly (readonly string[])[], opts: { safe?: boolean } = {}): string {
  const field = opts.safe ? safeField : quote;
  return rows.map((r) => r.map(field).join(',')).join('\r\n') + (rows.length ? '\r\n' : '');
}
