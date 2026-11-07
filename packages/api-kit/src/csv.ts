// CSV for a spreadsheet (RFC 4180): the data export's comments and the team audit log's export
// (liveworkspace/docs/specs/003-accounts/data-export.md, liveworkspace/docs/specs/004-index/team-audit-log.md).
// A field a spreadsheet would run as a formula starts with one of these: it is opened with an apostrophe, so a name
// or title someone typed can't run in the reader's spreadsheet.
const FORMULA_START = /^[=+\-@\t\r]/;

/** One field: formula-safe, and quoted when it holds a quote, a comma or a line break. */
export function csvField(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Rows as CSV, each line ended with CRLF. */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n';
}
