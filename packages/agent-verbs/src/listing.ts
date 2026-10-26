// What the read verbs share to print a list: its limits, its dates and its columns.

export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 200;

// `YYYY-MM-DD`, and `YYYY-MM-DD HH:MM`, in UTC so output does not depend on the machine.
export const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const minute = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

// Rows as aligned columns, two spaces apart; the last column is not padded.
export function columns(rows: readonly (readonly string[])[]): string[] {
  const widths: number[] = [];
  for (const row of rows)
    row.forEach((cell, i) => (widths[i] = Math.max(widths[i] ?? 0, cell.length)));
  return rows.map((row) =>
    row.map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd(widths[i]!))).join('  '),
  );
}

// The line under a cut list: how many more, and the --limit that shows them all, never one past the flag's own
// maximum (which the flag would refuse); past it, only narrowing helps.
export function moreLine(shown: number, more: number, max: number, narrow: string): string {
  const all = shown + more;
  return all <= max
    ? `… ${more} more; --limit ${all}, or ${narrow}`
    : `… ${more} more; ${narrow} (--limit goes up to ${max})`;
}
