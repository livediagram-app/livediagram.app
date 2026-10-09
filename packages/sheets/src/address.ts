// A1 addresses (docs/specs/029-sheets/formulas.md "References"): column letters, cell and range text, both ways.
// Positions here are zero-based (row 0 is "1", column 0 is "A").

export type CellPos = { r: number; c: number };
// A rectangle of positions, inclusive, normalised so r1 <= r2 and c1 <= c2.
export type GridRange = { r1: number; c1: number; r2: number; c2: number };

// Which parts of a reference are absolute ($).
export type AbsFlags = { row: boolean; col: boolean };

export function columnLetters(c: number): string {
  let n = c + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

// The position of a column's letters ("A" 0, "AA" 26), or -1 when they are not letters.
export function columnIndex(letters: string): number {
  if (!/^[A-Za-z]{1,4}$/.test(letters)) return -1;
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function formatA1(r: number, c: number, abs: AbsFlags = { row: false, col: false }): string {
  return `${abs.col ? '$' : ''}${columnLetters(c)}${abs.row ? '$' : ''}${r + 1}`;
}

export type ParsedCell = CellPos & { abs: AbsFlags };

const CELL_RE = /^(\$?)([A-Za-z]{1,4})(\$?)([0-9]{1,7})$/;

export function parseA1(text: string): ParsedCell | null {
  const m = CELL_RE.exec(text.trim());
  if (!m) return null;
  const row = Number(m[4]);
  if (row < 1) return null;
  return { r: row - 1, c: columnIndex(m[2]!), abs: { col: m[1] === '$', row: m[3] === '$' } };
}

export function normaliseRange(a: CellPos, b: CellPos): GridRange {
  return {
    r1: Math.min(a.r, b.r),
    c1: Math.min(a.c, b.c),
    r2: Math.max(a.r, b.r),
    c2: Math.max(a.c, b.c),
  };
}

export function formatRange(range: GridRange): string {
  const a = formatA1(range.r1, range.c1);
  return range.r1 === range.r2 && range.c1 === range.c2
    ? a
    : `${a}:${formatA1(range.r2, range.c2)}`;
}

// A cell or range typed into the name box ("B4", "b4:d9"), as positions; null when it is not one.
export function parseRangeText(text: string): GridRange | null {
  const parts = text.trim().split(':');
  if (parts.length > 2) return null;
  const a = parseA1(parts[0]!);
  if (!a) return null;
  const b = parts.length === 2 ? parseA1(parts[1]!) : a;
  if (!b) return null;
  return normaliseRange(a, b);
}

export function rangeContains(range: GridRange, r: number, c: number): boolean {
  return r >= range.r1 && r <= range.r2 && c >= range.c1 && c <= range.c2;
}

export function rangeSize(range: GridRange): { rows: number; cols: number } {
  return { rows: range.r2 - range.r1 + 1, cols: range.c2 - range.c1 + 1 };
}
