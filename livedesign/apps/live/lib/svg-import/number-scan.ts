// A left-to-right scanner over the number lists SVG attributes hold (path data, `points`, `transform`, `viewBox`),
// docs/specs/020-import-export/svg-import.md "Trust and limits". It never backtracks: each character is looked at
// a bounded number of times, so the worst string a file can hold is read in linear time. No regular expressions.

const isDigit = (c: number) => c >= 48 && c <= 57;
// Space, tab, newline, carriage return, form feed.
const isSpace = (c: number) => c === 32 || c === 9 || c === 10 || c === 13 || c === 12;

export class NumberScanner {
  private i = 0;
  private readonly s: string;
  constructor(s: string) {
    this.s = s;
  }

  get done(): boolean {
    return this.i >= this.s.length;
  }

  /** Skips whitespace and at most one comma between numbers. */
  skipSeparators(): void {
    const s = this.s;
    while (this.i < s.length && isSpace(s.charCodeAt(this.i))) this.i++;
    if (this.i < s.length && s.charCodeAt(this.i) === 44) {
      this.i++;
      while (this.i < s.length && isSpace(s.charCodeAt(this.i))) this.i++;
    }
  }

  /** Skips whitespace only. */
  skipSpaces(): void {
    while (this.i < this.s.length && isSpace(this.s.charCodeAt(this.i))) this.i++;
  }

  /** The next character without consuming it, or '' at the end. */
  peek(): string {
    return this.s[this.i] ?? '';
  }

  /** Consumes one character. */
  take(): string {
    return this.s[this.i++] ?? '';
  }

  /** Whether a number can start here. */
  atNumber(): boolean {
    const c = this.s.charCodeAt(this.i);
    return isDigit(c) || c === 45 || c === 43 || c === 46;
  }

  /** A number (sign, digits, fraction, exponent), or null when none starts here. The SVG grammar lets numbers
   *  run together: `1.5.5` is 1.5 then .5, `1-2` is 1 then -2. */
  number(): number | null {
    const s = this.s;
    const start = this.i;
    let j = this.i;
    let c = s.charCodeAt(j);
    if (c === 43 || c === 45) c = s.charCodeAt(++j);
    let digits = 0;
    while (isDigit(c)) {
      digits++;
      c = s.charCodeAt(++j);
    }
    if (c === 46) {
      c = s.charCodeAt(++j);
      while (isDigit(c)) {
        digits++;
        c = s.charCodeAt(++j);
      }
    }
    if (digits === 0) return null;
    if (c === 101 || c === 69) {
      let k = j + 1;
      let e = s.charCodeAt(k);
      if (e === 43 || e === 45) e = s.charCodeAt(++k);
      if (isDigit(e)) {
        while (isDigit(e)) e = s.charCodeAt(++k);
        j = k;
      }
    }
    this.i = j;
    const v = Number(s.slice(start, j));
    return Number.isFinite(v) ? v : null;
  }

  /** An arc flag: a single `0` or `1`, which may run straight into the next number (`a1 1 0 00 1 1`). */
  flag(): boolean | null {
    const c = this.s.charCodeAt(this.i);
    if (c !== 48 && c !== 49) return null;
    this.i++;
    return c === 49;
  }
}

/** Every number in a list (`points`, `viewBox`), stopping at the first thing that is not one. */
export function numberList(s: string): number[] {
  const scan = new NumberScanner(s);
  const out: number[] = [];
  scan.skipSpaces();
  while (!scan.done) {
    const n = scan.number();
    if (n === null) break;
    out.push(n);
    scan.skipSeparators();
  }
  return out;
}
