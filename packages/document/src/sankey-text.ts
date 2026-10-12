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

const BRACKET = /^(.+?)\s*\[\s*([^\]]+?)\s*\]\s*(.+)$/;
const ARROW = /^(.+?)\s*(?:->|→|=>)\s*(.+?)\s*[:=]\s*(.+)$/;

/** A typed number: "3,200", "£3,200", "3200.5", "12 %" all read; anything else is NaN. */
export function readSankeyNumber(raw: string): number {
  const t = raw
    .trim()
    .replace(/[,\s_]/g, '')
    .replace(/^[^\d.+-]+/, '')
    .replace(/[^\d.]+$/, '');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return NaN;
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
  const bracket = BRACKET.exec(line);
  if (bracket) return flowOf(bracket[1]!, bracket[3]!, bracket[2]!);
  const arrow = ARROW.exec(line);
  if (arrow) return flowOf(arrow[1]!, arrow[2]!, arrow[3]!);
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
