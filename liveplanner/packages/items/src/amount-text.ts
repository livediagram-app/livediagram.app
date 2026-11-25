// An amount written as text, as a Currency field keeps it (docs/specs/026-plan/plan-board.md "Import CSV",
// plan-agents.md): its currency symbols and words aside, grouping read whichever way the writer's locale groups. A
// point and a comma together: the later one is the decimal mark ("1,234.50", "1.234,50"). A comma alone is a decimal
// mark before one or two digits at the end ("12,5", "12,50") and grouping otherwise ("1,200", "1,234,567"); a point
// alone is a decimal mark once ("12.5") and grouping when it repeats ("1.234.567"). Rounded to the penny; undefined
// when the text holds no digit. One pass over the text, no regex.
export function amountOf(text: string): number | undefined {
  let kept = '';
  let negative = false;
  let digits = false;
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') {
      kept += ch;
      digits = true;
    } else if (ch === '.' || ch === ',') kept += ch;
    // A minus before the first digit makes it negative; one after a digit ("1-2") is no amount.
    else if (ch === '-') {
      if (digits || negative) return undefined;
      negative = true;
    }
  }
  if (!digits) return undefined;
  const point = kept.lastIndexOf('.');
  const comma = kept.lastIndexOf(',');
  let decimal: '.' | ',' | null = null;
  if (point >= 0 && comma >= 0) decimal = point > comma ? '.' : ',';
  else if (comma >= 0) {
    const after = kept.length - comma - 1;
    decimal = kept.indexOf(',') === comma && (after === 1 || after === 2) ? ',' : null;
  } else if (point >= 0) decimal = kept.indexOf('.') === point ? '.' : null;
  let plain = '';
  for (const ch of kept) {
    if (ch === decimal) plain += '.';
    else if (ch !== '.' && ch !== ',') plain += ch;
  }
  const n = Number(plain);
  if (!Number.isFinite(n)) return undefined;
  return Math.round((negative ? -n : n) * 100) / 100;
}
