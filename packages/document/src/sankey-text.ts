// Flows as text (docs/specs/009-elements/sankey.md "Flows as text"): one flow per line, so a diagram can be
// typed, pasted from a spreadsheet or from SankeyMATIC, and read back out the same way.
//
// Accepted per line, first match wins:
//   Salary [3200] Budget          SankeyMATIC, the format people already have
//   Salary -> Budget: 3200        an arrow, as you would write it in a note ("→" works too)
//   Salary, Budget, 3200          CSV, or tab-separated straight out of a spreadsheet
// Blank lines and lines starting with // or ' (SankeyMATIC's comment mark) are skipped. A header row such
// as "from,to,value" is skipped because its value is not a number.

import {
  cleanSankeyName,
  SANKEY_MAX_FLOWS,
  SANKEY_VALUE_MAX,
  type SankeyFlow,
} from './sankey-model';

export type SankeyTextResult = {
  flows: SankeyFlow[];
  /** 1-based line numbers of lines that held something but read as no flow. */
  unread: number[];
};

/**
 * A line longer than this is not a flow (two names of SANKEY_NAME_MAX and an amount fit many times over), and is
 * named as unread rather than scanned: the readers below stay linear, and pasted text can never stall the dialog.
 */
export const SANKEY_LINE_MAX = 1000;

const ARROWS = ['->', '→', '=>'] as const;

// The readers scan by index rather than with patterns: lazy groups beside optional spaces backtrack polynomially
// on hostile input (CodeQL js/polynomial-redos), and these read whatever someone pastes.

// "From [amount] To": the first "[" after a non-empty From whose "]" closes a non-empty amount, followed by a To.
function readBracket(line: string): [string, string, string] | null {
  for (let open = line.indexOf('[', 1); open !== -1; open = line.indexOf('[', open + 1)) {
    const close = line.indexOf(']', open + 1);
    if (close === -1) return null;
    const amount = line.slice(open + 1, close).trim();
    const to = line.slice(close + 1).trim();
    const from = line.slice(0, open).trim();
    if (from && amount && to) return [from, to, amount];
  }
  return null;
}

// "From -> To: amount" (or →, =>; ":" or "="): the first arrow after a non-empty From, then the first separator
// after a non-empty To with an amount after it.
function readArrow(line: string): [string, string, string] | null {
  let at = -1;
  let len = 0;
  for (const a of ARROWS) {
    const i = line.indexOf(a, 1);
    if (i !== -1 && (at === -1 || i < at)) [at, len] = [i, a.length];
  }
  if (at === -1) return null;
  const from = line.slice(0, at).trim();
  const rest = line.slice(at + len);
  for (let i = 1; i < rest.length; i++) {
    if (rest[i] !== ':' && rest[i] !== '=') continue;
    const to = rest.slice(0, i).trim();
    const amount = rest.slice(i + 1).trim();
    if (from && to && amount) return [from, to, amount];
  }
  return null;
}

const isNumberStart = (c: string) => (c >= '0' && c <= '9') || c === '.' || c === '+' || c === '-';
const isNumberEnd = (c: string) => (c >= '0' && c <= '9') || c === '.';
// One way only to read each digit, so the check is linear.
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

/** A typed number: "3,200", "£3,200", "3200.5", "12 %" all read; anything else is NaN. */
export function readSankeyNumber(raw: string): number {
  if (raw.length > SANKEY_LINE_MAX) return NaN;
  const bare = raw.replace(/[,\s_]/g, '');
  // A currency mark before and a unit after are dropped: "£3,200", "12 %".
  let start = 0;
  while (start < bare.length && !isNumberStart(bare[start]!)) start++;
  let end = bare.length;
  while (end > start && !isNumberEnd(bare[end - 1]!)) end--;
  const t = bare.slice(start, end);
  if (!NUMBER.test(t)) return NaN;
  return Number(t);
}

// Split one CSV / TSV line, honouring double-quoted fields ("Rent, flat", "say ""hi""").
function splitDelimited(line: string, sep: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"' && cur.trim() === '') {
      quoted = true;
      cur = '';
    } else if (ch === sep) {
      cells.push(cur);
      cur = '';
    } else cur += ch;
  }
  cells.push(cur);
  return cells;
}

function readLine(line: string): SankeyFlow | null {
  if (line.length > SANKEY_LINE_MAX) return null;
  const bracket = readBracket(line);
  if (bracket) return flowOf(...bracket);
  const arrow = readArrow(line);
  if (arrow) return flowOf(...arrow);
  const sep = line.includes('\t') ? '\t' : line.includes(',') || line.includes('"') ? ',' : null;
  if (sep) {
    // A value with a thousands comma ("Salary, Budget, 3,200") splits into extra cells; the value is
    // everything after the second cell, rejoined.
    const cells = splitDelimited(line, sep);
    if (cells.length >= 3) return flowOf(cells[0]!, cells[1]!, cells.slice(2).join(sep));
  }
  return null;
}

function flowOf(from: string, to: string, raw: string): SankeyFlow | null {
  const value = readSankeyNumber(raw);
  const f = cleanSankeyName(from);
  const t = cleanSankeyName(to);
  if (!f || !t || !Number.isFinite(value)) return null;
  return { from: f, to: t, value: Math.min(SANKEY_VALUE_MAX, Math.max(-SANKEY_VALUE_MAX, value)) };
}

/** Reads text into flows, keeping at most SANKEY_MAX_FLOWS, and names the lines it could not read. */
export function parseSankeyText(text: string): SankeyTextResult {
  const flows: SankeyFlow[] = [];
  const unread: number[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith("'")) return;
    const flow = readLine(line);
    if (flow && flows.length < SANKEY_MAX_FLOWS) flows.push(flow);
    else if (!flow && !(i === 0 && isHeader(line))) unread.push(i + 1);
  });
  return { flows, unread };
}

// A first line naming its columns ("from,to,value", "Source\tTarget\tAmount") is a header, not a mistake.
function isHeader(line: string): boolean {
  const cells = splitDelimited(line, line.includes('\t') ? '\t' : ',');
  return cells.length >= 3 && !Number.isFinite(readSankeyNumber(cells[2]!));
}

/** Flows written back out in the SankeyMATIC form, one per line, so text round-trips. */
export function sankeyFlowsToText(flows: readonly SankeyFlow[] | undefined): string {
  return (flows ?? [])
    .map((f) => `${f.from} [${Number.isFinite(f.value) ? f.value : 0}] ${f.to}`)
    .join('\n');
}
