// A table's paste (each product's canvas table, docs/specs/008-canvas/canvas-and-palette.md Table): plain clipboard
// text read into the cell grid a product's `pasteIntoTable` takes. Shared, so the products' parsers can't drift.

// Parse plain clipboard text into a row-major grid: newline-separated rows, tab-separated cells (the TSV
// convention every spreadsheet uses for plain-text copies). A cell that holds a line break, a tab or a quote comes
// quoted, its quotes doubled (Excel, Google Sheets, Numbers), and reads back as one cell: split on every newline, a
// two-line cell became two rows and shifted every row under it. Trailing blank lines (the final newline most
// spreadsheet copies carry) are dropped so pasting a 2x2 range doesn't grow the table by an empty row.
export function parseClipboardTableText(text: string): string[][] {
  const src = text.replace(/\r\n?/g, '\n');
  const grid: string[][] = [];
  let row: string[] = [];
  let i = 0;
  // Text with a quote that never closes as a cell is not a spreadsheet's copy: from there on every cell reads
  // as plain text, so no later quote rescans what a failed one already did (linear on any input).
  let quoting = true;
  for (;;) {
    let cell: string;
    // A quoted cell: up to the quote that closes it ("" is one quote), when that quote ends the cell.
    // A quote that never closes there is plain text, read as the unquoted cell it was.
    const close = quoting && src[i] === '"' ? quotedCellEnd(src, i) : -1;
    if (close < 0 && src[i] === '"') quoting = false;
    if (close >= 0) {
      cell = src.slice(i + 1, close).replace(/""/g, '"');
      i = close + 1;
    } else {
      let j = i;
      while (j < src.length && src[j] !== '\t' && src[j] !== '\n') j++;
      cell = src.slice(i, j);
      i = j;
    }
    row.push(cell);
    if (src[i] === '\t') {
      i++;
      continue;
    }
    grid.push(row);
    if (i >= src.length) break;
    row = [];
    i++; // the newline
  }
  while (
    grid.length > 1 &&
    grid[grid.length - 1]!.length === 1 &&
    grid[grid.length - 1]![0] === ''
  ) {
    grid.pop();
  }
  return grid;
}

// Where the quoted cell opening at `open` closes: the index of its closing quote, when a tab, a newline or the
// end follows it; -1 when it never closes that way. Linear: one pass over the cell.
function quotedCellEnd(src: string, open: number): number {
  let k = open + 1;
  while (k < src.length) {
    if (src[k] !== '"') {
      k++;
      continue;
    }
    if (src[k + 1] === '"') {
      k += 2;
      continue;
    }
    const after = src[k + 1];
    return after === undefined || after === '\t' || after === '\n' ? k : -1;
  }
  return -1;
}

// True when the parsed clipboard grid spans more than one cell: the paste should then fill + grow the table
// rather than land in one cell.
export function isTabularClipboard(grid: string[][]): boolean {
  return grid.length > 1 || (grid[0]?.length ?? 0) > 1;
}
