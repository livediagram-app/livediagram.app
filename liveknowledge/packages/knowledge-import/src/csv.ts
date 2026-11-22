// A Notion database's `.csv` as a Markdown table (docs/specs/020-import-export/knowledgebase-import.md "Notion").
// One pass over the text: quoted fields may hold commas, line breaks and doubled quotes (RFC 4180).

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const endField = (): void => {
    row.push(field);
    field = '';
  };
  const endRow = (): void => {
    endField();
    // A blank line is no row.
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };
  for (let at = 0; at < text.length; at++) {
    const char = text[at]!;
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[at + 1] === '"') {
        field += '"';
        at++;
      } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ',') endField();
    else if (char === '\n') endRow();
    else if (char !== '\r') field += char;
  }
  endRow();
  return rows;
}

const cell = (value: string): string => value.replace(/\s+/g, ' ').trim().replace(/[\\|]/g, '\\$&');

/** The rows as a pipe table, the first its header; empty for no rows. */
export function csvToMarkdownTable(text: string): string {
  const rows = parseCsv(text);
  const header = rows[0];
  if (!header) return '';
  const line = (row: string[]): string =>
    `| ${header.map((_, column) => cell(row[column] ?? '')).join(' | ')} |`;
  return [
    line(header),
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.slice(1).map(line),
  ].join('\n');
}
